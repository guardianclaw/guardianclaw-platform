/**
 * Agent Export/Import API Routes
 *
 * Provides functionality to export and import agent configurations.
 * Supports ElizaOS character.json format and full GuardianClaw config.
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
}

type Variables = {
  wallet: string
  plan: string
}

export const agentExportRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware to all routes
agentExportRoutes.use('*', authMiddleware)
agentExportRoutes.use('*', walletRateLimitMiddleware())

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

// ElizaOS character.json format
const elizaOSCharacterSchema = z.object({
  name: z.string(),
  clients: z.array(z.string()).optional(),
  modelProvider: z.string().optional(),
  settings: z
    .object({
      secrets: z.record(z.string()).optional(),
      voice: z
        .object({
          model: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  system: z.string().optional(),
  bio: z.union([z.string(), z.array(z.string())]).optional(),
  lore: z.array(z.string()).optional(),
  messageExamples: z
    .array(
      z.array(
        z.object({
          user: z.string(),
          content: z.object({
            text: z.string(),
          }),
        })
      )
    )
    .optional(),
  postExamples: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  adjectives: z.array(z.string()).optional(),
  knowledge: z.array(z.string()).optional(),
  style: z
    .object({
      all: z.array(z.string()).optional(),
      chat: z.array(z.string()).optional(),
      post: z.array(z.string()).optional(),
    })
    .optional(),
})

// GuardianClaw export format
const clawExportSchema = z.object({
  version: z.string(),
  exported_at: z.string(),
  agent: z.object({
    name: z.string(),
    description: z.string().optional().nullable(),
    framework: z.string(),
    icon: z.string().optional(),
  }),
  character: z.record(z.unknown()).optional(),
  flow: z
    .object({
      nodes: z.array(z.unknown()),
      edges: z.array(z.unknown()),
    })
    .optional(),
  claw_config: z.record(z.unknown()).optional(),
  integration_config: z.record(z.unknown()).optional(),
})

// Import options
const importOptionsSchema = z.object({
  format: z.enum(['claw', 'elizaos']).default('claw'),
  merge: z.boolean().default(false), // Merge with existing or replace
  include_flow: z.boolean().default(true),
  include_claw: z.boolean().default(true),
})

// ===========================================
// HELPERS
// ===========================================

async function verifyAgentOwnership(
  supabase: SupabaseClient,
  agentId: string,
  wallet: string
): Promise<{ success: boolean; agent?: Record<string, unknown>; error?: string }> {
  const { data: agent, error } = await supabase
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !agent) {
    return { success: false, error: 'Agent not found' }
  }

  return { success: true, agent }
}

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /agents/:agentId/export
 * Export agent configuration as JSON.
 * Query params:
 *   - format: 'claw' (default) or 'elizaos'
 *   - include_flow: true/false (default true)
 *   - include_claw: true/false (default true)
 */
agentExportRoutes.get('/:agentId/export', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')
  const format = c.req.query('format') || 'claw'
  const includeFlow = c.req.query('include_flow') !== 'false'
  const includeGuardianClaw = c.req.query('include_claw') !== 'false'

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  const agent = agentCheck.agent! as {
    id: string
    name: string
    description: string | null
    framework: string
    icon: string
    flow: { nodes: unknown[]; edges: unknown[] }
    config: Record<string, unknown>
    claw_config: Record<string, unknown>
    integration_config?: Record<string, unknown>
  }

  if (format === 'elizaos') {
    // Export in ElizaOS character.json format
    const character = (agent.config?.character || {}) as {
      name?: string
      personality?: string
      bio?: string
      topics?: string[]
      forbidden_topics?: string[]
      adjectives?: string[]
      knowledge?: string[]
      examples?: Array<{ user: string; assistant: string }>
    }

    const elizaOSCharacter = {
      name: character.name || agent.name,
      clients: [],
      modelProvider: 'openai',
      settings: {
        secrets: {},
        voice: { model: '' },
      },
      system: character.personality || '',
      bio: character.bio ? [character.bio] : [],
      lore: [],
      messageExamples:
        character.examples?.map((ex) => [
          { user: '{{user1}}', content: { text: ex.user } },
          { user: character.name || agent.name, content: { text: ex.assistant } },
        ]) || [],
      postExamples: [],
      topics: character.topics || [],
      adjectives: character.adjectives || [],
      knowledge: character.knowledge || [],
      style: {
        all: [],
        chat: [],
        post: [],
      },
    }

    // Set content type for download
    c.header(
      'Content-Disposition',
      `attachment; filename="${agent.name.replace(/[^a-z0-9]/gi, '_')}_character.json"`
    )
    c.header('Content-Type', 'application/json')

    return c.json(elizaOSCharacter)
  }

  // Default: GuardianClaw format
  const clawExport = {
    version: '1.0',
    format: 'claw',
    exported_at: new Date().toISOString(),
    agent: {
      name: agent.name,
      description: agent.description,
      framework: agent.framework,
      icon: agent.icon,
    },
    character: agent.config?.character || null,
    memory_integrity: agent.config?.memory_integrity || null,
    ...(includeFlow && {
      flow: agent.flow,
    }),
    ...(includeGuardianClaw && {
      claw_config: agent.claw_config,
    }),
    integration_config: agent.integration_config || null,
  }

  // Set content type for download
  c.header(
    'Content-Disposition',
    `attachment; filename="${agent.name.replace(/[^a-z0-9]/gi, '_')}_claw.json"`
  )
  c.header('Content-Type', 'application/json')

  return c.json(clawExport)
})

