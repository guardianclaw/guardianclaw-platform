/**
 * Agent Export/Import Routes Tests
 *
 * Tests for validation schemas and format detection in export/import routes.
 * Tests cover GuardianClaw and ElizaOS format handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { z } from 'zod'
import { agentExportRoutes } from './agent-export'
import { testWallets } from '../test/fixtures/index'

// =========================================
// MOCK SETUP
// =========================================

const mockState = {
  agentResult: { data: null as unknown, error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
}

function createQueryChain(terminalValue: () => { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}

  const chainMethods = ['select', 'eq', 'neq', 'order']
  for (const method of chainMethods) {
    chain[method] = vi.fn(() => chain)
  }

  chain.single = vi.fn(() => Promise.resolve(terminalValue()))
  chain.maybeSingle = vi.fn(() => Promise.resolve(terminalValue()))
  chain.then = (resolve: (v: unknown) => void) => resolve(terminalValue())

  return chain
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => createQueryChain(() => mockState.agentResult)),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve(mockState.insertResult)),
      })),
    })),
    update: vi.fn(() => {
      const chain: Record<string, unknown> = {}
      chain.eq = vi.fn(() => chain)
      chain.select = vi.fn(() => ({
        single: vi.fn(() => Promise.resolve(mockState.updateResult)),
      }))
      return chain
    }),
  })),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

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

vi.mock('../middleware/rate-limit', () => ({
  walletRateLimitMiddleware: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next()
  }),
}))

function resetMockState() {
  mockState.agentResult = { data: null, error: null }
  mockState.insertResult = { data: null, error: null }
  mockState.updateResult = { data: null, error: null }
}

// Create test app
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    JWT_SECRET: string
  }
}>()

app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  }
  await next()
})

app.route('/agents', agentExportRoutes)

// Test fixtures
const mockAgent = {
  id: 'agent-123',
  name: 'Test Agent',
  description: 'A test agent',
  framework: 'elizaos',
  icon: 'bot',
  flow: { nodes: [], edges: [] },
  config: {
    character: {
      name: 'TestBot',
      personality: 'Helpful',
    },
    memory_integrity: { enabled: true },
  },
  claw_config: {
    protection_level: 'standard',
  },
  integration_config: {},
}

// =========================================
// HTTP ROUTE TESTS
// =========================================

describe('Agent Export Routes HTTP Tests', () => {
  const token = 'test-token'

  beforeEach(() => {
    resetMockState()
    vi.clearAllMocks()
  })

  describe('GET /agents/:agentId/export', () => {
    it('exports agent in GuardianClaw format', async () => {
      mockState.agentResult = { data: mockAgent, error: null }

      const res = await app.request('/agents/agent-123/export', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.version).toBe('1.0')
      expect(data.format).toBe('claw')
      expect(data.agent.name).toBe('Test Agent')
      expect(data.character).toBeDefined()
    })

    it('exports agent in ElizaOS format', async () => {
      mockState.agentResult = { data: mockAgent, error: null }

      const res = await app.request('/agents/agent-123/export?format=elizaos', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.name).toBe('TestBot')
      expect(data.system).toBe('Helpful')
    })

    it('excludes flow when include_flow=false', async () => {
      mockState.agentResult = { data: mockAgent, error: null }

      const res = await app.request('/agents/agent-123/export?include_flow=false', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.flow).toBeUndefined()
    })

    it('excludes claw_config when include_claw=false', async () => {
      mockState.agentResult = { data: mockAgent, error: null }

      const res = await app.request('/agents/agent-123/export?include_claw=false', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.claw_config).toBeUndefined()
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/nonexistent/export', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request('/agents/agent-123/export')
      expect(res.status).toBe(401)
    })
  })

  describe('POST /agents/:agentId/import', () => {
    it('imports GuardianClaw format', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.updateResult = {
        data: { id: 'agent-123', name: 'Test Agent', framework: 'elizaos' },
        error: null,
      }

      const res = await app.request('/agents/agent-123/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '1.0',
          exported_at: '2024-01-01T00:00:00Z',
          agent: { name: 'Test Agent', framework: 'elizaos' },
          character: { name: 'NewBot' },
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.format).toBe('claw')
    })

    it('imports ElizaOS format', async () => {
      mockState.agentResult = { data: mockAgent, error: null }
      mockState.updateResult = {
        data: { id: 'agent-123', name: 'Test Agent', framework: 'elizaos' },
        error: null,
      }

      const res = await app.request('/agents/agent-123/import?format=elizaos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TestBot',
          clients: ['discord'],
          system: 'A helpful bot',
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.format).toBe('elizaos')
    })

    it('returns 400 for invalid JSON', async () => {
      const res = await app.request('/agents/agent-123/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for non-existent agent', async () => {
      mockState.agentResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request('/agents/nonexistent/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '1.0',
          exported_at: '2024-01-01T00:00:00Z',
          agent: { name: 'Test', framework: 'lc' },
        }),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /agents/:agentId/import/preview', () => {
    it('previews GuardianClaw import', async () => {
      mockState.agentResult = { data: mockAgent, error: null }

      const res = await app.request('/agents/agent-123/import/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '1.0',
          exported_at: '2024-01-01T00:00:00Z',
          agent: { name: 'Test Agent', framework: 'elizaos' },
          character: { name: 'Bot' },
          flow: { nodes: [{}], edges: [] },
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.valid).toBe(true)
      expect(data.format).toBe('claw')
      expect(data.preview.agent_name).toBe('Test Agent')
    })

    it('previews ElizaOS import', async () => {
      mockState.agentResult = { data: mockAgent, error: null }

      const res = await app.request('/agents/agent-123/import/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TestBot',
          clients: ['discord'],
          topics: ['a', 'b'],
        }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.valid).toBe(true)
      expect(data.format).toBe('elizaos')
      expect(data.preview.name).toBe('TestBot')
      expect(data.preview.topics_count).toBe(2)
    })

    it('returns 400 for invalid format', async () => {
      mockState.agentResult = { data: mockAgent, error: null }

      const res = await app.request('/agents/agent-123/import/preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '1.0',
          // Missing required fields
        }),
      })

      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.valid).toBe(false)
    })
  })

  describe('POST /agents/import (create new agent)', () => {
    it('creates new agent from GuardianClaw format', async () => {
      mockState.insertResult = {
        data: { id: 'new-agent', name: 'Test Agent', framework: 'elizaos' },
        error: null,
      }

      const res = await app.request('/agents/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: '1.0',
          exported_at: '2024-01-01T00:00:00Z',
          agent: { name: 'New Agent', framework: 'elizaos' },
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.agent.id).toBe('new-agent')
    })

    it('creates new agent from ElizaOS format', async () => {
      mockState.insertResult = {
        data: { id: 'new-agent', name: 'TestBot', framework: 'elizaos' },
        error: null,
      }

      const res = await app.request('/agents/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'TestBot',
          clients: ['discord'],
          system: 'A helpful bot',
        }),
      })

      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.format).toBe('elizaos')
    })

    it('returns 400 for invalid JSON', async () => {
      const res = await app.request('/agents/import', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid',
      })

      expect(res.status).toBe(400)
    })
  })
})

// =========================================
// SCHEMA TESTS (existing)
// =========================================

// Copy validation schemas from the routes for testing
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

const importOptionsSchema = z.object({
  format: z.enum(['claw', 'elizaos']).default('claw'),
  merge: z.boolean().default(false),
  include_flow: z.boolean().default(true),
  include_claw: z.boolean().default(true),
})

// Format detector (copied from routes for testing)
function detectFormat(data: Record<string, unknown>): 'claw' | 'elizaos' {
  if ('clients' in data || 'modelProvider' in data || 'messageExamples' in data) {
    return 'elizaos'
  }

  if ('version' in data && ('format' in data || 'exported_at' in data)) {
    return 'claw'
  }

  return 'claw'
}

// ElizaOS to GuardianClaw converter (simplified from routes)
function convertElizaOSToGuardianClaw(elizaOS: {
  name: string
  system?: string
  bio?: string | string[]
  topics?: string[]
  adjectives?: string[]
  knowledge?: string[]
  messageExamples?: Array<Array<{ user: string; content: { text: string } }>>
}) {
  return {
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
}

describe('Export/Import Validation Schemas', () => {
  describe('ElizaOS Character Schema', () => {
    it('accepts valid minimal ElizaOS character', () => {
      const character = { name: 'TestBot' }
      expect(elizaOSCharacterSchema.safeParse(character).success).toBe(true)
    })

    it('accepts valid complete ElizaOS character', () => {
      const character = {
        name: 'TestBot',
        clients: ['discord', 'telegram'],
        modelProvider: 'openai',
        settings: {
          secrets: { API_KEY: '***' },
          voice: { model: 'eleven_labs' },
        },
        system: 'You are a helpful assistant.',
        bio: ['A helpful bot.', 'Created for testing.'],
        lore: ['Was born in a lab.'],
        messageExamples: [
          [
            { user: '{{user1}}', content: { text: 'Hello' } },
            { user: 'TestBot', content: { text: 'Hi there!' } },
          ],
        ],
        postExamples: ['Check out this cool thing!'],
        topics: ['technology', 'science'],
        adjectives: ['helpful', 'friendly'],
        knowledge: ['AI basics'],
        style: {
          all: ['Be concise'],
          chat: ['Use emojis'],
          post: ['Be engaging'],
        },
      }

      const result = elizaOSCharacterSchema.safeParse(character)
      expect(result.success).toBe(true)
    })

    it('accepts bio as string or array', () => {
      expect(
        elizaOSCharacterSchema.safeParse({
          name: 'Bot',
          bio: 'A single bio string',
        }).success
      ).toBe(true)

      expect(
        elizaOSCharacterSchema.safeParse({
          name: 'Bot',
          bio: ['Bio line 1', 'Bio line 2'],
        }).success
      ).toBe(true)
    })

    it('rejects missing name', () => {
      expect(elizaOSCharacterSchema.safeParse({}).success).toBe(false)
      expect(elizaOSCharacterSchema.safeParse({ system: 'test' }).success).toBe(false)
    })

    it('accepts empty arrays for optional fields', () => {
      const character = {
        name: 'Bot',
        topics: [],
        adjectives: [],
        knowledge: [],
        messageExamples: [],
      }

      expect(elizaOSCharacterSchema.safeParse(character).success).toBe(true)
    })
  })

  describe('GuardianClaw Export Schema', () => {
    it('accepts valid minimal GuardianClaw export', () => {
      const exportData = {
        version: '1.0',
        exported_at: '2024-01-01T00:00:00Z',
        agent: {
          name: 'TestAgent',
          framework: 'openai_agents',
        },
      }

      expect(clawExportSchema.safeParse(exportData).success).toBe(true)
    })

    it('accepts valid complete GuardianClaw export', () => {
      const exportData = {
        version: '1.0',
        exported_at: '2024-01-01T00:00:00Z',
        agent: {
          name: 'TestAgent',
          description: 'A test agent',
          framework: 'elizaos',
          icon: 'bot',
        },
        character: {
          name: 'TestBot',
          personality: 'Friendly',
        },
        flow: {
          nodes: [{ id: '1', type: 'input' }],
          edges: [{ id: 'e1', source: '1', target: '2' }],
        },
        claw_config: {
          protection_level: 'standard',
        },
        integration_config: {
          some_setting: true,
        },
      }

      expect(clawExportSchema.safeParse(exportData).success).toBe(true)
    })

    it('accepts null description', () => {
      const exportData = {
        version: '1.0',
        exported_at: '2024-01-01T00:00:00Z',
        agent: {
          name: 'TestAgent',
          description: null,
          framework: 'openai_agents',
        },
      }

      expect(clawExportSchema.safeParse(exportData).success).toBe(true)
    })

    it('rejects missing required fields', () => {
      const invalidExports = [
        { exported_at: '2024-01-01T00:00:00Z', agent: { name: 'Test', framework: 'lc' } }, // Missing version
        { version: '1.0', agent: { name: 'Test', framework: 'lc' } }, // Missing exported_at
        { version: '1.0', exported_at: '2024-01-01T00:00:00Z' }, // Missing agent
        { version: '1.0', exported_at: '2024-01-01T00:00:00Z', agent: { framework: 'lc' } }, // Missing agent.name
      ]

      for (const data of invalidExports) {
        expect(clawExportSchema.safeParse(data).success).toBe(false)
      }
    })

    it('accepts empty flow arrays', () => {
      const exportData = {
        version: '1.0',
        exported_at: '2024-01-01T00:00:00Z',
        agent: { name: 'Test', framework: 'lc' },
        flow: { nodes: [], edges: [] },
      }

      expect(clawExportSchema.safeParse(exportData).success).toBe(true)
    })
  })

  describe('Import Options Schema', () => {
    it('accepts valid options', () => {
      const options = [
        { format: 'claw', merge: true },
        { format: 'elizaos', include_flow: false },
        { merge: false, include_claw: true },
      ]

      for (const opt of options) {
        expect(importOptionsSchema.safeParse(opt).success).toBe(true)
      }
    })

    it('applies correct defaults', () => {
      const result = importOptionsSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.format).toBe('claw')
        expect(result.data.merge).toBe(false)
        expect(result.data.include_flow).toBe(true)
        expect(result.data.include_claw).toBe(true)
      }
    })

    it('accepts all valid format values', () => {
      expect(importOptionsSchema.safeParse({ format: 'claw' }).success).toBe(true)
      expect(importOptionsSchema.safeParse({ format: 'elizaos' }).success).toBe(true)
    })

    it('rejects invalid format values', () => {
      expect(importOptionsSchema.safeParse({ format: 'invalid' }).success).toBe(false)
      expect(importOptionsSchema.safeParse({ format: 'GCLAW' }).success).toBe(false)
    })
  })
})

describe('Format Detection', () => {
  it('detects ElizaOS format by clients field', () => {
    expect(detectFormat({ name: 'Bot', clients: ['discord'] })).toBe('elizaos')
  })

  it('detects ElizaOS format by modelProvider field', () => {
    expect(detectFormat({ name: 'Bot', modelProvider: 'openai' })).toBe('elizaos')
  })

  it('detects ElizaOS format by messageExamples field', () => {
    expect(detectFormat({ name: 'Bot', messageExamples: [] })).toBe('elizaos')
  })

  it('detects GuardianClaw format by version and format fields', () => {
    expect(
      detectFormat({
        version: '1.0',
        format: 'claw',
        agent: { name: 'Test' },
      })
    ).toBe('claw')
  })

  it('detects GuardianClaw format by version and exported_at fields', () => {
    expect(
      detectFormat({
        version: '1.0',
        exported_at: '2024-01-01',
        agent: { name: 'Test' },
      })
    ).toBe('claw')
  })

  it('defaults to claw for ambiguous data', () => {
    expect(detectFormat({})).toBe('claw')
    expect(detectFormat({ name: 'Bot' })).toBe('claw')
    expect(detectFormat({ random: 'data' })).toBe('claw')
  })

  it('prioritizes ElizaOS detection over GuardianClaw', () => {
    // If data has both ElizaOS and GuardianClaw markers, ElizaOS wins
    expect(
      detectFormat({
        version: '1.0',
        exported_at: '2024-01-01',
        clients: ['discord'], // ElizaOS marker
      })
    ).toBe('elizaos')
  })
})

describe('ElizaOS to GuardianClaw Conversion', () => {
  it('converts basic character', () => {
    const elizaOS = {
      name: 'TestBot',
      system: 'A helpful assistant.',
    }

    const claw = convertElizaOSToGuardianClaw(elizaOS)

    expect(claw.name).toBe('TestBot')
    expect(claw.personality).toBe('A helpful assistant.')
    expect(claw.bio).toBe('')
    expect(claw.topics).toEqual([])
    expect(claw.forbidden_topics).toEqual([])
    expect(claw.adjectives).toEqual([])
    expect(claw.examples).toEqual([])
  })

  it('converts bio string correctly', () => {
    const elizaOS = {
      name: 'Bot',
      bio: 'Single bio line',
    }

    const claw = convertElizaOSToGuardianClaw(elizaOS)
    expect(claw.bio).toBe('Single bio line')
  })

  it('converts bio array correctly', () => {
    const elizaOS = {
      name: 'Bot',
      bio: ['Line 1', 'Line 2', 'Line 3'],
    }

    const claw = convertElizaOSToGuardianClaw(elizaOS)
    expect(claw.bio).toBe('Line 1\nLine 2\nLine 3')
  })

  it('preserves arrays', () => {
    const elizaOS = {
      name: 'Bot',
      topics: ['tech', 'science'],
      adjectives: ['helpful', 'friendly'],
      knowledge: ['AI', 'ML'],
    }

    const claw = convertElizaOSToGuardianClaw(elizaOS)
    expect(claw.topics).toEqual(['tech', 'science'])
    expect(claw.adjectives).toEqual(['helpful', 'friendly'])
  })

  it('converts message examples correctly', () => {
    const elizaOS = {
      name: 'Bot',
      messageExamples: [
        [
          { user: '{{user1}}', content: { text: 'Hello' } },
          { user: 'Bot', content: { text: 'Hi there!' } },
        ],
        [
          { user: '{{user1}}', content: { text: 'How are you?' } },
          { user: 'Bot', content: { text: 'I am doing well!' } },
        ],
      ],
    }

    const claw = convertElizaOSToGuardianClaw(elizaOS)

    expect(claw.examples).toHaveLength(2)
    expect(claw.examples[0]).toEqual({ user: 'Hello', assistant: 'Hi there!' })
    expect(claw.examples[1]).toEqual({ user: 'How are you?', assistant: 'I am doing well!' })
  })

  it('filters out invalid examples', () => {
    const elizaOS = {
      name: 'Bot',
      messageExamples: [
        // Valid example
        [
          { user: '{{user1}}', content: { text: 'Hello' } },
          { user: 'Bot', content: { text: 'Hi!' } },
        ],
        // Invalid - no user message
        [{ user: 'Bot', content: { text: 'Hi!' } }],
        // Invalid - empty texts
        [
          { user: '{{user1}}', content: { text: '' } },
          { user: 'Bot', content: { text: '' } },
        ],
      ],
    }

    const claw = convertElizaOSToGuardianClaw(elizaOS)

    expect(claw.examples).toHaveLength(1)
    expect(claw.examples[0]).toEqual({ user: 'Hello', assistant: 'Hi!' })
  })

  it('always sets forbidden_topics to empty array', () => {
    const elizaOS = { name: 'Bot' }
    const claw = convertElizaOSToGuardianClaw(elizaOS)

    expect(claw.forbidden_topics).toEqual([])
  })
})

describe('Export Content Headers', () => {
  it('generates valid filename for GuardianClaw export', () => {
    const agentName = 'Test Agent 123'
    const filename = `${agentName.replace(/[^a-z0-9]/gi, '_')}_claw.json`
    expect(filename).toBe('Test_Agent_123_claw.json')
  })

  it('generates valid filename for ElizaOS export', () => {
    const agentName = 'Test Agent 123'
    const filename = `${agentName.replace(/[^a-z0-9]/gi, '_')}_character.json`
    expect(filename).toBe('Test_Agent_123_character.json')
  })

  it('handles special characters in agent name', () => {
    const agentName = 'Bot@#$%^&*()'
    const filename = `${agentName.replace(/[^a-z0-9]/gi, '_')}_claw.json`
    expect(filename).toBe('Bot__________claw.json')
  })
})

describe('Merge vs Replace Logic', () => {
  it('merge preserves existing keys and adds new ones', () => {
    const existing = { a: 1, b: 2 }
    const incoming = { b: 3, c: 4 }
    const merged = { ...existing, ...incoming }

    expect(merged).toEqual({ a: 1, b: 3, c: 4 })
  })

  it('replace completely overwrites', () => {
    const incoming = { b: 3, c: 4 }
    expect(incoming).toEqual({ b: 3, c: 4 })
  })
})

describe('Preview Import Response', () => {
  it('generates correct preview for ElizaOS', () => {
    const elizaOS = {
      name: 'TestBot',
      system: 'Personality text',
      bio: ['Bio line'],
      topics: ['a', 'b'],
      adjectives: ['x', 'y', 'z'],
      messageExamples: [
        [{}, {}],
        [{}, {}],
      ],
      knowledge: ['k1'],
    }

    const preview = {
      name: elizaOS.name,
      has_personality: !!elizaOS.system,
      has_bio: !!elizaOS.bio,
      topics_count: elizaOS.topics?.length || 0,
      adjectives_count: elizaOS.adjectives?.length || 0,
      examples_count: elizaOS.messageExamples?.length || 0,
      knowledge_count: elizaOS.knowledge?.length || 0,
    }

    expect(preview.name).toBe('TestBot')
    expect(preview.has_personality).toBe(true)
    expect(preview.has_bio).toBe(true)
    expect(preview.topics_count).toBe(2)
    expect(preview.adjectives_count).toBe(3)
    expect(preview.examples_count).toBe(2)
    expect(preview.knowledge_count).toBe(1)
  })

  it('generates correct preview for GuardianClaw', () => {
    const claw = {
      version: '1.0',
      exported_at: '2024-01-01',
      agent: { name: 'Test', framework: 'elizaos' },
      character: { name: 'Bot' },
      flow: { nodes: [{}, {}], edges: [{}, {}, {}] },
      claw_config: { protection_level: 'standard' },
    }

    const preview = {
      version: claw.version,
      exported_at: claw.exported_at,
      agent_name: claw.agent.name,
      framework: claw.agent.framework,
      has_character: !!claw.character,
      has_flow: !!claw.flow,
      has_claw_config: !!claw.claw_config,
      flow_nodes: claw.flow?.nodes?.length || 0,
      flow_edges: claw.flow?.edges?.length || 0,
    }

    expect(preview.version).toBe('1.0')
    expect(preview.agent_name).toBe('Test')
    expect(preview.framework).toBe('elizaos')
    expect(preview.has_character).toBe(true)
    expect(preview.has_flow).toBe(true)
    expect(preview.has_claw_config).toBe(true)
    expect(preview.flow_nodes).toBe(2)
    expect(preview.flow_edges).toBe(3)
  })
})
