import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { generateApiKey, hashNewApiKey } from '../lib/api-key-hash'
import { Errors } from '../lib/errors'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  MODAL_RUNTIME_URL?: string
  API_BASE_URL?: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

// Validation schemas
const deploySchema = z.object({
  environment: z.enum(['dev', 'staging', 'prod']).default('prod'),
  notes: z.string().max(500).optional(),
})

const promoteSchema = z.object({
  source_deployment_id: z.string().uuid(),
  target_environment: z.enum(['staging', 'prod']),
  notes: z.string().max(500).optional(),
})

const rollbackSchema = z.object({
  notes: z.string().max(500).optional(),
})

const historyQuerySchema = z.object({
  environment: z.enum(['dev', 'staging', 'prod']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

// Environment type for consistent usage
type Environment = 'dev' | 'staging' | 'prod'

export const deployRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// POST /deploy/:id - Deploy an agent to a specific environment
// Requires authentication + wallet rate limiting
// Body: { environment?: 'dev' | 'staging' | 'prod', notes?: string }
deployRoutes.post('/:id', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const wallet = c.get('wallet')

  // Parse and validate request body
  let body: z.infer<typeof deploySchema>
  try {
    const rawBody = await c.req.json().catch(() => ({}))
    body = deploySchema.parse(rawBody)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: err.flatten() }, 400)
    }
    body = { environment: 'prod' }
  }

  const environment = body.environment
  const notes = body.notes

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // 1. Get agent and verify ownership
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (agentError || !agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // 2. Validate flow structure
  const flow = agent.flow as { nodes?: Array<Record<string, unknown>>; edges?: unknown[] }
  if (!flow.nodes || flow.nodes.length === 0) {
    return c.json(
      {
        error: 'Cannot deploy agent without flow nodes. Add nodes to the flow first.',
      },
      400
    )
  }

  // Validate required node types
  const nodeTypes = flow.nodes.map((n) => n.type as string)
  const hasInputNode = nodeTypes.includes('input')
  const hasOutputNode = nodeTypes.includes('output')

  if (!hasInputNode || !hasOutputNode) {
    const missing = []
    if (!hasInputNode) missing.push('input')
    if (!hasOutputNode) missing.push('output')
    return c.json(
      {
        error: `Flow must have at least one input node and one output node. Missing: ${missing.join(', ')}.`,
      },
      400
    )
  }

  // Collect warnings (don't block deploy)
  const warnings: string[] = []

  // Check process nodes for model config (warning only — runtime has fallbacks)
  const processNodes = flow.nodes.filter((n) => n.type === 'process')
  const processNodesWithoutModel = processNodes.filter((n) => {
    const data = n.data as Record<string, unknown> | undefined
    if (!data) return true
    // Check data.model (legacy) or data.config.model (current UI structure)
    if (data.model) return false
    const config = data.config as Record<string, unknown> | undefined
    if (config?.model) return false
    return true
  })

  if (processNodesWithoutModel.length > 0) {
    warnings.push(
      `${processNodesWithoutModel.length} process node(s) without explicit model — will use agent default or gpt-4o-mini.`
    )
  }

  const hasClawNode = nodeTypes.includes('claw')
  if (!hasClawNode) {
    warnings.push('No GuardianClaw validation nodes in flow. Agent will run without safety gates.')
  }

  // Check for tool nodes without config
  const toolNodes = flow.nodes.filter((n) => n.type === 'tool')
  const toolNodesWithoutConfig = toolNodes.filter((n) => {
    const data = n.data as Record<string, unknown> | undefined
    return !data?.config || Object.keys(data.config as Record<string, unknown>).length === 0
  })
  if (toolNodesWithoutConfig.length > 0) {
    warnings.push(`${toolNodesWithoutConfig.length} tool node(s) have no configuration.`)
  }

  // Check for orphan nodes (no edges except input/output which are naturally endpoints)
  if (flow.edges && Array.isArray(flow.edges)) {
    const connectedNodeIds = new Set<string>()
    for (const edge of flow.edges as Array<Record<string, unknown>>) {
      connectedNodeIds.add(edge.source as string)
      connectedNodeIds.add(edge.target as string)
    }
    const orphanNodes = flow.nodes.filter(
      (n) => !connectedNodeIds.has(n.id as string) && n.type !== 'input' && n.type !== 'output'
    )
    if (orphanNodes.length > 0) {
      warnings.push(
        `${orphanNodes.length} node(s) have no connections and will be skipped during execution.`
      )
    }
  }

  // 3. Check for existing active deployment in the same environment
  const { data: existingDeployment } = await supabase
    .from('deployments')
    .select('id, version')
    .eq('agent_id', agentId)
    .eq('environment', environment)
    .eq('status', 'running')
    .eq('is_active', true)
    .single()

  if (existingDeployment) {
    return c.json(
      {
        error: `Agent already has an active deployment in ${environment}. Stop it first or use redeploy.`,
        deployment_id: existingDeployment.id,
        environment,
      },
      409
    )
  }

  // 4. Deactivate any previous deployments in this environment
  await supabase
    .from('deployments')
    .update({
      is_active: false,
      stopped_at: new Date().toISOString(),
      status: 'stopped',
    })
    .eq('agent_id', agentId)
    .eq('environment', environment)
    .eq('is_active', true)

  // 5. Build endpoint URL
  const apiBaseUrl = c.env.API_BASE_URL || 'https://api.guardianclaw.org'
  const endpointUrl = `${apiBaseUrl}/invoke/${agentId}`

  // 6. Create deployment record with environment
  const newVersion = (agent.version || 0) + 1
  const { data: deployment, error: deployError } = await supabase
    .from('deployments')
    .insert({
      agent_id: agentId,
      version: newVersion,
      status: 'running',
      environment,
      config_snapshot: {
        flow: agent.flow,
        config: agent.config,
        claw_config: agent.claw_config,
      },
      flow_snapshot: agent.flow,
      claw_snapshot: agent.claw_config,
      endpoint_url: endpointUrl,
      deployed_by: wallet,
      notes,
      is_active: true,
    })
    .select()
    .single()

  if (deployError || !deployment) {
    console.error('Deploy error:', deployError)
    throw Errors.database('Failed to create deployment')
  }

  // 7. Generate API key with PBKDF2 hashing (only for first deployment or prod)
  let apiKey: string | null = null

  // Check if agent already has active API keys
  const { count: existingKeyCount } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('is_active', true)

  // Only generate new key if no active keys exist
  if ((existingKeyCount || 0) === 0) {
    apiKey = generateApiKey()
    const { hash: keyHash, salt: keySalt, prefix: keyPrefix } = await hashNewApiKey(apiKey)

    const { error: keyError } = await supabase.from('api_keys').insert({
      agent_id: agentId,
      name: 'Default',
      key_hash: keyHash,
      key_salt: keySalt,
      key_prefix: keyPrefix,
      rate_limit: 100,
      is_active: true,
    })

    if (keyError) {
      console.error('API key creation error:', keyError)
      // Rollback deployment
      await supabase.from('deployments').delete().eq('id', deployment.id)
      throw Errors.database('Failed to generate API key')
    }
  }

  // 8. Update agent status and version
  const agentStatus = environment === 'prod' ? 'deployed' : 'testing'
  await supabase
    .from('agents')
    .update({
      status: agentStatus,
      version: newVersion,
    })
    .eq('id', agentId)

  const response: Record<string, unknown> = {
    success: true,
    deployment_id: deployment.id,
    environment,
    version: newVersion,
    endpoint_url: endpointUrl,
    message: `Agent deployed to ${environment} successfully.`,
    ...(warnings.length > 0 && { warnings }),
  }

  // Only include api_key if we generated a new one
  if (apiKey) {
    response.api_key = apiKey
    response.message = `Agent deployed to ${environment} successfully. Save your API key - it will only be shown once.`
  }

  return c.json(response)
})

