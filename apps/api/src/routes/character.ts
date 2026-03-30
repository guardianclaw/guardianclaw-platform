/**
 * Character API Routes
 *
 * Manages ElizaOS character configuration for agents.
 * Character config is stored in agent.config.character JSONB field.
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
  OPENAI_API_KEY?: string
}

type Variables = {
  wallet: string
  plan: string
}

export const characterRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply auth middleware to all routes
characterRoutes.use('*', authMiddleware)
characterRoutes.use('*', walletRateLimitMiddleware())

// ===========================================
// VALIDATION SCHEMAS
// ===========================================

const exampleSchema = z.object({
  user: z.string().min(1).max(1000),
  assistant: z.string().min(1).max(2000),
})

const characterSchema = z.object({
  name: z.string().min(1).max(100),
  personality: z.string().min(1).max(5000),
  bio: z.string().max(5000).optional(),
  topics: z.array(z.string().max(100)).max(50).optional(),
  forbidden_topics: z.array(z.string().max(100)).max(50).optional(),
  adjectives: z.array(z.string().max(50)).max(30).optional(),
  knowledge: z.array(z.string().max(500)).max(100).optional(),
  examples: z.array(exampleSchema).max(20).optional(),
})

const updateCharacterSchema = characterSchema.partial()

const memoryIntegritySchema = z.object({
  enabled: z.boolean().optional(),
  verify_on_read: z.boolean().optional(),
  sign_on_write: z.boolean().optional(),
  min_trust_score: z.number().min(0).max(1).optional(),
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
    .select('id, name, framework, config, claw_config')
    .eq('id', agentId)
    .eq('wallet_address', wallet)
    .single()

  if (error || !agent) {
    return { success: false, error: 'Agent not found' }
  }

  return { success: true, agent }
}

// Default character config for new ElizaOS agents
const DEFAULT_CHARACTER = {
  name: '',
  personality: '',
  bio: '',
  topics: [],
  forbidden_topics: [],
  adjectives: [],
  knowledge: [],
  examples: [],
}

const DEFAULT_MEMORY_INTEGRITY = {
  enabled: true,
  verify_on_read: true,
  sign_on_write: true,
  min_trust_score: 0.5,
}

// ===========================================
// ROUTES
// ===========================================

/**
 * GET /agents/:agentId/character
 * Get character configuration for an agent.
 */
characterRoutes.get('/:agentId/character', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  const agent = agentCheck.agent!
  const config = (agent.config || {}) as Record<string, unknown>

  // Extract character and memory_integrity from config
  const character = config.character || DEFAULT_CHARACTER
  const memoryIntegrity = config.memory_integrity || DEFAULT_MEMORY_INTEGRITY

  return c.json({
    character,
    memory_integrity: memoryIntegrity,
    framework: agent.framework,
    is_elizaos: agent.framework === 'elizaos',
  })
})

/**
 * PATCH /agents/:agentId/character
 * Update character configuration for an agent.
 */
characterRoutes.patch('/:agentId/character', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const body = await c.req.json().catch(() => ({}))

  // Validate character fields
  const characterParsed = updateCharacterSchema.safeParse(body.character || body)

  if (!characterParsed.success) {
    return c.json(
      {
        error: 'Invalid character configuration',
        details: characterParsed.error.flatten(),
      },
      400
    )
  }

  // Validate memory_integrity if provided
  let memoryIntegrityData = undefined
  if (body.memory_integrity) {
    const memoryParsed = memoryIntegritySchema.safeParse(body.memory_integrity)
    if (!memoryParsed.success) {
      return c.json(
        {
          error: 'Invalid memory integrity configuration',
          details: memoryParsed.error.flatten(),
        },
        400
      )
    }
    memoryIntegrityData = memoryParsed.data
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  const agent = agentCheck.agent!
  const currentConfig = (agent.config || {}) as Record<string, unknown>
  const currentCharacter = (currentConfig.character || {}) as Record<string, unknown>
  const currentMemoryIntegrity = (currentConfig.memory_integrity ||
    DEFAULT_MEMORY_INTEGRITY) as Record<string, unknown>

  // Merge updates with existing config
  const updatedConfig = {
    ...currentConfig,
    character: {
      ...currentCharacter,
      ...characterParsed.data,
    },
    ...(memoryIntegrityData && {
      memory_integrity: {
        ...currentMemoryIntegrity,
        ...memoryIntegrityData,
      },
    }),
  }

  // Update agent
  const { data, error } = await supabase
    .from('agents')
    .update({ config: updatedConfig })
    .eq('id', agentId)
    .select('id, name, framework, config')
    .single()

  if (error) {
    console.error('Update character error:', error)
    return c.json({ error: 'Failed to update character' }, 500)
  }

  return c.json({
    character: (data.config as Record<string, unknown>).character,
    memory_integrity: (data.config as Record<string, unknown>).memory_integrity,
  })
})

/**
 * POST /agents/:agentId/character/preview
 * Preview character personality with a test message.
 * Useful for testing personality before deploying.
 */
