/**
 * Sanity tests to verify test infrastructure is working
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  createMockSupabaseClient,
  createModalRuntimeMock,
  createOpenAIMock,
  createSolanaRPCMock,
} from './mocks'
import {
  createProfile,
  createAgent,
  createApiKey,
  testWallets,
  resetFixtureState,
} from './fixtures'
import { generateTestToken, createMockRequest, createMockEnv, hashString } from './helpers'

describe('Test Infrastructure Sanity Checks', () => {
  beforeEach(() => {
    resetFixtureState()
  })

  describe('Supabase Mock', () => {
    it('creates mock client with chainable methods', async () => {
      const client = createMockSupabaseClient()

      // Test chainable pattern
      const builder = client.from('profiles')
      expect(builder).toBeDefined()
      expect(typeof builder.select).toBe('function')
      expect(typeof builder.eq).toBe('function')
      expect(typeof builder.single).toBe('function')
    })

    it('returns configured response', async () => {
      const client = createMockSupabaseClient()
      const mockProfile = createProfile({ wallet: testWallets.alice })

      client.__setTableResponse('profiles', [mockProfile])

      const { data } = await client.from('profiles').select('*')
      expect(data).toEqual([mockProfile])
    })

    it('returns error when configured', async () => {
      const client = createMockSupabaseClient()
      client.__setTableResponse('profiles', null, 'Not found')

      const { data, error } = await client.from('profiles').select('*').single()
      expect(data).toBeNull()
      expect(error).toEqual({ message: 'Not found' })
    })
  })

  describe('External API Mocks', () => {
    it('creates Modal runtime mock', async () => {
      const modal = createModalRuntimeMock()

      const result = await modal.execute('test-agent', { message: 'hello' })
      expect(result.blocked).toBe(false)
      expect(result.response).toBeDefined()
    })

    it('creates OpenAI mock', async () => {
      const openai = createOpenAIMock()

      const result = await openai.createChatCompletion([{ role: 'user', content: 'Hello' }])
      expect(result.choices).toHaveLength(1)
      expect(result.choices[0].message.content).toBeDefined()
    })

    it('creates Solana RPC mock', async () => {
      const solana = createSolanaRPCMock()

      const result = await solana.getTokenAccountsByOwner(testWallets.alice)
      expect(result.jsonrpc).toBe('2.0')
      expect(result.result.value).toBeDefined()
    })
  })

  describe('Fixtures', () => {
    it('creates profile with defaults', () => {
      const profile = createProfile()

      expect(profile.wallet).toBeDefined()
      expect(profile.plan).toBe('free')
      expect(profile.created_at).toBeDefined()
    })

    it('creates profile with overrides', () => {
      const profile = createProfile({
        wallet: testWallets.alice,
        plan: 'pro',
      })

      expect(profile.wallet).toBe(testWallets.alice)
      expect(profile.plan).toBe('pro')
    })

    it('creates agent with valid flow', () => {
      const agent = createAgent()

      expect(agent.id).toBeDefined()
      expect(agent.flow.nodes).toHaveLength(3)
      expect(agent.flow.edges).toHaveLength(2)
      expect(agent.claw_config.gates.avoidance).toBe(true)
    })

    it('creates API key with correct format', () => {
      const apiKey = createApiKey()

      expect(apiKey.key_prefix).toMatch(/^sk_live_/)
      expect(apiKey.rate_limit).toBe(100)
      expect(apiKey.is_active).toBe(true)
    })

    it('generates unique IDs', () => {
      const agent1 = createAgent()
      const agent2 = createAgent()

      expect(agent1.id).not.toBe(agent2.id)
    })
  })

  describe('Helpers', () => {
    it('generates valid JWT token', async () => {
      const token = await generateTestToken(testWallets.alice)

      expect(token).toMatch(/^eyJ/)
      expect(token.split('.')).toHaveLength(3)
    })

    it('generates token with custom plan', async () => {
      const token = await generateTestToken(testWallets.alice, { plan: 'pro' })

      // Token should be valid and contain plan claim
      expect(token).toBeDefined()
    })

    it('creates mock request', () => {
      const req = createMockRequest({
        method: 'POST',
        path: '/test',
        body: { message: 'hello' },
      })

      expect(req.method).toBe('POST')
      expect(req.url).toContain('/test')
    })

    it('creates mock environment', () => {
      const env = createMockEnv()

      expect(env.ENVIRONMENT).toBe('test')
      expect(env.JWT_SECRET).toBeDefined()
      expect(env.SUPABASE_URL).toBeDefined()
    })

    it('hashes string correctly', async () => {
      const hash1 = await hashString('test')
      const hash2 = await hashString('test')
      const hash3 = await hashString('different')

      expect(hash1).toBe(hash2) // Same input = same hash
      expect(hash1).not.toBe(hash3) // Different input = different hash
      expect(hash1).toHaveLength(64) // SHA-256 produces 64 hex chars
    })
  })

  describe('Environment', () => {
    it('has crypto available', () => {
      expect(crypto).toBeDefined()
      expect(crypto.subtle).toBeDefined()
      expect(crypto.getRandomValues).toBeDefined()
    })

    it('can generate random values', () => {
      const bytes = new Uint8Array(32)
      crypto.getRandomValues(bytes)

      expect(bytes.some((b) => b !== 0)).toBe(true)
    })

    it('can perform SHA-256 hash', async () => {
      const data = new TextEncoder().encode('test')
      const hash = await crypto.subtle.digest('SHA-256', data)

      expect(hash.byteLength).toBe(32)
    })
  })
})