// DELETE /deploy/:id - Stop a deployment in a specific environment
// Requires authentication + wallet rate limiting
// Query: ?environment=dev|staging|prod (default: prod)
deployRoutes.delete('/:id', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const wallet = c.get('wallet')
  const environment = (c.req.query('environment') as Environment) || 'prod'

  // Validate environment
  if (!['dev', 'staging', 'prod'].includes(environment)) {
    return c.json({ error: 'Invalid environment. Must be dev, staging, or prod.' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Stop active deployment in the specified environment
  const { data: deployment, error } = await supabase
    .from('deployments')
    .update({
      status: 'stopped',
      stopped_at: new Date().toISOString(),
      is_active: false,
    })
    .eq('agent_id', agentId)
    .eq('environment', environment)
    .eq('status', 'running')
    .eq('is_active', true)
    .select()
    .single()

  if (error || !deployment) {
    return c.json({ error: `No active deployment found in ${environment}` }, 404)
  }

  // Check if there are any remaining active deployments in prod
  const { data: remainingProdDeployments } = await supabase
    .from('deployments')
    .select('id')
    .eq('agent_id', agentId)
    .eq('environment', 'prod')
    .eq('status', 'running')
    .eq('is_active', true)
    .limit(1)

  // Only deactivate API keys if stopping prod and no other prod deployments
  if (environment === 'prod' && !remainingProdDeployments?.length) {
    await supabase.from('api_keys').update({ is_active: false }).eq('agent_id', agentId)

    // Update agent status to draft only if no prod deployment
    await supabase.from('agents').update({ status: 'draft' }).eq('id', agentId)
  }

  return c.json({
    success: true,
    environment,
    message: `Deployment in ${environment} stopped successfully.`,
  })
})

// GET /deploy/:id - Get deployment status for all environments or a specific one
// Requires authentication + wallet rate limiting
// Query: ?environment=dev|staging|prod (optional, returns all if not specified)
deployRoutes.get('/:id', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const wallet = c.get('wallet')
  const environmentFilter = c.req.query('environment') as Environment | undefined

  // Validate environment if provided
  if (environmentFilter && !['dev', 'staging', 'prod'].includes(environmentFilter)) {
    return c.json({ error: 'Invalid environment. Must be dev, staging, or prod.' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get active deployments (optionally filtered by environment)
  let deploymentsQuery = supabase
    .from('deployments')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'running')
    .eq('is_active', true)

  if (environmentFilter) {
    deploymentsQuery = deploymentsQuery.eq('environment', environmentFilter)
  }

  const { data: deployments } = await deploymentsQuery.order('created_at', { ascending: false })

  // Get active API keys (prefix only, not full key)
  const { data: apiKeys } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, rate_limit, is_active, created_at, last_used_at')
    .eq('agent_id', agentId)
    .eq('is_active', true)

  // Format deployments by environment
  const environmentDeployments: Record<string, unknown> = {}
  const environments: Environment[] = ['dev', 'staging', 'prod']

  for (const env of environments) {
    const envDeployment = deployments?.find((d) => d.environment === env)
    environmentDeployments[env] = envDeployment
      ? {
          id: envDeployment.id,
          version: envDeployment.version,
          status: envDeployment.status,
          endpoint_url: envDeployment.endpoint_url,
          deployed_by: envDeployment.deployed_by,
          notes: envDeployment.notes,
          created_at: envDeployment.created_at,
        }
      : null
  }

  // For backward compatibility, also include "deployment" as the prod deployment
  const prodDeployment = deployments?.find((d) => d.environment === 'prod')

  return c.json({
    deployed: !!prodDeployment,
    deployment: prodDeployment
      ? {
          id: prodDeployment.id,
          version: prodDeployment.version,
          status: prodDeployment.status,
          endpoint_url: prodDeployment.endpoint_url,
          environment: prodDeployment.environment,
          deployed_by: prodDeployment.deployed_by,
          notes: prodDeployment.notes,
          created_at: prodDeployment.created_at,
        }
      : null,
    environments: environmentDeployments,
    api_keys: apiKeys || [],
  })
})

// POST /deploy/:id/keys - Generate additional API key
// Requires authentication + wallet rate limiting
deployRoutes.post('/:id/keys', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const wallet = c.get('wallet')

  const body = await c.req.json()
  const name = body.name || `Key ${Date.now()}`

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership and deployment
  const { data: agent } = await supabase
    .from('agents')
    .select('id, status')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  if (agent.status !== 'deployed') {
    return c.json({ error: 'Agent must be deployed to create API keys' }, 400)
  }

  // Check key limit (max 5 active keys per agent)
  const { count } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)
    .eq('is_active', true)

  if ((count || 0) >= 5) {
    return c.json({ error: 'Maximum 5 active API keys per agent. Revoke unused keys first.' }, 403)
  }

  // Generate new key with PBKDF2 hashing
  const apiKey = generateApiKey()
  const { hash: keyHash, salt: keySalt, prefix: keyPrefix } = await hashNewApiKey(apiKey)

  const { data: keyRecord, error } = await supabase
    .from('api_keys')
    .insert({
      agent_id: agentId,
      name,
      key_hash: keyHash,
      key_salt: keySalt, // PBKDF2 salt
      key_prefix: keyPrefix,
      rate_limit: 100,
      is_active: true,
    })
    .select()
    .single()

  if (error || !keyRecord) {
    throw Errors.database('Failed to create API key')
  }

  return c.json({
    success: true,
    key_id: keyRecord.id,
    api_key: apiKey, // Only shown once!
    message: 'API key created. Save it - it will only be shown once.',
  })
})

// DELETE /deploy/:id/keys/:keyId - Revoke API key
// Requires authentication + wallet rate limiting
deployRoutes.delete('/:id/keys/:keyId', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const keyId = c.req.param('keyId')
  const wallet = c.get('wallet')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Revoke key
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', keyId)
    .eq('agent_id', agentId)

  if (error) {
    throw Errors.database('Failed to revoke API key')
  }

  return c.json({ success: true, message: 'API key revoked' })
})

