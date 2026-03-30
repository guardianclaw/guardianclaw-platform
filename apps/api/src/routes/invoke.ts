import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import { createRateLimiter } from '../lib/rate-limiter'
import { verifyApiKey } from '../lib/api-key-hash'
import { queueKeyMigration, needsMigration } from '../lib/api-key-migration'
import {
  execute,
  extractAnalyticsFields,
  type ExecutionOptions,
  type ExecutionResult,
} from '../services/execution'
import { logExecution } from '../services/execution-logger'
import {
  deductCredits,
  refundCredits,
  COST_PER_EXECUTION,
  COST_PER_EXECUTION_BYOK,
} from '../services/credits'
import { IdempotencyLayer, generateAutoKey } from '../lib/idempotency'
import { buildCharacterPrompt, type CharacterConfig } from './character'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string // For tool credentials
  MODAL_RUNTIME_URL?: string
  OPENAI_API_KEY?: string // Server-side OpenAI key
  RATE_LIMIT_KV?: KVNamespace
}

export const invokeRoutes = new Hono<{ Bindings: Bindings }>()

// Request schema
const invokeSchema = z.object({
  message: z.string().min(1).max(10000),
  options: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      max_tokens: z.number().min(1).max(16000).optional(),
    })
    .optional(),
})

// POST /invoke/:id - Public agent invocation
// Authentication via X-API-Key header
// Optional X-LLM-Key header for BYOK (user's own LLM key)
invokeRoutes.post('/:id', async (c) => {
  const agentId = c.req.param('id')
  const apiKey = c.req.header('X-API-Key')
  const userLlmKey = c.req.header('X-LLM-Key') // BYOK support

  // 1. Validate API key presence
  if (!apiKey) {
    return c.json(
      {
        error: 'Missing API key',
        hint: 'Provide your API key in the X-API-Key header',
      },
      401
    )
  }

  // Validate API key format
  if (!apiKey.startsWith('sk_live_') || apiKey.length !== 72) {
    return c.json({ error: 'Invalid API key format' }, 401)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // 2. Verify API key
  // First, find candidates by prefix and agent_id (efficient DB lookup)
  const keyPrefix = apiKey.slice(0, 15)

  const { data: keyCandidates, error: keyError } = await supabase
    .from('api_keys')
    .select(
      `
      id,
      agent_id,
      key_hash,
      key_salt,
      rate_limit,
      is_active,
      agents (
        id,
        wallet_address,
        flow,
        config,
        claw_config,
        status
      )
    `
    )
    .eq('key_prefix', keyPrefix)
    .eq('agent_id', agentId)

  if (keyError || !keyCandidates || keyCandidates.length === 0) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  // Verify the key against candidates (supports both PBKDF2 and legacy SHA-256)
  let keyRecord: (typeof keyCandidates)[0] | null = null
  for (const candidate of keyCandidates) {
    const isValid = await verifyApiKey(apiKey, candidate.key_hash, candidate.key_salt || null)
    if (isValid) {
      keyRecord = candidate
      break
    }
  }

  if (!keyRecord) {
    return c.json({ error: 'Invalid API key' }, 401)
  }

  if (!keyRecord.is_active) {
    return c.json({ error: 'API key has been revoked' }, 401)
  }

  // Check if key needs migration from legacy SHA-256 to PBKDF2
  if (needsMigration(keyRecord.key_salt)) {
    // Queue migration with retry and monitoring (non-blocking)
    // Type assertion needed due to Supabase client type complexity
    queueKeyMigration(
      supabase as unknown as Parameters<typeof queueKeyMigration>[0],
      apiKey,
      keyRecord.id,
      agentId
    )
  }

  // Type assertion for the joined agent data
  const agent = keyRecord.agents as unknown as {
    id: string
    wallet_address: string
    flow: { nodes?: unknown[]; edges?: unknown[] }
    config: Record<string, unknown>
    claw_config: { protection_level?: string; gates?: Record<string, boolean> }
    status: string
  }

  if (!agent || agent.status !== 'deployed') {
    return c.json({ error: 'Agent is not deployed' }, 400)
  }

  // 2b. Fetch active deployment snapshot (immutable config at deploy time)
  // Use snapshot instead of live agent.flow to prevent post-deploy edits from affecting production
  const { data: activeDeployment, error: deployError } = await supabase
    .from('deployments')
    .select('flow_snapshot, claw_snapshot, config_snapshot, environment')
    .eq('agent_id', agentId)
    .eq('is_active', true)
    .eq('status', 'running')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Log when snapshot query fails (network/DB error, not just missing deployment)
  // PGRST116 = no rows found, which is expected when agent has no active deployment
  if (deployError && deployError.code !== 'PGRST116') {
    console.warn(
      `[invoke] Deploy snapshot query failed for agent ${agentId}, falling back to live config:`,
      deployError.message
    )
  }

  // Use deployment snapshot if available, otherwise fallback to live agent config
  const effectiveFlow = (activeDeployment?.flow_snapshot || agent.flow) as {
    nodes?: unknown[]
    edges?: unknown[]
  }
  const effectiveClawConfig = (activeDeployment?.claw_snapshot || agent.claw_config) as {
    protection_level?: string
    gates?: Record<string, boolean>
  }

  // 3. Check rate limit first (before any charges)
  const rateLimit = keyRecord.rate_limit || 100
  const rateLimiter = createRateLimiter(c.env.RATE_LIMIT_KV || null, 'invoke:')
  const { allowed, remaining, retryAfter } = await rateLimiter.checkLimit(
    keyRecord.id,
    rateLimit,
    60_000 // 1 minute window
  )

  // Set rate limit headers
  c.header('X-RateLimit-Limit', rateLimit.toString())
  c.header('X-RateLimit-Remaining', Math.max(0, remaining).toString())

  if (!allowed) {
    c.header('Retry-After', (retryAfter || 60).toString())
    return c.json(
      {
        error: 'Rate limit exceeded',
        limit: rateLimit,
        retry_after: retryAfter || 60,
      },
      429
    )
  }

  // 4. Parse request body (validate before charging)
  const body = await c.req.json()
  const parsed = invokeSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const { message, options } = parsed.data

  // 5. Idempotency check (prevent duplicate executions and charges)
  const idempotencyKeyHeader = c.req.header('Idempotency-Key')
  const idempotencyKey =
    idempotencyKeyHeader || (await generateAutoKey(keyRecord.id, agentId, JSON.stringify(body)))
  const idempotency = new IdempotencyLayer(c.env.RATE_LIMIT_KV || null)

  const existingEntry = await idempotency.check(idempotencyKey)
  if (existingEntry) {
    if (existingEntry.status === 'complete' && existingEntry.response) {
      c.header('X-Idempotent-Replay', 'true')
      return c.json(
        existingEntry.response as Record<string, unknown>,
        (existingEntry.statusCode || 200) as 200
      )
    }
    if (existingEntry.status === 'processing') {
      c.header('Retry-After', '5')
      return c.json({ error: 'Request already in progress', code: 'DUPLICATE_REQUEST' }, 409)
    }
  }

  await idempotency.markProcessing(idempotencyKey)

  // 6. Check and deduct credits (after rate limit + idempotency)
  const cost = userLlmKey ? COST_PER_EXECUTION_BYOK : COST_PER_EXECUTION
  const creditResult = await deductCredits(supabase, agent.wallet_address, cost)

  if (!creditResult.success) {
    await idempotency.remove(idempotencyKey)
    const errorCode = creditResult.error || 'INSUFFICIENT_CREDITS'
    const errorMessage =
      errorCode === 'NO_CREDITS_ACCOUNT'
        ? 'No credits account found. Please deposit credits to continue.'
        : 'Insufficient credits. Please deposit more credits to continue.'

    return c.json(
      {
        error: errorMessage,
        code: errorCode,
        balance_usd: creditResult.new_balance,
        required_usd: cost,
        hint: 'Deposit credits at /credits/deposit',
        pricing: {
          cost_per_execution: cost,
          minimum_deposit: 3.0,
        },
      },
      402 // Payment Required
    )
  }

  // Store balance info for analytics
  const balanceBefore = creditResult.balance_before
  let balanceAfter = creditResult.new_balance

  // 7. Execute agent using centralized execution service
  const startTime = Date.now()

  // Build character prompt if agent has character config
  const agentConfig = agent.config as Record<string, unknown> | undefined
  const characterConfig = agentConfig?.character as CharacterConfig | undefined
  const characterPrompt = characterConfig ? buildCharacterPrompt(characterConfig) : undefined

  const executionOptions: ExecutionOptions = {
    modalEndpoint: c.env.MODAL_RUNTIME_URL,
    openaiKey: c.env.OPENAI_API_KEY,
    userLlmKey, // BYOK support
    flow: effectiveFlow,
    message,
    clawConfig: effectiveClawConfig,
    llmConfig: {
      model: (agent.config.model as string) || 'gpt-4o-mini',
      temperature: options?.temperature ?? (agent.config.temperature as number) ?? 0.7,
      maxTokens: options?.max_tokens ?? (agent.config.maxTokens as number) ?? 1024,
    },
    characterPrompt,
    toolCredentials: {
      supabase,
      walletAddress: agent.wallet_address,
      serverSecret: c.env.JWT_SECRET,
    },
    socialContext: {
      supabase,
      agentId: agent.id,
      agentName: undefined,
      serverSecret: c.env.JWT_SECRET,
    },
    kvNamespace: c.env.RATE_LIMIT_KV || null, // For circuit breaker
  }

  let result: ExecutionResult
  try {
    result = await execute(executionOptions)
  } catch (execError) {
    // Refund credits on execution failure
    const refundResult = await refundCredits(
      supabase,
      agent.wallet_address,
      cost,
      `execution_error: ${execError instanceof Error ? execError.message : 'unknown'}`
    )
    if (refundResult.success) balanceAfter = refundResult.new_balance
    await idempotency.remove(idempotencyKey)
    console.error(`[invoke] Execution failed for agent ${agentId}:`, execError)
    return c.json(
      {
        error: 'Execution failed',
        message: 'An internal error occurred. Credits have been refunded.',
      },
      500
    )
  }

  const latencyMs = result.latency_ms || Date.now() - startTime

  // 7b. Reject simulated responses in production invoke + refund credits
  if (result.isSimulated) {
    const refundResult = await refundCredits(
      supabase,
      agent.wallet_address,
      cost,
      'simulated_response'
    )
    if (refundResult.success) balanceAfter = refundResult.new_balance
    await idempotency.remove(idempotencyKey)
    console.error(
      `[invoke] Simulation fallback triggered for agent ${agentId} — no LLM backend available`
    )
    c.header('Retry-After', '60')
    return c.json(
      {
        error: 'service_unavailable',
        message:
          'Agent execution backend is temporarily unavailable. Credits have been refunded. Please try again later.',
        retry_after: 60,
      },
      503
    )
  }

  // 8. Update API key last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)

  // 9. Log event with v2 analytics fields (metadata only, no content per SECURITY_SPEC)
  // Ensure latency is set on result for analytics
  result.latency_ms = latencyMs
  const analyticsFields = extractAnalyticsFields(agentId, 'invoke', result, {
    inputTokensEstimate: Math.ceil(message.length / 4),
    outputTokensEstimate: result.response ? Math.ceil(result.response.length / 4) : 0,
  })

  // Add credit tracking fields
  await supabase.from('agent_events').insert({
    ...analyticsFields,
    cost_usd: cost,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
  })

  // 9.1 Log execution with trace for debugging (non-blocking)
  logExecution({
    supabase,
    agentId,
    eventSource: 'invoke',
    inputText: message,
    result,
  }).catch((err) => console.error('Failed to log execution:', err))

  // 10. Update daily usage
  const today = new Date().toISOString().split('T')[0]

  // Try to update existing record, or insert new one
  const { error: usageError } = await supabase.rpc('increment_usage', {
    p_agent_id: agentId,
    p_date: today,
    p_blocked: result.blocked,
    p_latency: latencyMs,
  })

  // If RPC doesn't exist, fallback to manual upsert
  if (usageError) {
    // Get wallet address from agent for usage tracking
    const { data: agentData } = await supabase
      .from('agents')
      .select('wallet_address')
      .eq('id', agentId)
      .single()

    if (agentData) {
      await supabase.from('usage_daily').upsert(
        {
          wallet_address: agentData.wallet_address,
          agent_id: agentId,
          date: today,
          requests_count: 1,
          blocked_count: result.blocked ? 1 : 0,
          total_latency_ms: latencyMs,
        },
        {
          onConflict: 'wallet_address,agent_id,date',
          ignoreDuplicates: false,
        }
      )
    }
  }

  // 11. Return result (and cache for idempotency)
  if (result.blocked) {
    const responseBody = {
      success: false,
      blocked: true,
      gate: result.gate,
      reason: result.reason || 'Request blocked by GuardianClaw',
      latency_ms: latencyMs,
      credits: {
        cost,
        balance_after: balanceAfter,
      },
    }
    await idempotency.markComplete(idempotencyKey, responseBody, 200)
    return c.json(responseBody, 200)
  }

  const responseBody = {
    success: true,
    response: result.response,
    claw: {
      input_passed: result.claw?.input?.passed ?? true,
      output_passed: result.claw?.output?.passed ?? true,
    },
    latency_ms: latencyMs,
    credits: {
      cost,
      balance_after: balanceAfter,
    },
  }
  await idempotency.markComplete(idempotencyKey, responseBody, 200)
  return c.json(responseBody)
})

// GET /invoke/:id/health - Public health check for deployed agent
invokeRoutes.get('/:id/health', async (c) => {
  const agentId = c.req.param('id')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data: deployment } = await supabase
    .from('deployments')
    .select('id, status, created_at')
    .eq('agent_id', agentId)
    .eq('status', 'running')
    .single()

  if (!deployment) {
    return c.json({ status: 'not_deployed' }, 404)
  }

  return c.json({
    status: 'healthy',
    agent_id: agentId,
    deployment_id: deployment.id,
    deployed_at: deployment.created_at,
  })
})