/**
 * POST /agents/:agentId/import
 * Import agent configuration from JSON.
 */
agentExportRoutes.post('/:agentId/import', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const body = await c.req.json().catch(() => null)

  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  // Parse options from query or body
  const options = importOptionsSchema.safeParse({
    format: c.req.query('format') || body._options?.format || detectFormat(body),
    merge: c.req.query('merge') === 'true' || body._options?.merge || false,
    include_flow: c.req.query('include_flow') !== 'false',
    include_claw: c.req.query('include_claw') !== 'false',
  })

  if (!options.success) {
    return c.json({ error: 'Invalid import options', details: options.error.flatten() }, 400)
  }

  const { format, merge, include_flow, include_claw } = options.data

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  const agent = agentCheck.agent! as {
    config: Record<string, unknown>
    flow: { nodes: unknown[]; edges: unknown[] }
    claw_config: Record<string, unknown>
  }

  const updateData: Record<string, unknown> = {}

  if (format === 'elizaos') {
    // Import ElizaOS character.json format
    const parsed = elizaOSCharacterSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid ElizaOS character format',
          details: parsed.error.flatten(),
        },
        400
      )
    }

    const elizaOS = parsed.data

    // Convert to GuardianClaw character format
    const character = {
      name: elizaOS.name,
      personality: elizaOS.system || '',
      bio: Array.isArray(elizaOS.bio) ? elizaOS.bio.join('\n') : elizaOS.bio || '',
      topics: elizaOS.topics || [],
      forbidden_topics: [],
      adjectives: elizaOS.adjectives || [],
      knowledge: elizaOS.knowledge || [],
      examples:
        elizaOS.messageExamples
          ?.map((conv) => {
            const userMsg = conv.find((m) => m.user.includes('user'))
            const assistantMsg = conv.find((m) => !m.user.includes('user'))
            return {
              user: userMsg?.content.text || '',
              assistant: assistantMsg?.content.text || '',
            }
          })
          .filter((ex) => ex.user && ex.assistant) || [],
    }

    if (merge) {
      updateData.config = {
        ...agent.config,
        character: {
          ...(agent.config.character || {}),
          ...character,
        },
      }
    } else {
      updateData.config = {
        ...agent.config,
        character,
      }
    }
  } else {
    // Import GuardianClaw format
    const parsed = clawExportSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid GuardianClaw export format',
          details: parsed.error.flatten(),
        },
        400
      )
    }

    const claw = parsed.data

    // Build update data
    if (claw.character) {
      if (merge) {
        updateData.config = {
          ...agent.config,
          character: {
            ...(agent.config.character || {}),
            ...claw.character,
          },
        }
      } else {
        updateData.config = {
          ...agent.config,
          character: claw.character,
        }
      }
    }

    if (include_flow && claw.flow) {
      updateData.flow = claw.flow
    }

    if (include_claw && claw.claw_config) {
      if (merge) {
        updateData.claw_config = {
          ...agent.claw_config,
          ...claw.claw_config,
        }
      } else {
        updateData.claw_config = claw.claw_config
      }
    }

    if (claw.integration_config) {
      updateData.integration_config = claw.integration_config
    }
  }

  // Perform update
  const { data, error } = await supabase
    .from('agents')
    .update(updateData)
    .eq('id', agentId)
    .select('id, name, framework, config, flow, claw_config')
    .single()

  if (error) {
    console.error('Import agent error:', error)
    return c.json({ error: 'Failed to import configuration' }, 500)
  }

  return c.json({
    success: true,
    format,
    merged: merge,
    agent: {
      id: data.id,
      name: data.name,
      framework: data.framework,
    },
    imported: {
      character: !!updateData.config,
      flow: !!updateData.flow,
      claw_config: !!updateData.claw_config,
    },
  })
})

/**
 * POST /agents/:agentId/import/preview
 * Preview what would be imported without actually importing.
 */