// ============================================
// DEPLOYMENT HISTORY & ROLLBACK ENDPOINTS
// ============================================

// GET /deploy/:id/history - Get deployment history
// Requires authentication + wallet rate limiting
// Query: ?environment=dev|staging|prod, ?limit=50, ?offset=0
deployRoutes.get('/:id/history', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const wallet = c.get('wallet')

  // Parse and validate query params
  const queryResult = historyQuerySchema.safeParse({
    environment: c.req.query('environment'),
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!queryResult.success) {
    return c.json({ error: 'Invalid query parameters', details: queryResult.error.flatten() }, 400)
  }

  const { environment, limit, offset } = queryResult.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Build query for deployment history
  let query = supabase
    .from('deployments')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (environment) {
    query = query.eq('environment', environment)
  }

  const { data: deployments, error } = await query

  if (error) {
    console.error('Error fetching deployment history:', error)
    throw Errors.database('Failed to fetch deployment history')
  }

  // Get total count for pagination
  let countQuery = supabase
    .from('deployments')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agentId)

  if (environment) {
    countQuery = countQuery.eq('environment', environment)
  }

  const { count } = await countQuery

  // Format deployments
  const formattedDeployments = deployments?.map((d) => ({
    id: d.id,
    version: d.version,
    environment: d.environment,
    status: d.status,
    endpoint_url: d.endpoint_url,
    deployed_by: d.deployed_by,
    rollback_from: d.rollback_from,
    promoted_from: d.promoted_from,
    notes: d.notes,
    is_active: d.is_active,
    created_at: d.created_at,
    stopped_at: d.stopped_at,
  }))

  return c.json({
    deployments: formattedDeployments || [],
    pagination: {
      total: count || 0,
      limit,
      offset,
      has_more: (count || 0) > offset + limit,
    },
  })
})

