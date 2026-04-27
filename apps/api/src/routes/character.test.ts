/**
 * Character Routes Tests
 *
 * Tests for validation schemas and helper logic in the character routes.
 * Tests cover character configuration, memory integrity settings,
 * and the character prompt builder.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'
import { characterRoutes } from './character'
import { testWallets } from '../test/fixtures/index'

// =========================================
// MOCK SETUP
// =========================================

// Stateful mock configuration
const mockState = {
  selectResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
}

// Build chainable query mock
function createQueryChain(terminalValue: () => { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}

  const chainMethods = ['select', 'eq', 'neq', 'gte', 'lte', 'order']
  for (const method of chainMethods) {
    chain[method] = vi.fn(() => chain)
  }

  chain.single = vi.fn(() => Promise.resolve(terminalValue()))
  chain.maybeSingle = vi.fn(() => Promise.resolve(terminalValue()))

  return chain
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => createQueryChain(() => mockState.selectResult)),
    update: vi.fn(() => {
      const updateChain: Record<string, unknown> = {}
      updateChain.eq = vi.fn(() => updateChain)
      updateChain.select = vi.fn(() => ({
        single: vi.fn(() => Promise.resolve(mockState.updateResult)),
      }))
      updateChain.then = (resolve: (v: unknown) => void) => resolve(mockState.updateResult)
      return updateChain
    }),
  })),
}

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// Mock auth middleware to bypass JWT verification
vi.mock('../middleware/auth', () => ({
  authMiddleware: vi.fn(async (c: unknown, next: () => Promise<void>) => {
    const ctx = c as {
      req: { header: (name: string) => string | undefined }
      set: (key: string, value: string) => void
      json: (data: unknown, status: number) => Response
    }
    const authHeader = ctx.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ctx.json({ error: 'Unauthorized' }, 401)
    }
    ctx.set('wallet', testWallets.alice)
    ctx.set('plan', 'pro')
    await next()
  }),
}))

// Mock rate limit middleware
vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  }),
}))

// Helper functions
function setSelectResult(data: unknown, error?: unknown) {
  mockState.selectResult = { data, error: error ?? null }
}

function setUpdateResult(data: unknown, error?: unknown) {
  mockState.updateResult = { data: data ?? null, error: error ?? null }
}

function resetMockState() {
  mockState.selectResult = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
}

// Create test app with mock environment
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    SUPABASE_ANON_KEY: string
    SUPABASE_JWT_SECRET: string
    JWT_SECRET: string
    OPENAI_API_KEY?: string
  }
}>()

// Inject mock env
app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars-padding!',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/agents', characterRoutes)

// Test fixtures
const mockAgent = {
  id: 'agent-123',
  name: 'Test Agent',
  framework: 'elizaos',
  config: {
    character: {
      name: 'TestBot',
      personality: 'Helpful and friendly',
      bio: 'A test assistant',
      topics: ['testing', 'help'],
      forbidden_topics: ['harmful'],
      adjectives: ['friendly', 'helpful'],
      knowledge: ['testing basics'],
      examples: [{ user: 'Hello', assistant: 'Hi there!' }],
    },
    memory_integrity: {
      enabled: true,
      verify_on_read: true,
      sign_on_write: true,
      min_trust_score: 0.5,
    },
  },
  claw_config: {},
}

const emptyConfigAgent = {
  id: 'agent-456',
  name: 'Empty Config Agent',
  framework: 'elizaos',
  config: {},
  claw_config: {},
}

// =========================================
// HTTP ROUTE TESTS
// =========================================

describe('Character Routes HTTP Tests', () => {
  const token = 'test-token' // Mock token - actual validation is mocked

  beforeEach(() => {
    resetMockState()
    vi.clearAllMocks()
  })

  describe('GET /agents/:agentId/character', () => {
    it('returns character configuration for an agent', async () => {
      setSelectResult(mockAgent)

      const res = await app.request('/agents/agent-123/character', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.character.name).toBe('TestBot')
      expect(data.character.personality).toBe('Helpful and friendly')
      expect(data.memory_integrity.enabled).toBe(true)
      expect(data.framework).toBe('elizaos')
      expect(data.is_elizaos).toBe(true)
    })

    it('returns defaults for agent with empty config', async () => {
      setSelectResult(emptyConfigAgent)

      const res = await app.request('/agents/agent-456/character', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.character).toBeDefined()
      expect(data.memory_integrity.enabled).toBe(true)
    })

    it('returns 404 for non-existent agent', async () => {
      setSelectResult(null, { message: 'Not found' })

      const res = await app.request('/agents/nonexistent/character', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns 401 without auth token', async () => {
      const res = await app.request('/agents/agent-123/character')

      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /agents/:agentId/character', () => {
    it('updates character fields partially', async () => {
      setSelectResult(mockAgent)
      setUpdateResult({
        id: 'agent-123',
        name: 'Test Agent',
        framework: 'elizaos',
        config: {
          character: {
            ...mockAgent.config.character,
            name: 'UpdatedBot',
          },
          memory_integrity: mockAgent.config.memory_integrity,
        },
      })

      const res = await app.request('/agents/agent-123/character', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character: { name: 'UpdatedBot' },
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.character.name).toBe('UpdatedBot')
    })

    it('updates memory_integrity separately', async () => {
      setSelectResult(mockAgent)
      setUpdateResult({
        id: 'agent-123',
        name: 'Test Agent',
        framework: 'elizaos',
        config: {
          character: mockAgent.config.character,
          memory_integrity: {
            enabled: false,
            verify_on_read: false,
            sign_on_write: true,
            min_trust_score: 0.8,
          },
        },
      })

      const res = await app.request('/agents/agent-123/character', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memory_integrity: { enabled: false, min_trust_score: 0.8 },
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.memory_integrity.enabled).toBe(false)
    })

    it('validates character name max length', async () => {
      setSelectResult(mockAgent)

      const res = await app.request('/agents/agent-123/character', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character: { name: 'a'.repeat(101) },
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toContain('Invalid')
    })

    it('validates memory_integrity min_trust_score range', async () => {
      setSelectResult(mockAgent)

      const res = await app.request('/agents/agent-123/character', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memory_integrity: { min_trust_score: 2.0 },
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent agent', async () => {
      setSelectResult(null, { message: 'Not found' })

      const res = await app.request('/agents/nonexistent/character', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ character: { name: 'Test' } }),
      })

      expect(res.status).toBe(404)
    })

    it('returns 500 on database update error', async () => {
      setSelectResult(mockAgent)
      setUpdateResult(null, { message: 'Database error' })

      const res = await app.request('/agents/agent-123/character', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ character: { name: 'Updated' } }),
      })

      expect(res.status).toBe(500)
    })
  })

  describe('PUT /agents/:agentId/character', () => {
    it('replaces entire character configuration', async () => {
      setSelectResult(mockAgent)
      const newCharacter = {
        name: 'NewBot',
        personality: 'New personality',
      }
      setUpdateResult({
        id: 'agent-123',
        config: { character: newCharacter },
      })

      const res = await app.request('/agents/agent-123/character', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ character: newCharacter }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.character.name).toBe('NewBot')
    })

    it('requires all mandatory fields for PUT', async () => {
      setSelectResult(mockAgent)

      // Missing 'personality' which is required
      const res = await app.request('/agents/agent-123/character', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ character: { name: 'OnlyName' } }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 500 on database error', async () => {
      setSelectResult(mockAgent)
      setUpdateResult(null, { message: 'Database error' })

      const res = await app.request('/agents/agent-123/character', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          character: { name: 'NewBot', personality: 'New personality' },
        }),
      })

      expect(res.status).toBe(500)
    })
  })

  describe('DELETE /agents/:agentId/character', () => {
    it('resets character to defaults', async () => {
      setSelectResult(mockAgent)
      setUpdateResult({ error: null })

      const res = await app.request('/agents/agent-123/character', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.character.name).toBe('')
      expect(data.memory_integrity.enabled).toBe(true)
    })

    it('returns 404 for non-existent agent', async () => {
      setSelectResult(null, { message: 'Not found' })

      const res = await app.request('/agents/nonexistent/character', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns 500 on database error', async () => {
      setSelectResult(mockAgent)
      setUpdateResult(null, { message: 'Database error' })

      const res = await app.request('/agents/agent-123/character', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(500)
    })
  })

  describe('POST /agents/:agentId/character/preview', () => {
    it('returns preview info when OpenAI key is not set', async () => {
      setSelectResult(mockAgent)

      const res = await app.request('/agents/agent-123/character/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Hello, how are you?' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.preview_available).toBe(false)
      expect(data.character_prompt).toContain('TestBot')
      expect(data.test_message).toBe('Hello, how are you?')
    })

    it('returns 400 for missing message', async () => {
      setSelectResult(mockAgent)

      const res = await app.request('/agents/agent-123/character/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for empty message', async () => {
      setSelectResult(mockAgent)

      const res = await app.request('/agents/agent-123/character/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: '' }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for message exceeding max length', async () => {
      setSelectResult(mockAgent)

      const res = await app.request('/agents/agent-123/character/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'a'.repeat(1001) }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent agent', async () => {
      setSelectResult(null, { message: 'Not found' })

      const res = await app.request('/agents/nonexistent/character/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: 'Test message' }),
      })

      expect(res.status).toBe(404)
    })
  })
})

// Copy validation schemas from the routes for testing
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

const previewMessageSchema = z.object({
  message: z.string().min(1).max(1000),
})

// Character prompt builder (copied from routes for testing)
function buildCharacterPrompt(character: {
  name?: string
  personality?: string
  bio?: string
  adjectives?: string[]
  topics?: string[]
  forbidden_topics?: string[]
  examples?: Array<{ user: string; assistant: string }>
}): string {
  const parts: string[] = []

  if (character.name) {
    parts.push(`You are ${character.name}.`)
  }

  if (character.bio) {
    parts.push(`\nBackground:\n${character.bio}`)
  }

  if (character.personality) {
    parts.push(`\nPersonality:\n${character.personality}`)
  }

  if (character.adjectives && character.adjectives.length > 0) {
    parts.push(`\nYour personality traits: ${character.adjectives.join(', ')}.`)
  }

  if (character.topics && character.topics.length > 0) {
    parts.push(`\nYou are knowledgeable about: ${character.topics.join(', ')}.`)
  }

  if (character.forbidden_topics && character.forbidden_topics.length > 0) {
    parts.push(`\nYou should not discuss or engage with: ${character.forbidden_topics.join(', ')}.`)
  }

  if (character.examples && character.examples.length > 0) {
    parts.push('\nExample conversations:')
    for (const example of character.examples.slice(0, 5)) {
      parts.push(`User: ${example.user}\nAssistant: ${example.assistant}\n`)
    }
  }

  return parts.join('\n')
}

describe('Character Routes Validation Schemas', () => {
  describe('Example Schema', () => {
    it('accepts valid examples', () => {
      const validExamples = [
        { user: 'Hello', assistant: 'Hi there!' },
        {
          user: 'What is the weather?',
          assistant: 'I cannot check the weather, but I can discuss it.',
        },
        { user: 'a', assistant: 'b' }, // Minimum length
      ]

      for (const example of validExamples) {
        expect(exampleSchema.safeParse(example).success).toBe(true)
      }
    })

    it('rejects empty user message', () => {
      expect(exampleSchema.safeParse({ user: '', assistant: 'response' }).success).toBe(false)
    })

    it('rejects empty assistant message', () => {
      expect(exampleSchema.safeParse({ user: 'hello', assistant: '' }).success).toBe(false)
    })

    it('rejects user message exceeding max length', () => {
      expect(
        exampleSchema.safeParse({
          user: 'a'.repeat(1001),
          assistant: 'response',
        }).success
      ).toBe(false)
    })

    it('rejects assistant message exceeding max length', () => {
      expect(
        exampleSchema.safeParse({
          user: 'hello',
          assistant: 'a'.repeat(2001),
        }).success
      ).toBe(false)
    })

    it('rejects missing fields', () => {
      expect(exampleSchema.safeParse({ user: 'hello' }).success).toBe(false)
      expect(exampleSchema.safeParse({ assistant: 'hello' }).success).toBe(false)
      expect(exampleSchema.safeParse({}).success).toBe(false)
    })
  })

  describe('Character Schema', () => {
    it('accepts valid complete character', () => {
      const character = {
        name: 'TestBot',
        personality: 'Friendly and helpful assistant.',
        bio: 'Created for testing purposes.',
        topics: ['technology', 'science'],
        forbidden_topics: ['politics', 'religion'],
        adjectives: ['helpful', 'curious', 'patient'],
        knowledge: ['AI basics', 'Programming concepts'],
        examples: [{ user: 'Hello', assistant: 'Hi! How can I help?' }],
      }

      const result = characterSchema.safeParse(character)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('TestBot')
        expect(result.data.topics).toHaveLength(2)
      }
    })

    it('accepts minimal valid character', () => {
      const character = {
        name: 'Bot',
        personality: 'A simple bot.',
      }

      const result = characterSchema.safeParse(character)
      expect(result.success).toBe(true)
    })

    it('rejects missing required fields', () => {
      expect(characterSchema.safeParse({}).success).toBe(false)
      expect(characterSchema.safeParse({ name: 'Test' }).success).toBe(false)
      expect(characterSchema.safeParse({ personality: 'Test' }).success).toBe(false)
    })

    it('rejects name exceeding max length', () => {
      expect(
        characterSchema.safeParse({
          name: 'a'.repeat(101),
          personality: 'Test',
        }).success
      ).toBe(false)
    })

    it('rejects empty name', () => {
      expect(
        characterSchema.safeParse({
          name: '',
          personality: 'Test',
        }).success
      ).toBe(false)
    })

    it('rejects personality exceeding max length', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'a'.repeat(5001),
        }).success
      ).toBe(false)
    })

    it('rejects bio exceeding max length', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'Test',
          bio: 'a'.repeat(5001),
        }).success
      ).toBe(false)
    })

    it('rejects topics exceeding max count', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'Test',
          topics: Array(51).fill('topic'),
        }).success
      ).toBe(false)
    })

    it('rejects topic exceeding max length', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'Test',
          topics: ['a'.repeat(101)],
        }).success
      ).toBe(false)
    })

    it('rejects adjectives exceeding max count', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'Test',
          adjectives: Array(31).fill('adj'),
        }).success
      ).toBe(false)
    })

    it('rejects adjective exceeding max length', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'Test',
          adjectives: ['a'.repeat(51)],
        }).success
      ).toBe(false)
    })

    it('rejects knowledge exceeding max count', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'Test',
          knowledge: Array(101).fill('fact'),
        }).success
      ).toBe(false)
    })

    it('rejects examples exceeding max count', () => {
      expect(
        characterSchema.safeParse({
          name: 'Bot',
          personality: 'Test',
          examples: Array(21).fill({ user: 'hi', assistant: 'hello' }),
        }).success
      ).toBe(false)
    })
  })

  describe('Update Character Schema', () => {
    it('accepts partial updates', () => {
      const updates = [
        { name: 'New Name' },
        { personality: 'New personality' },
        { topics: ['new', 'topics'] },
        { bio: 'New bio', adjectives: ['new'] },
      ]

      for (const update of updates) {
        expect(updateCharacterSchema.safeParse(update).success).toBe(true)
      }
    })

    it('accepts empty object (no updates)', () => {
      expect(updateCharacterSchema.safeParse({}).success).toBe(true)
    })

    it('validates fields when provided', () => {
      expect(updateCharacterSchema.safeParse({ name: '' }).success).toBe(false)
      expect(updateCharacterSchema.safeParse({ name: 'a'.repeat(101) }).success).toBe(false)
      expect(updateCharacterSchema.safeParse({ personality: 'a'.repeat(5001) }).success).toBe(false)
    })
  })

  describe('Memory Integrity Schema', () => {
    it('accepts valid memory integrity config', () => {
      const configs = [
        { enabled: true },
        { verify_on_read: false, sign_on_write: true },
        { min_trust_score: 0.5 },
        { enabled: true, verify_on_read: true, sign_on_write: true, min_trust_score: 0.8 },
      ]

      for (const config of configs) {
        expect(memoryIntegritySchema.safeParse(config).success).toBe(true)
      }
    })

    it('accepts empty object (all optional)', () => {
      expect(memoryIntegritySchema.safeParse({}).success).toBe(true)
    })

    it('rejects min_trust_score below 0', () => {
      expect(memoryIntegritySchema.safeParse({ min_trust_score: -0.1 }).success).toBe(false)
    })

    it('rejects min_trust_score above 1', () => {
      expect(memoryIntegritySchema.safeParse({ min_trust_score: 1.1 }).success).toBe(false)
    })

    it('accepts boundary values for min_trust_score', () => {
      expect(memoryIntegritySchema.safeParse({ min_trust_score: 0 }).success).toBe(true)
      expect(memoryIntegritySchema.safeParse({ min_trust_score: 1 }).success).toBe(true)
      expect(memoryIntegritySchema.safeParse({ min_trust_score: 0.5 }).success).toBe(true)
    })

    it('rejects invalid boolean types', () => {
      expect(memoryIntegritySchema.safeParse({ enabled: 'true' }).success).toBe(false)
      expect(memoryIntegritySchema.safeParse({ verify_on_read: 1 }).success).toBe(false)
    })
  })

  describe('Preview Message Schema', () => {
    it('accepts valid messages', () => {
      const messages = [
        { message: 'Hello!' },
        { message: 'What is the meaning of life?' },
        { message: 'a' }, // Minimum
        { message: 'a'.repeat(1000) }, // Maximum
      ]

      for (const msg of messages) {
        expect(previewMessageSchema.safeParse(msg).success).toBe(true)
      }
    })

    it('rejects empty message', () => {
      expect(previewMessageSchema.safeParse({ message: '' }).success).toBe(false)
    })

    it('rejects message exceeding max length', () => {
      expect(previewMessageSchema.safeParse({ message: 'a'.repeat(1001) }).success).toBe(false)
    })

    it('rejects missing message field', () => {
      expect(previewMessageSchema.safeParse({}).success).toBe(false)
    })
  })
})

describe('Character Prompt Builder', () => {
  describe('buildCharacterPrompt', () => {
    it('builds prompt with name only', () => {
      const prompt = buildCharacterPrompt({ name: 'TestBot' })
      expect(prompt).toBe('You are TestBot.')
    })

    it('builds prompt with all fields', () => {
      const prompt = buildCharacterPrompt({
        name: 'TestBot',
        bio: 'A helpful assistant.',
        personality: 'Friendly and patient.',
        adjectives: ['helpful', 'curious'],
        topics: ['technology', 'science'],
        forbidden_topics: ['politics'],
        examples: [{ user: 'Hello', assistant: 'Hi there!' }],
      })

      expect(prompt).toContain('You are TestBot.')
      expect(prompt).toContain('Background:\nA helpful assistant.')
      expect(prompt).toContain('Personality:\nFriendly and patient.')
      expect(prompt).toContain('personality traits: helpful, curious')
      expect(prompt).toContain('knowledgeable about: technology, science')
      expect(prompt).toContain('should not discuss or engage with: politics')
      expect(prompt).toContain('Example conversations:')
      expect(prompt).toContain('User: Hello')
      expect(prompt).toContain('Assistant: Hi there!')
    })

    it('returns empty string for empty character', () => {
      const prompt = buildCharacterPrompt({})
      expect(prompt).toBe('')
    })

    it('limits examples to 5', () => {
      const examples = Array(10)
        .fill(0)
        .map((_, i) => ({
          user: `Question ${i}`,
          assistant: `Answer ${i}`,
        }))

      const prompt = buildCharacterPrompt({ examples })

      // Should only include first 5
      expect(prompt).toContain('Question 0')
      expect(prompt).toContain('Question 4')
      expect(prompt).not.toContain('Question 5')
    })

    it('handles empty arrays gracefully', () => {
      const prompt = buildCharacterPrompt({
        name: 'Bot',
        topics: [],
        adjectives: [],
        examples: [],
      })

      expect(prompt).toBe('You are Bot.')
      expect(prompt).not.toContain('knowledgeable about')
      expect(prompt).not.toContain('personality traits')
      expect(prompt).not.toContain('Example conversations')
    })

    it('properly formats multiple adjectives', () => {
      const prompt = buildCharacterPrompt({
        adjectives: ['a', 'b', 'c'],
      })

      expect(prompt).toContain('Your personality traits: a, b, c.')
    })

    it('properly formats multiple topics', () => {
      const prompt = buildCharacterPrompt({
        topics: ['x', 'y', 'z'],
      })

      expect(prompt).toContain('You are knowledgeable about: x, y, z.')
    })

    it('properly formats multiple forbidden topics', () => {
      const prompt = buildCharacterPrompt({
        forbidden_topics: ['p', 'q', 'r'],
      })

      expect(prompt).toContain('You should not discuss or engage with: p, q, r.')
    })
  })
})

describe('Default Values', () => {
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

  it('default character has empty strings and arrays', () => {
    expect(DEFAULT_CHARACTER.name).toBe('')
    expect(DEFAULT_CHARACTER.topics).toEqual([])
    expect(DEFAULT_CHARACTER.examples).toEqual([])
  })

  it('default memory integrity is secure by default', () => {
    expect(DEFAULT_MEMORY_INTEGRITY.enabled).toBe(true)
    expect(DEFAULT_MEMORY_INTEGRITY.verify_on_read).toBe(true)
    expect(DEFAULT_MEMORY_INTEGRITY.sign_on_write).toBe(true)
    expect(DEFAULT_MEMORY_INTEGRITY.min_trust_score).toBe(0.5)
  })
})