agentExportRoutes.post('/:agentId/import/preview', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const body = await c.req.json().catch(() => null)

  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const format = detectFormat(body)

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  if (format === 'elizaos') {
    const parsed = elizaOSCharacterSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        {
          valid: false,
          format,
          error: 'Invalid ElizaOS character format',
          details: parsed.error.flatten(),
        },
        400
      )
    }

    const elizaOS = parsed.data

    return c.json({
      valid: true,
      format,
      preview: {
        name: elizaOS.name,
        has_personality: !!elizaOS.system,
        has_bio: !!elizaOS.bio,
        topics_count: elizaOS.topics?.length || 0,
        adjectives_count: elizaOS.adjectives?.length || 0,
        examples_count: elizaOS.messageExamples?.length || 0,
        knowledge_count: elizaOS.knowledge?.length || 0,
      },
    })
  } else {
    const parsed = clawExportSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        {
          valid: false,
          format,
          error: 'Invalid GuardianClaw export format',
          details: parsed.error.flatten(),
        },
        400
      )
    }

    const claw = parsed.data

    return c.json({
      valid: true,
      format,
      preview: {
        version: claw.version,
        exported_at: claw.exported_at,
        agent_name: claw.agent.name,
        framework: claw.agent.framework,
        has_character: !!claw.character,
        has_flow: !!claw.flow,
        has_claw_config: !!claw.claw_config,
        flow_nodes: claw.flow?.nodes?.length || 0,
        flow_edges: claw.flow?.edges?.length || 0,
      },
    })
  }
})

/**
 * Detect the format of imported data.
 */
function detectFormat(data: Record<string, unknown>): 'claw' | 'elizaos' {
  // ElizaOS format has 'clients', 'modelProvider', 'messageExamples'
  if ('clients' in data || 'modelProvider' in data || 'messageExamples' in data) {
    return 'elizaos'
  }

  // GuardianClaw format has 'version' and 'format' fields
  if ('version' in data && ('format' in data || 'exported_at' in data)) {
    return 'claw'
  }

  // Default to claw
  return 'claw'
}

/**
 * POST /agents/import
 * Create a new agent from imported configuration.
 */
agentExportRoutes.post('/import', async (c) => {
  const wallet = c.get('wallet')

  const body = await c.req.json().catch(() => null)

  if (!body) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const format = detectFormat(body)

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  let agentData: {
    name: string
    description?: string | null
    framework: string
    icon?: string
    config: Record<string, unknown>
    flow?: { nodes: unknown[]; edges: unknown[] }
    claw_config?: Record<string, unknown>
  }

  if (format === 'elizaos') {
    const parsed = elizaOSCharacterSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid ElizaOS character format',
          details: parsed.error.flatten(),
        },
        400
      )
    }

    const elizaOS = parsed.data

    // Convert to agent data
    agentData = {
      name: elizaOS.name,
      description: Array.isArray(elizaOS.bio) ? elizaOS.bio[0] : elizaOS.bio,
      framework: 'elizaos',
      icon: 'bot',
      config: {
        character: {
          name: elizaOS.name,
          personality: elizaOS.system || '',
          bio: Array.isArray(elizaOS.bio) ? elizaOS.bio.join('\n') : elizaOS.bio || '',
          topics: elizaOS.topics || [],
          forbidden_topics: [],
          adjectives: elizaOS.adjectives || [],
          knowledge: elizaOS.knowledge || [],
          examples:
            elizaOS.messageExamples
              ?.map((conv) => {
                const userMsg = conv.find((m) => m.user.includes('user'))
                const assistantMsg = conv.find((m) => !m.user.includes('user'))
                return {
                  user: userMsg?.content.text || '',
                  assistant: assistantMsg?.content.text || '',
                }
              })
              .filter((ex) => ex.user && ex.assistant) || [],
        },
        memory_integrity: {
          enabled: true,
          verify_on_read: true,
          sign_on_write: true,
          min_trust_score: 0.5,
        },
      },
    }
  } else {
    const parsed = clawExportSchema.safeParse(body)

    if (!parsed.success) {
      return c.json(
        {
          error: 'Invalid GuardianClaw export format',
          details: parsed.error.flatten(),
        },
        400
      )
    }

    const claw = parsed.data

    agentData = {
      name: claw.agent.name,
      description: claw.agent.description,
      framework: claw.agent.framework,
      icon: claw.agent.icon || 'bot',
      config: {
        character: claw.character || {},
      },
      flow: claw.flow,
      claw_config: claw.claw_config,
    }
  }

  // Create agent
  const { data: newAgent, error } = await supabase
    .from('agents')
    .insert({
      wallet_address: wallet,
      ...agentData,
    })
    .select('id, name, framework')
    .single()

  if (error) {
    console.error('Create agent from import error:', error)
    return c.json({ error: 'Failed to create agent' }, 500)
  }

  return c.json(
    {
      success: true,
      format,
      agent: newAgent,
    },
    201
  )
})