// GET /deploy/:id/stats - Get deployment statistics per environment
// Requires authentication + wallet rate limiting
deployRoutes.get('/:id/stats', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const wallet = c.get('wallet')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get all deployments grouped by environment
  const { data: deployments, error } = await supabase
    .from('deployments')
    .select('id, environment, status, is_active, rollback_from, promoted_from, created_at')
    .eq('agent_id', agentId)

  if (error) {
    console.error('Error fetching deployment stats:', error)
    throw Errors.database('Failed to fetch deployment stats')
  }

  // Calculate stats per environment
  const environments: Environment[] = ['dev', 'staging', 'prod']
  const stats: Record<string, unknown> = {}

  for (const env of environments) {
    const envDeployments = deployments?.filter((d) => d.environment === env) || []
    const activeDeployment = envDeployments.find((d) => d.is_active && d.status === 'running')

    stats[env] = {
      total_deployments: envDeployments.length,
      active_deployment_id: activeDeployment?.id || null,
      has_active: !!activeDeployment,
      last_deployment_at:
        envDeployments.length > 0
          ? envDeployments.reduce((latest, d) =>
              new Date(d.created_at) > new Date(latest.created_at) ? d : latest
            ).created_at
          : null,
      rollback_count: envDeployments.filter((d) => d.rollback_from).length,
      promote_count: envDeployments.filter((d) => d.promoted_from).length,
    }
  }

  return c.json({
    agent_id: agentId,
    stats,
  })
})