characterRoutes.post('/:agentId/character/preview', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const body = await c.req.json().catch(() => ({}))
  const message = body.message as string

  if (!message || typeof message !== 'string' || message.length === 0) {
    return c.json({ error: 'Message is required' }, 400)
  }

  if (message.length > 1000) {
    return c.json({ error: 'Message too long (max 1000 characters)' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  const agent = agentCheck.agent!
  const config = (agent.config || {}) as Record<string, unknown>
  const character = (config.character || {}) as {
    name?: string
    personality?: string
    bio?: string
    adjectives?: string[]
    topics?: string[]
    forbidden_topics?: string[]
    examples?: Array<{ user: string; assistant: string }>
  }

  // Build character prompt
  const characterPrompt = buildCharacterPrompt(character)

  // If no OpenAI key, return the prompt that would be used
  if (!c.env.OPENAI_API_KEY) {
    return c.json({
      preview_available: false,
      message: 'OpenAI API key not configured. Character prompt generated.',
      character_prompt: characterPrompt,
      test_message: message,
    })
  }

  try {
    // Call OpenAI to generate a preview response
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${c.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: characterPrompt },
          { role: 'user', content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI preview error:', errorText)
      return c.json(
        {
          error: 'Failed to generate preview',
          character_prompt: characterPrompt,
        },
        500
      )
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    return c.json({
      preview_available: true,
      response: data.choices[0]?.message?.content || '',
      character_prompt: characterPrompt,
      test_message: message,
      tokens_used: data.usage,
    })
  } catch (error) {
    console.error('Preview generation error:', error)
    return c.json(
      {
        error: 'Failed to generate preview',
        character_prompt: characterPrompt,
      },
      500
    )
  }
})

/**
 * Character configuration shape used by buildCharacterPrompt.
 * Exported for type-safe usage across callers.
 */
export interface CharacterConfig {
  name?: string
  personality?: string
  bio?: string
  adjectives?: string[]
  topics?: string[]
  forbidden_topics?: string[]
  examples?: Array<{ user: string; assistant: string }>
}

/**
 * Build a character system prompt from character config.
 * Exported for use by the execution engine and callers.
 */
export function buildCharacterPrompt(character: CharacterConfig): string {
  const parts: string[] = []

  // Name and identity
  if (character.name) {
    parts.push(`You are ${character.name}.`)
  }

  // Bio/background
  if (character.bio) {
    parts.push(`\nBackground:\n${character.bio}`)
  }

  // Personality
  if (character.personality) {
    parts.push(`\nPersonality:\n${character.personality}`)
  }

  // Adjectives
  if (character.adjectives && character.adjectives.length > 0) {
    parts.push(`\nYour personality traits: ${character.adjectives.join(', ')}.`)
  }

  // Topics
  if (character.topics && character.topics.length > 0) {
    parts.push(`\nYou are knowledgeable about: ${character.topics.join(', ')}.`)
  }

  // Forbidden topics
  if (character.forbidden_topics && character.forbidden_topics.length > 0) {
    parts.push(`\nYou should not discuss or engage with: ${character.forbidden_topics.join(', ')}.`)
  }

  // Examples
  if (character.examples && character.examples.length > 0) {
    parts.push('\nExample conversations:')
    for (const example of character.examples.slice(0, 5)) {
      parts.push(`User: ${example.user}\nAssistant: ${example.assistant}\n`)
    }
  }

  const prompt = parts.join('\n')

  // Cap character prompt to ~2000 tokens (~8000 chars) to avoid
  // consuming too much of the LLM context window
  const MAX_CHARACTER_CHARS = 8000
  if (prompt.length > MAX_CHARACTER_CHARS) {
    return prompt.slice(0, MAX_CHARACTER_CHARS) + '\n[character truncated]'
  }

  return prompt
}

/**
 * PUT /agents/:agentId/character
 * Replace entire character configuration.
 */
characterRoutes.put('/:agentId/character', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const body = await c.req.json().catch(() => ({}))

  // Full character validation (all required fields must be present)
  const characterParsed = characterSchema.safeParse(body.character || body)

  if (!characterParsed.success) {
    return c.json(
      {
        error: 'Invalid character configuration',
        details: characterParsed.error.flatten(),
      },
      400
    )
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  const agent = agentCheck.agent!
  const currentConfig = (agent.config || {}) as Record<string, unknown>

  // Replace character entirely
  const updatedConfig = {
    ...currentConfig,
    character: characterParsed.data,
  }

  const { data, error } = await supabase
    .from('agents')
    .update({ config: updatedConfig })
    .eq('id', agentId)
    .select('id, name, framework, config')
    .single()

  if (error) {
    console.error('Replace character error:', error)
    return c.json({ error: 'Failed to replace character' }, 500)
  }

  return c.json({
    character: (data.config as Record<string, unknown>).character,
  })
})

/**
 * DELETE /agents/:agentId/character
 * Reset character to defaults.
 */
characterRoutes.delete('/:agentId/character', async (c) => {
  const wallet = c.get('wallet')
  const agentId = c.req.param('agentId')

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const agentCheck = await verifyAgentOwnership(supabase, agentId, wallet)
  if (!agentCheck.success) {
    return c.json({ error: agentCheck.error }, 404)
  }

  const agent = agentCheck.agent!
  const currentConfig = (agent.config || {}) as Record<string, unknown>

  // Reset character to defaults
  const updatedConfig = {
    ...currentConfig,
    character: DEFAULT_CHARACTER,
    memory_integrity: DEFAULT_MEMORY_INTEGRITY,
  }

  const { error } = await supabase
    .from('agents')
    .update({ config: updatedConfig })
    .eq('id', agentId)

  if (error) {
    console.error('Reset character error:', error)
    return c.json({ error: 'Failed to reset character' }, 500)
  }

  return c.json({
    success: true,
    character: DEFAULT_CHARACTER,
    memory_integrity: DEFAULT_MEMORY_INTEGRITY,
  })
})
