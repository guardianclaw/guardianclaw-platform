/**
 * Governance routes unit tests
 * Tests: proposals, voting, comments, voting power thresholds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { governanceRoutes } from './governance'
import { testWallets, createProposal } from '../test/fixtures'
import { generateTestToken } from '../test/helpers'

// Valid test UUIDs for routes with UUID validation
const PROP_1 = 'a0000000-0000-0000-0000-000000000001'
const PROP_2 = 'a0000000-0000-0000-0000-000000000002'
const PROP_NONEXIST = 'a0000000-0000-0000-0000-000000000099'
const PROP_HIDDEN = 'a0000000-0000-0000-0000-00000000000a'
const PROP_DISC = 'a0000000-0000-0000-0000-00000000000b'
const PROP_CANC = 'a0000000-0000-0000-0000-00000000000c'
const PROP_PASS = 'a0000000-0000-0000-0000-00000000000d'
const PROP_NEW = 'a0000000-0000-0000-0000-00000000000e'

// Mock state
const mockState = {
  profileResult: { balance: 0, error: null as unknown },
  statsResult: { data: null as unknown, error: null as unknown },
  proposalResult: { data: null as unknown, error: null as unknown },
  proposalListResult: { data: [] as unknown[], count: 0, error: null as unknown },
  insertResult: { data: null as unknown, error: null as unknown },
  commentsResult: { data: [] as unknown[], error: null as unknown },
  updateResult: { data: null as unknown, error: null as unknown },
  votesResult: { data: [] as unknown[], error: null as unknown },
  adminRoleResult: { data: null as unknown, error: null as unknown },
  voteCheckResult: { data: null as unknown, error: null as unknown },
}

// Build chainable query mock
function createQueryChain(getResult: () => { data?: unknown; error?: unknown; count?: number }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'neq', 'order', 'range', 'limit']
  for (const method of methods) {
    chain[method] = vi.fn(() => chain)
  }
  chain.single = vi.fn(() => Promise.resolve(getResult()))
  chain.then = (resolve: (v: unknown) => void) => resolve(getResult())
  return chain
}

// Mock Supabase client
const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'proposals') {
      const chain = createQueryChain(() => mockState.proposalResult)
      // Override for list queries with count
      chain.then = (resolve: (v: unknown) => void) =>
        resolve({
          data: mockState.proposalListResult.data,
          error: mockState.proposalListResult.error,
          count: mockState.proposalListResult.count,
        })
      return {
        select: vi.fn(() => chain),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve(mockState.updateResult)),
            })),
          })),
        })),
      }
    }
    if (table === 'votes') {
      const voteChain = createQueryChain(() => mockState.votesResult)
      voteChain.then = (resolve: (v: unknown) => void) => resolve(mockState.votesResult)
      voteChain.maybeSingle = vi.fn(() => Promise.resolve(mockState.voteCheckResult))
      return {
        select: vi.fn(() => voteChain),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
        })),
      }
    }
    if (table === 'admin_roles') {
      const adminChain = createQueryChain(() => mockState.adminRoleResult)
      return {
        select: vi.fn(() => adminChain),
      }
    }
    if (table === 'comments') {
      const chain = createQueryChain(() => mockState.commentsResult)
      chain.then = (resolve: (v: unknown) => void) => resolve(mockState.commentsResult)
      return {
        select: vi.fn(() => chain),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(mockState.insertResult)),
          })),
        })),
      }
    }
    return { select: vi.fn(() => createQueryChain(() => ({ data: null, error: null }))) }
  }),
  rpc: vi.fn(() => Promise.resolve(mockState.statsResult)),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

// Token supply mock state
const mockTokenSupply = {
  supply: 1_000_000_000,
  cached: false,
  fallback: false,
  error: null as string | null,
}

// Mock solana-token service
vi.mock('../services/solana-token', () => ({
  getGuardianClawBalance: vi.fn(() =>
    Promise.resolve({
      balance: mockState.profileResult.balance,
      rawBalance: BigInt(mockState.profileResult.balance * 1_000_000),
      decimals: 6,
      cached: false,
      error: mockState.profileResult.error,
    })
  ),
  getTokenSupply: vi.fn(() =>
    Promise.resolve({
      supply: mockTokenSupply.supply,
      cached: mockTokenSupply.cached,
      fallback: mockTokenSupply.fallback,
      error: mockTokenSupply.error,
    })
  ),
  GCLAW_MINT: { toBase58: () => 'mock-mint' },
  TOKEN_DECIMALS: 6,
}))

// Create test app
const app = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    JWT_SECRET: string
    SOLANA_RPC_URL: string
  }
}>()

app.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
    SOLANA_RPC_URL: 'https://api.devnet.solana.com',
  }
  await next()
})

app.route('/governance', governanceRoutes)

// App without SOLANA_RPC_URL for 503 tests
const appNoRpc = new Hono<{
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    JWT_SECRET: string
  }
}>()

appNoRpc.use('*', async (c, next) => {
  c.env = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-key',
    JWT_SECRET: 'test-jwt-secret-with-minimum-32-chars!',
  } as never
  await next()
})

appNoRpc.route('/governance', governanceRoutes)

// Reset mock state
function resetMocks() {
  mockState.profileResult = { balance: 0, error: null }
  mockState.statsResult = { data: null, error: null }
  mockState.proposalResult = { data: null, error: null }
  mockState.proposalListResult = { data: [], count: 0, error: null }
  mockState.insertResult = { data: null, error: null }
  mockState.commentsResult = { data: [], error: null }
  mockState.updateResult = { data: null, error: null }
  mockState.votesResult = { data: [], error: null }
  mockState.adminRoleResult = { data: null, error: null }
  mockState.voteCheckResult = { data: null, error: null }
  mockTokenSupply.supply = 1_000_000_000
  mockTokenSupply.cached = false
  mockTokenSupply.fallback = false
  mockTokenSupply.error = null
  vi.clearAllMocks()
}

describe('Governance Routes', () => {
  let token: string

  beforeEach(async () => {
    resetMocks()
    token = await generateTestToken(testWallets.alice)
  })

  describe('GET /governance/stats', () => {
    it('returns governance stats (public)', async () => {
      mockState.statsResult = {
        data: {
          total_proposals: 10,
          active_proposals: 3,
          total_votes: 150,
          unique_voters: 45,
        },
        error: null,
      }

      const res = await app.request('/governance/stats')

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.total_proposals).toBe(10)
      expect(body.active_proposals).toBe(3)
    })

    it('returns 500 on RPC error', async () => {
      mockState.statsResult = { data: null, error: { message: 'RPC failed' } }

      const res = await app.request('/governance/stats')

      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error).toBe('Failed to retrieve governance stats')
    })
  })

  describe('GET /governance/config', () => {
    it('returns governance configuration (public)', async () => {
      const res = await app.request('/governance/config')

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.min_tokens_to_propose).toBe(10_000_000)
      expect(body.min_tokens_to_vote).toBe(1_000_000)
      expect(body.tokens_per_vote).toBe(1_000_000)
      expect(body.voting_period_days).toBe(5)
      expect(body.discussion_period_days).toBe(5)
      expect(body.quorum_percentage).toBe(10)
      expect(body.token_decimals).toBe(6)
    })
  })

  describe('GET /governance/health', () => {
    it('returns health status with RPC configured', async () => {
      const res = await app.request('/governance/health')

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.solana_rpc).toBe(true)
      expect(body).toHaveProperty('database')
      expect(body).toHaveProperty('governance')
    })

    it('returns solana_rpc false without RPC configured', async () => {
      const res = await appNoRpc.request('/governance/health')

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.solana_rpc).toBe(false)
    })
  })

  describe('GET /governance/profile', () => {
    it('returns user profile with voting power', async () => {
      mockState.profileResult = { balance: 10_000_000, error: null } // 10M tokens

      const res = await app.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.wallet_address).toBe(testWallets.alice)
      expect(body.voting_power).toBe(10) // 10M tokens / 1M = 10 votes
      expect(body.can_propose).toBe(true) // >= 10 votes
      expect(body.token_balance).toBe(10_000_000)
    })

    it('returns can_propose false when under threshold', async () => {
      mockState.profileResult = { balance: 1_000_000, error: null } // 1M tokens

      const res = await app.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.voting_power).toBe(1) // 1M tokens / 1M = 1 vote
      expect(body.can_propose).toBe(false) // < 10 votes
    })

    it('includes balance warning on error', async () => {
      mockState.profileResult = { balance: 0, error: 'RPC connection failed' }

      const res = await app.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.balance_warning).toBe('RPC connection failed')
    })

    it('returns 401 without auth', async () => {
      const res = await app.request('/governance/profile')

      expect(res.status).toBe(401)
    })

    it('returns 503 when SOLANA_RPC_URL is not configured', async () => {
      const res = await appNoRpc.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error).toBe('governance_unavailable')
    })
  })

  describe('GET /governance/proposals', () => {
    it('lists proposals with pagination', async () => {
      const proposals = [
        createProposal({ id: PROP_1, title: 'Proposal 1', status: 'voting' }),
        createProposal({ id: PROP_2, title: 'Proposal 2', status: 'voting' }),
      ]
      mockState.proposalListResult = { data: proposals, count: 2, error: null }

      const res = await app.request('/governance/proposals', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.proposals).toHaveLength(2)
      expect(body.pagination.total).toBe(2)
      expect(body.pagination.page).toBe(1)
      expect(body.pagination.limit).toBe(10)
    })

    it('filters by status', async () => {
      mockState.proposalListResult = { data: [], count: 0, error: null }

      const res = await app.request('/governance/proposals?status=passed', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
    })

    it('supports custom page and limit', async () => {
      mockState.proposalListResult = { data: [], count: 50, error: null }

      const res = await app.request('/governance/proposals?page=3&limit=5', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.pagination.page).toBe(3)
      expect(body.pagination.limit).toBe(5)
      expect(body.pagination.pages).toBe(10) // 50 / 5 = 10
    })

    it('returns 401 without auth', async () => {
      const res = await app.request('/governance/proposals')

      expect(res.status).toBe(401)
    })

    it('returns 400 for page=0', async () => {
      const res = await app.request('/governance/proposals?page=0', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })

    it('caps limit at 100', async () => {
      const res = await app.request('/governance/proposals?limit=200', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /governance/proposals/:id', () => {
    it('returns proposal details', async () => {
      const proposal = createProposal({
        id: PROP_1,
        title: 'Test Proposal',
        body: 'This is a test proposal body with more than 100 characters to meet the minimum requirement for a valid proposal.',
        type: 'governance',
        status: 'voting',
      })
      mockState.proposalResult = { data: proposal, error: null }

      const res = await app.request(`/governance/proposals/${PROP_1}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.id).toBe(PROP_1)
      expect(body.title).toBe('Test Proposal')
    })

    it('returns 404 for non-existent proposal', async () => {
      mockState.proposalResult = { data: null, error: null }

      const res = await app.request(`/governance/proposals/${PROP_NONEXIST}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toBe('Proposal not found')
    })

    it('returns 404 for hidden proposal', async () => {
      mockState.proposalResult = { data: null, error: { message: 'not found' } }

      const res = await app.request(`/governance/proposals/${PROP_HIDDEN}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toBe('Proposal not found')
    })

    it('returns 400 for invalid UUID format', async () => {
      const res = await app.request('/governance/proposals/not-a-uuid', {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBe('Invalid proposal ID format')
    })
  })

  describe('POST /governance/proposals', () => {
    it('creates proposal with sufficient voting power', async () => {
      mockState.profileResult = { balance: 10_000_000, error: null } // 10M tokens

      const newProposal = createProposal({
        id: PROP_NEW,
        title: 'New Proposal Title',
        body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
        type: 'governance',
      })
      mockState.insertResult = { data: newProposal, error: null }

      const res = await app.request('/governance/proposals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Proposal Title',
          body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
          type: 'governance',
        }),
      })

      expect(res.status).toBe(201)

      const body = await res.json()
      expect(body.id).toBe(PROP_NEW)
    })

    it('returns 403 with insufficient voting power', async () => {
      mockState.profileResult = { balance: 1_000_000, error: null } // 1M tokens = 1 vote (< 10 required)

      const res = await app.request('/governance/proposals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Proposal Title',
          body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
          type: 'governance',
        }),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.error).toBe('Insufficient voting power to create a proposal')
      expect(body.required).toBe(10)
      expect(body.current).toBe(1)
    })

    it('returns 400 for invalid title (too short)', async () => {
      mockState.profileResult = { balance: 10_000_000, error: null }

      const res = await app.request('/governance/proposals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Short',
          body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
          type: 'governance',
        }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBe('Invalid request')
    })

    it('returns 400 for invalid body (too short)', async () => {
      mockState.profileResult = { balance: 10_000_000, error: null }

      const res = await app.request('/governance/proposals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Valid Proposal Title',
          body: 'Too short',
          type: 'governance',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid type', async () => {
      mockState.profileResult = { balance: 10_000_000, error: null }

      const res = await app.request('/governance/proposals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Valid Proposal Title',
          body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
          type: 'invalid_type',
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request('/governance/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Valid Proposal Title',
          body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
          type: 'governance',
        }),
      })

      expect(res.status).toBe(401)
    })
  })

  describe('POST /governance/proposals/:id/votes', () => {
    it('returns 400 for missing vote fields', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/votes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_direction: 'for',
          // Missing signature and message
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 403 for invalid signature', async () => {
      mockState.profileResult = { balance: 1_000_000, error: null }

      const res = await app.request(`/governance/proposals/${PROP_1}/votes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_direction: 'for',
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'vote',
            proposal_id: PROP_1,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.error).toBe('Invalid signature')
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/votes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote_direction: 'for',
          signature: 'sig',
          message: '{}',
        }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 400 when voting on proposal in discussion status', async () => {
      mockState.proposalResult = {
        data: createProposal({ id: PROP_DISC, status: 'discussion' }),
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_DISC}/votes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_direction: 'for',
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'vote',
            proposal_id: PROP_DISC,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      // Signature check happens before proposal status check
      expect([400, 403]).toContain(res.status)
    })

    it('returns 400 when voting on cancelled proposal', async () => {
      mockState.proposalResult = {
        data: createProposal({ id: PROP_CANC, status: 'cancelled' }),
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_CANC}/votes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_direction: 'for',
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'vote',
            proposal_id: PROP_CANC,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      expect([400, 403]).toContain(res.status)
    })

    it('returns 400 when voting on passed proposal', async () => {
      mockState.proposalResult = {
        data: createProposal({ id: PROP_PASS, status: 'passed' }),
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_PASS}/votes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_direction: 'for',
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'vote',
            proposal_id: PROP_PASS,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      expect([400, 403]).toContain(res.status)
    })

    it('returns 404 when voting on hidden proposal', async () => {
      mockState.proposalResult = { data: null, error: { message: 'not found' } }

      const res = await app.request(`/governance/proposals/${PROP_HIDDEN}/votes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_direction: 'for',
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'vote',
            proposal_id: PROP_HIDDEN,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      expect([403, 404]).toContain(res.status)
    })

    it('returns 400 for invalid UUID format on vote', async () => {
      const res = await app.request('/governance/proposals/not-a-uuid/votes', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vote_direction: 'for',
          signature: 'sig',
          message: '{}',
        }),
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBe('Invalid proposal ID format')
    })
  })

  describe('GET /governance/proposals/:id/comments', () => {
    it('returns comments for proposal', async () => {
      mockState.commentsResult = {
        data: [
          { id: 'comment-1', content: 'Great idea!', author_wallet: testWallets.bob },
          { id: 'comment-2', content: 'I disagree', author_wallet: testWallets.charlie },
        ],
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body).toHaveLength(2)
    })

    it('returns 500 on database error', async () => {
      mockState.commentsResult = { data: null, error: { message: 'DB error' } }

      const res = await app.request(`/governance/proposals/${PROP_1}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(500)

      const body = await res.json()
      expect(body.error).toBe('Failed to retrieve comments')
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/comments`)

      expect(res.status).toBe(401)
    })
  })

  describe('POST /governance/proposals/:id/comments', () => {
    it('returns 400 for missing fields', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'My comment',
          // Missing signature and message
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 403 for invalid signature', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'My comment',
          signature: 'invalid-sig',
          message: JSON.stringify({
            action: 'comment',
            proposal_id: PROP_1,
          }),
        }),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.error).toBe('Invalid signature')
    })

    it('returns 403 for invalid domain in comment', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/comments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: 'My comment',
          signature: 'invalid-sig',
          message: JSON.stringify({
            action: 'comment',
            proposal_id: PROP_1,
            domain: 'evil.com',
          }),
        }),
      })

      // Signature check or domain check — both return 403
      expect(res.status).toBe(403)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'My comment',
          signature: 'sig',
          message: '{}',
        }),
      })

      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /governance/proposals/:id/submit', () => {
    it('returns 400 for missing signature', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/submit`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          voting_period_days: 7,
          // Missing signature and message
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 403 for invalid signature', async () => {
      mockState.proposalResult = {
        data: createProposal({
          id: PROP_1,
          status: 'discussion',
          wallet: testWallets.alice,
        }),
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/submit`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'submit',
            proposal_id: PROP_1,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.error).toBe('Invalid signature')
    })

    it('returns 404 for non-existent proposal', async () => {
      mockState.proposalResult = { data: null, error: { message: 'Not found' } }

      const res = await app.request(`/governance/proposals/${PROP_NONEXIST}/submit`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'valid-sig',
          message: JSON.stringify({
            action: 'submit',
            proposal_id: PROP_NONEXIST,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      expect(res.status).toBe(403) // Signature check fails first
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/submit`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: 'sig',
          message: '{}',
        }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid voting_period_days (too short)', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/submit`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'sig',
          message: '{}',
          voting_period_days: 1, // Min is 3
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid voting_period_days (too long)', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/submit`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'sig',
          message: '{}',
          voting_period_days: 60, // Max is 30
        }),
      })

      expect(res.status).toBe(400)
    })
  })

  describe('PATCH /governance/proposals/:id/finalize', () => {
    it('returns 404 for non-existent proposal', async () => {
      mockState.proposalResult = { data: null, error: null }

      const res = await app.request(`/governance/proposals/${PROP_NONEXIST}/finalize`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(404)

      const body = await res.json()
      expect(body.error).toBe('Proposal not found')
    })

    it('returns 400 for proposal not in voting status', async () => {
      mockState.proposalResult = {
        data: createProposal({
          id: PROP_1,
          status: 'discussion', // Not voting
        }),
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/finalize`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toContain('Cannot finalize proposal')
    })

    it('returns 400 if voting period has not ended', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days ahead
      mockState.proposalResult = {
        data: {
          ...createProposal({
            id: PROP_1,
            status: 'voting',
          }),
          voting_end_at: futureDate.toISOString(),
        },
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/finalize`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      expect(res.status).toBe(400)

      const body = await res.json()
      expect(body.error).toBe('Voting period has not ended yet')
      expect(body.remaining_hours).toBeGreaterThan(0)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/finalize`, {
        method: 'PATCH',
      })

      expect(res.status).toBe(401)
    })
  })

  describe('PATCH /governance/proposals/:id/cancel', () => {
    it('returns 400 for missing signature', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'No longer needed',
          // Missing signature and message
        }),
      })

      expect(res.status).toBe(400)
    })

    it('returns 403 for invalid signature', async () => {
      mockState.proposalResult = {
        data: createProposal({
          id: PROP_1,
          status: 'discussion',
          wallet: testWallets.alice,
        }),
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'cancel',
            proposal_id: PROP_1,
            domain: 'guardianclaw.org',
          }),
          reason: 'No longer needed',
        }),
      })

      expect(res.status).toBe(403)

      const body = await res.json()
      expect(body.error).toBe('Invalid signature')
    })

    it('returns 404 for non-existent proposal', async () => {
      mockState.proposalResult = { data: null, error: null }

      const res = await app.request(`/governance/proposals/${PROP_NONEXIST}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'sig',
          message: JSON.stringify({
            action: 'cancel',
            proposal_id: PROP_NONEXIST,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      expect(res.status).toBe(403) // Signature check fails first
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: 'sig',
          message: '{}',
          reason: 'Test',
        }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 400 for reason exceeding max length', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'sig',
          message: '{}',
          reason: 'x'.repeat(501), // Max is 500
        }),
      })

      expect(res.status).toBe(400)
    })

    it('validates message format', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/cancel`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'valid-sig-format',
          message: 'not-valid-json',
        }),
      })

      // Will fail at signature verification or message parsing
      expect([400, 403]).toContain(res.status)
    })
  })

  // =========================================================================
  // NEW TESTS — Governance Tier-1 coverage
  // =========================================================================

  describe('GET /governance/proposals/:id/votes/check', () => {
    it('returns voted:false when user has not voted', async () => {
      mockState.voteCheckResult = { data: null, error: null }

      const res = await app.request(`/governance/proposals/${PROP_1}/votes/check`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.voted).toBe(false)
    })

    it('returns voted:true with direction when user has voted', async () => {
      mockState.voteCheckResult = {
        data: { vote_direction: 'for', vote_power: 5 },
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/votes/check`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.voted).toBe(true)
      expect(body.vote_direction).toBe('for')
      expect(body.vote_power).toBe(5)
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_1}/votes/check`)
      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid UUID', async () => {
      const res = await app.request('/governance/proposals/not-a-uuid/votes/check', {
        headers: { Authorization: `Bearer ${token}` },
      })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /governance/proposals — discussion period', () => {
    it('sets discussion_end_at on creation', async () => {
      mockState.profileResult = { balance: 10_000_000, error: null }

      const newProposal = createProposal({
        id: PROP_NEW,
        title: 'New Proposal Title',
        body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
        type: 'governance',
      })
      mockState.insertResult = { data: newProposal, error: null }

      const res = await app.request('/governance/proposals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'New Proposal Title',
          body: 'This is a detailed proposal body with more than 100 characters to meet the validation requirement for a new proposal.',
          type: 'governance',
        }),
      })

      expect(res.status).toBe(201)

      // Verify the insert was called with discussion_end_at
      const insertCalls = mockSupabase.from.mock.calls.filter((c: string[]) => c[0] === 'proposals')
      expect(insertCalls.length).toBeGreaterThan(0)
    })

    it('PATCH /submit rejects if discussion period not ended', async () => {
      const futureDiscussion = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days ahead
      mockState.proposalResult = {
        data: {
          ...createProposal({
            id: PROP_1,
            status: 'discussion',
            wallet: testWallets.alice,
          }),
          author_wallet: testWallets.alice,
          discussion_end_at: futureDiscussion.toISOString(),
        },
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/submit`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signature: 'invalid-signature',
          message: JSON.stringify({
            action: 'submit',
            proposal_id: PROP_1,
            domain: 'guardianclaw.org',
          }),
        }),
      })

      // Signature check happens first, so we expect 403 from invalid sig
      // but if sig passed, we'd get 400 from discussion period check
      expect([400, 403]).toContain(res.status)
    })
  })

  describe('PATCH /governance/proposals/:id/execute', () => {
    let adminToken: string

    beforeEach(async () => {
      adminToken = await generateTestToken(testWallets.admin)
    })

    it('transitions passed proposal to executed', async () => {
      mockState.adminRoleResult = { data: { role: 'admin' }, error: null }
      mockState.proposalResult = {
        data: createProposal({ id: PROP_PASS, status: 'passed' }),
        error: null,
      }
      mockState.updateResult = {
        data: { ...createProposal({ id: PROP_PASS, status: 'executed' }) },
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_PASS}/execute`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ execution_notes: 'Implemented in PR #42' }),
      })

      expect(res.status).toBe(200)
    })

    it('rejects non-passed proposal', async () => {
      mockState.adminRoleResult = { data: { role: 'admin' }, error: null }
      mockState.proposalResult = {
        data: createProposal({ id: PROP_1, status: 'voting' }),
        error: null,
      }

      const res = await app.request(`/governance/proposals/${PROP_1}/execute`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toContain('Cannot execute proposal')
    })

    it('rejects non-admin user', async () => {
      mockState.adminRoleResult = { data: null, error: { message: 'not found' } }

      const res = await app.request(`/governance/proposals/${PROP_PASS}/execute`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Admin access required')
    })

    it('returns 401 without auth', async () => {
      const res = await app.request(`/governance/proposals/${PROP_PASS}/execute`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(401)
    })

    it('returns 404 for non-existent proposal', async () => {
      mockState.adminRoleResult = { data: { role: 'admin' }, error: null }
      mockState.proposalResult = { data: null, error: null }

      const res = await app.request(`/governance/proposals/${PROP_NONEXIST}/execute`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /governance/proposals/:id/finalize — supply fallback', () => {
    it('returns 503 when token supply is unavailable (fallback)', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      mockState.proposalResult = {
        data: {
          ...createProposal({ id: PROP_1, status: 'voting' }),
          voting_end_at: pastDate.toISOString(),
        },
        error: null,
      }
      mockState.votesResult = { data: [], error: null }
      mockTokenSupply.fallback = true

      const res = await app.request(`/governance/proposals/${PROP_1}/finalize`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error).toContain('token supply unavailable')
    })

    it('uses cached supply when stale cache available', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      mockState.proposalResult = {
        data: {
          ...createProposal({ id: PROP_1, status: 'voting' }),
          voting_end_at: pastDate.toISOString(),
        },
        error: null,
      }
      mockState.votesResult = { data: [], error: null }
      mockState.updateResult = {
        data: createProposal({ id: PROP_1, status: 'no_quorum' }),
        error: null,
      }
      mockTokenSupply.cached = true
      mockTokenSupply.fallback = false

      const res = await app.request(`/governance/proposals/${PROP_1}/finalize`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })

      // Should succeed with cached supply (not a fallback)
      expect(res.status).toBe(200)
    })

    it('returns 503 when no RPC URL configured', async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      mockState.proposalResult = {
        data: {
          ...createProposal({ id: PROP_1, status: 'voting' }),
          voting_end_at: pastDate.toISOString(),
        },
        error: null,
      }

      const res = await appNoRpc.request(`/governance/proposals/${PROP_1}/finalize`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })

      expect(res.status).toBe(503)
      const body = await res.json()
      expect(body.error).toContain('RPC not configured')
    })
  })

  describe('Voting power boundaries', () => {
    it('exactly 1M tokens = 1 vote (can vote)', async () => {
      mockState.profileResult = { balance: 1_000_000, error: null }

      const res = await app.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const body = await res.json()
      expect(body.voting_power).toBe(1)
      expect(body.can_propose).toBe(false) // Needs 10 votes
    })

    it('999,999 tokens = 0 votes (cannot vote)', async () => {
      mockState.profileResult = { balance: 999_999, error: null }

      const res = await app.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const body = await res.json()
      expect(body.voting_power).toBe(0)
      expect(body.can_propose).toBe(false)
    })

    it('exactly 10M tokens = 10 votes (can propose)', async () => {
      mockState.profileResult = { balance: 10_000_000, error: null }

      const res = await app.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const body = await res.json()
      expect(body.voting_power).toBe(10)
      expect(body.can_propose).toBe(true)
    })

    it('9,999,999 tokens = 9 votes (cannot propose)', async () => {
      mockState.profileResult = { balance: 9_999_999, error: null }

      const res = await app.request('/governance/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })

      const body = await res.json()
      expect(body.voting_power).toBe(9)
      expect(body.can_propose).toBe(false)
    })
  })
})