// POST /deploy/:id/rollback/:deploymentId - Rollback to a previous deployment
// Requires authentication + wallet rate limiting
// Body: { notes?: string }
deployRoutes.post(
  '/:id/rollback/:deploymentId',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('id')
    const deploymentId = c.req.param('deploymentId')
    const wallet = c.get('wallet')

    // Parse body
    let notes: string | undefined
    try {
      const body = await c.req.json().catch(() => ({}))
      const result = rollbackSchema.safeParse(body)
      if (result.success) {
        notes = result.data.notes
      }
    } catch {
      // Ignore parse errors, notes is optional
    }

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify ownership
    const { data: agent } = await supabase
      .from('agents')
      .select('id, version')
      .eq('id', agentId)
      .eq('wallet_address', wallet)
      .single()

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Get source deployment
    const { data: sourceDeployment, error: sourceError } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .eq('agent_id', agentId)
      .single()

    if (sourceError || !sourceDeployment) {
      return c.json({ error: 'Deployment not found' }, 404)
    }

    const environment = sourceDeployment.environment as Environment

    // Deactivate current deployment in same environment
    await supabase
      .from('deployments')
      .update({
        is_active: false,
        stopped_at: new Date().toISOString(),
        status: 'stopped',
      })
      .eq('agent_id', agentId)
      .eq('environment', environment)
      .eq('is_active', true)

    // Create new deployment as rollback
    const newVersion = (agent.version || 0) + 1
    const { data: newDeployment, error: createError } = await supabase
      .from('deployments')
      .insert({
        agent_id: agentId,
        version: newVersion,
        environment,
        status: 'running',
        config_snapshot: sourceDeployment.config_snapshot,
        flow_snapshot: sourceDeployment.flow_snapshot,
        claw_snapshot: sourceDeployment.claw_snapshot,
        endpoint_url: sourceDeployment.endpoint_url,
        deployed_by: wallet,
        rollback_from: deploymentId,
        notes: notes || `Rollback from deployment v${sourceDeployment.version}`,
        is_active: true,
      })
      .select()
      .single()

    if (createError || !newDeployment) {
      console.error('Rollback error:', createError)
      return c.json({ error: 'Failed to create rollback deployment' }, 500)
    }

    // Update agent version
    await supabase
      .from('agents')
      .update({ version: newVersion, updated_at: new Date().toISOString() })
      .eq('id', agentId)

    return c.json({
      success: true,
      deployment_id: newDeployment.id,
      environment,
      version: newVersion,
      rolled_back_from: deploymentId,
      message: `Successfully rolled back to deployment v${sourceDeployment.version} in ${environment}.`,
    })
  }
)

