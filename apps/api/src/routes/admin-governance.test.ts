/**
 * Admin Governance Routes Tests
 *
 * Comprehensive test coverage for admin governance endpoints:
 * - Platform statistics
 * - Proposal listing with filters
 * - Proposal details
 * - Proposal visibility moderation
 * - Vote listing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ============================================
// MOCK SETUP
// ============================================

const createMockStats = () => ({
  total_proposals: 50,
  active_proposals: 8,
  hidden_proposals: 2,
  passed_proposals: 25,
  rejected_proposals: 10,
  unique_voters: 150,
  total_votes: 1200,
  total_comments: 450,
  proposals_7d: 3,
  proposals_30d: 12,
  votes_7d: 180,
  participation_rate: 0.65,
  by_status: { draft: 5, discussion: 3, voting: 5, passed: 25, rejected: 10, cancelled: 2 },
  by_type: { feature: 20, governance: 15, seed: 10, docs: 5 },
})

const createMockProposal = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  number: 42,
  title: 'Test Proposal',
  type: 'feature',
  status: 'voting',
  author_wallet: 'TestWallet123456789012345678901234567890',
  author_name: 'Test User',
  is_hidden: false,
  hidden_at: null,
  hidden_reason: null,
  votes_for: 500,
  votes_against: 150,
  comments_count: 10,
  created_at: '2026-01-15T10:30:00Z',
  voting_end_at: '2026-01-22T10:30:00Z',
  total_count: 50,
  ...overrides,
})

const createMockProposalDetails = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  number: 42,
  title: 'Test Proposal',
  body: 'This is the proposal body text.',
  type: 'feature',
  status: 'voting',
  author_wallet: 'TestWallet123456789012345678901234567890',
  author_name: 'Test User',
  is_hidden: false,
  hidden_at: null,
  hidden_by: null,
  hidden_reason: null,
  votes_for: 500,
  votes_against: 150,
  quorum_required: 1000,
  majority_required: 60,
  comments_count: 10,
  discussion_end_at: '2026-01-18T10:30:00Z',
  voting_start_at: '2026-01-18T10:30:00Z',
  voting_end_at: '2026-01-22T10:30:00Z',
  created_at: '2026-01-15T10:30:00Z',
  updated_at: '2026-01-20T14:30:00Z',
  ...overrides,
})

const createMockVote = (overrides = {}) => ({
  wallet_address: 'VoterWallet123456789012345678901234567890',
  display_name: 'Voter User',
  vote_direction: 'for',
  voting_power: 10000,
  created_at: '2026-01-19T14:30:00Z',
  total_count: 50,
  ...overrides,
})

const mockState = {
  statsResult: createMockStats(),
  proposalsListResult: [
    createMockProposal(),
    createMockProposal({ id: '550e8400-e29b-41d4-a716-446655440001', number: 43 }),
  ],
  proposalDetailsResult: [createMockProposalDetails()],
  votesResult: [createMockVote()],
  toggleVisibilityResult: {
    success: true,
    is_hidden: true,
    hidden_at: '2026-01-21T10:00:00Z',
    error: null,
  },
  simulateError: false,
  simulateNotFound: false,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn((fn: string, _params?: Record<string, unknown>) => {
      if (mockState.simulateError) {
        return Promise.resolve({ data: null, error: { message: 'Database error' } })
      }

      switch (fn) {
        case 'admin_get_governance_stats':
          return Promise.resolve({ data: [mockState.statsResult], error: null })
        case 'admin_list_proposals':
          return Promise.resolve({ data: mockState.proposalsListResult, error: null })
        case 'admin_get_proposal_details':
          if (mockState.simulateNotFound) {
            return Promise.resolve({ data: [], error: null })
          }
          return Promise.resolve({ data: mockState.proposalDetailsResult, error: null })
        case 'admin_get_proposal_votes':
          return Promise.resolve({ data: mockState.votesResult, error: null })
        case 'admin_toggle_proposal_visibility':
          return Promise.resolve({ data: [mockState.toggleVisibilityResult], error: null })
        default:
          return Promise.resolve({ data: null, error: null })
      }
    }),
  })),
}))

vi.mock('../middleware/admin-auth', () => ({
  adminAuthMiddleware: vi.fn((c, next) => next()),
  requireDashboard: vi.fn(() => (c: unknown, next: () => Promise<void>) => next()),
  requireRole: vi.fn(() => (c: unknown, next: () => Promise<void>) => next()),
  requireAction: vi.fn(() => (c: unknown, next: () => Promise<void>) => next()),
}))

vi.mock('../middleware/admin-audit', () => ({
  adminAuditMiddleware: vi.fn((c, next) => next()),
}))

import { adminGovernanceRoutes } from './admin-governance'

describe('Admin Governance Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.simulateError = false
    mockState.simulateNotFound = false

    app = new Hono()

    app.use('*', async (c, next) => {
      c.env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_KEY: 'test-key',
        JWT_SECRET: 'test-secret',
      }
      c.set('wallet', 'AdminWallet123')
      c.set('walletHash', 'hash123')
      c.set('adminRole', 'admin')
      c.set('adminPermissions', { dashboards: ['governance'], actions: ['moderate_proposals'] })
      await next()
    })

    app.route('/admin/governance', adminGovernanceRoutes)
  })

  // ============================================
  // GET /admin/governance/stats
  // ============================================

  describe('GET /admin/governance/stats', () => {
    it('should return governance statistics', async () => {
      const res = await app.request('/admin/governance/stats')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('statuses')
      expect(data).toHaveProperty('types')
      expect(data.stats.total_proposals).toBe(50)
      expect(data.stats.active_proposals).toBe(8)
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/governance/stats')
      expect(res.status).toBe(500)
    })
  })

  // ============================================
  // GET /admin/governance/proposals
  // ============================================

  describe('GET /admin/governance/proposals', () => {
    it('should return paginated proposals', async () => {
      const res = await app.request('/admin/governance/proposals?limit=20&offset=0')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('proposals')
      expect(data).toHaveProperty('pagination')
      expect(Array.isArray(data.proposals)).toBe(true)
    })

    it('should accept filter parameters', async () => {
      const res = await app.request('/admin/governance/proposals?status=voting&type=feature')
      expect(res.status).toBe(200)
    })

    it('should validate query parameters', async () => {
      const res = await app.request('/admin/governance/proposals?limit=1000')
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // GET /admin/governance/proposals/:id
  // ============================================

  describe('GET /admin/governance/proposals/:id', () => {
    it('should return proposal details', async () => {
      const res = await app.request(
        '/admin/governance/proposals/550e8400-e29b-41d4-a716-446655440000'
      )
      expect(res.status).toBe(200)
    })

    it('should return 400 for invalid UUID', async () => {
      const res = await app.request('/admin/governance/proposals/invalid-id')
      expect(res.status).toBe(400)
    })

    it('should return 404 when proposal not found', async () => {
      mockState.simulateNotFound = true
      const res = await app.request(
        '/admin/governance/proposals/550e8400-e29b-41d4-a716-446655440000'
      )
      expect(res.status).toBe(404)
    })
  })

  // ============================================
  // GET /admin/governance/proposals/:id/votes
  // ============================================

  describe('GET /admin/governance/proposals/:id/votes', () => {
    it('should return proposal votes', async () => {
      const res = await app.request(
        '/admin/governance/proposals/550e8400-e29b-41d4-a716-446655440000/votes'
      )
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('votes')
      expect(data).toHaveProperty('pagination')
    })

    it('should return 400 for invalid UUID', async () => {
      const res = await app.request('/admin/governance/proposals/invalid-id/votes')
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // PATCH /admin/governance/proposals/:id/visibility
  // ============================================

  describe('PATCH /admin/governance/proposals/:id/visibility', () => {
    it('should toggle proposal visibility with reason', async () => {
      const res = await app.request(
        '/admin/governance/proposals/550e8400-e29b-41d4-a716-446655440000/visibility',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: true, reason: 'Spam content detected' }),
        }
      )
      expect(res.status).toBe(200)
    })

    it('should require reason when hiding', async () => {
      const res = await app.request(
        '/admin/governance/proposals/550e8400-e29b-41d4-a716-446655440000/visibility',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: true }),
        }
      )
      expect(res.status).toBe(400)
    })

    it('should allow unhiding without reason', async () => {
      const res = await app.request(
        '/admin/governance/proposals/550e8400-e29b-41d4-a716-446655440000/visibility',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: false }),
        }
      )
      expect(res.status).toBe(200)
    })

    it('should validate UUID format', async () => {
      const res = await app.request('/admin/governance/proposals/invalid-id/visibility', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: true, reason: 'Test reason' }),
      })
      expect(res.status).toBe(400)
    })

    it('should validate reason length', async () => {
      const res = await app.request(
        '/admin/governance/proposals/550e8400-e29b-41d4-a716-446655440000/visibility',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hidden: true, reason: 'ab' }),
        }
      )
      expect(res.status).toBe(400)
    })
  })
})