// POST /deploy/:id/promote - Promote a deployment to another environment
// Requires authentication + wallet rate limiting
// Body: { source_deployment_id: string, target_environment: 'staging' | 'prod', notes?: string }
deployRoutes.post('/:id/promote', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const agentId = c.req.param('id')
  const wallet = c.get('wallet')

  // Parse and validate body
  let body: z.infer<typeof promoteSchema>
  try {
    const rawBody = await c.req.json()
    body = promoteSchema.parse(rawBody)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return c.json({ error: 'Invalid request', details: err.flatten() }, 400)
    }
    return c.json({ error: 'Invalid request body' }, 400)
  }

  const { source_deployment_id, target_environment, notes } = body

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: agent } = await supabase
    .from('agents')
    .select('id, version')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (!agent) {
    return c.json({ error: 'Agent not found' }, 404)
  }

  // Get source deployment
  const { data: sourceDeployment, error: sourceError } = await supabase
    .from('deployments')
    .select('*')
    .eq('id', source_deployment_id)
    .eq('agent_id', agentId)
    .single()

  if (sourceError || !sourceDeployment) {
    return c.json({ error: 'Source deployment not found' }, 404)
  }

  const sourceEnvironment = sourceDeployment.environment as Environment

  // Validate promotion path
  if (sourceEnvironment === 'prod') {
    return c.json({ error: 'Cannot promote from prod environment' }, 400)
  }

  // Note: target_environment can only be 'staging' or 'prod' (validated by Zod schema)

  if (sourceEnvironment === target_environment) {
    return c.json({ error: 'Source and target environments must be different' }, 400)
  }

  // Deactivate current deployment in target environment
  await supabase
    .from('deployments')
    .update({
      is_active: false,
      stopped_at: new Date().toISOString(),
      status: 'stopped',
    })
    .eq('agent_id', agentId)
    .eq('environment', target_environment)
    .eq('is_active', true)

  // Create new deployment as promotion
  const newVersion = (agent.version || 0) + 1
  const { data: newDeployment, error: createError } = await supabase
    .from('deployments')
    .insert({
      agent_id: agentId,
      version: newVersion,
      environment: target_environment,
      status: 'running',
      config_snapshot: sourceDeployment.config_snapshot,
      flow_snapshot: sourceDeployment.flow_snapshot,
      claw_snapshot: sourceDeployment.claw_snapshot,
      endpoint_url: sourceDeployment.endpoint_url,
      deployed_by: wallet,
      promoted_from: source_deployment_id,
      notes: notes || `Promoted from ${sourceEnvironment} v${sourceDeployment.version}`,
      is_active: true,
    })
    .select()
    .single()

  if (createError || !newDeployment) {
    console.error('Promote error:', createError)
    return c.json({ error: 'Failed to create promoted deployment' }, 500)
  }

  // Update agent version and status
  const agentStatus = target_environment === 'prod' ? 'deployed' : 'testing'
  await supabase
    .from('agents')
    .update({
      version: newVersion,
      status: agentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)

  return c.json({
    success: true,
    deployment_id: newDeployment.id,
    source_environment: sourceEnvironment,
    target_environment,
    version: newVersion,
    promoted_from: source_deployment_id,
    message: `Successfully promoted from ${sourceEnvironment} to ${target_environment}.`,
  })
})

// GET /deploy/:id/history/:deploymentId - Get a specific deployment details
// Requires authentication + wallet rate limiting
deployRoutes.get(
  '/:id/history/:deploymentId',
  authMiddleware,
  walletRateLimitMiddleware(),
  async (c) => {
    const agentId = c.req.param('id')
    const deploymentId = c.req.param('deploymentId')
    const wallet = c.get('wallet')

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    // Verify ownership
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('wallet_address', wallet)
      .single()

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    // Get deployment details
    const { data: deployment, error } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .eq('agent_id', agentId)
      .single()

    if (error || !deployment) {
      return c.json({ error: 'Deployment not found' }, 404)
    }

    return c.json({
      deployment: {
        id: deployment.id,
        version: deployment.version,
        environment: deployment.environment,
        status: deployment.status,
        config_snapshot: deployment.config_snapshot,
        flow_snapshot: deployment.flow_snapshot,
        claw_snapshot: deployment.claw_snapshot,
        endpoint_url: deployment.endpoint_url,
        deployed_by: deployment.deployed_by,
        rollback_from: deployment.rollback_from,
        promoted_from: deployment.promoted_from,
        notes: deployment.notes,
        is_active: deployment.is_active,
        created_at: deployment.created_at,
        stopped_at: deployment.stopped_at,
      },
    })
  }
)
