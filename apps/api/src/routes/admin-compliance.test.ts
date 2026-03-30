/**
 * Admin Compliance Routes Tests
 *
 * Comprehensive test coverage for admin compliance endpoints:
 * - Platform statistics
 * - GDPR request listing with filters
 * - GDPR request details
 * - GDPR request status updates
 * - Deletion audit listing
 * - Compliance report generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ============================================
// MOCK SETUP
// ============================================

const createMockStats = () => ({
  total_requests: 45,
  pending_requests: 5,
  in_progress_requests: 3,
  completed_requests: 35,
  rejected_requests: 2,
  requests_7d: 8,
  requests_30d: 20,
  avg_completion_hours: 24.5,
  total_deletions: 30,
  deletions_7d: 5,
  deletions_30d: 15,
  by_request_type: { export: 20, deletion: 15, access: 8, rectification: 2 },
  by_status: { pending: 5, in_progress: 3, completed: 35, rejected: 2 },
})

const createMockRequest = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  wallet_address: 'UserWallet123456789012345678901234567890',
  display_name: 'Test User',
  request_type: 'export',
  status: 'pending',
  requested_at: '2026-01-20T10:30:00Z',
  completed_at: null,
  admin_wallet_hash: null,
  created_at: '2026-01-20T10:30:00Z',
  total_count: 45,
  ...overrides,
})

const createMockRequestDetails = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  wallet_address: 'UserWallet123456789012345678901234567890',
  display_name: 'Test User',
  request_type: 'export',
  status: 'pending',
  requested_at: '2026-01-20T10:30:00Z',
  completed_at: null,
  admin_wallet_hash: null,
  notes: null,
  metadata: {},
  created_at: '2026-01-20T10:30:00Z',
  updated_at: null,
  ...overrides,
})

const createMockDeletion = (overrides = {}) => ({
  id: '660e8400-e29b-41d4-a716-446655440000',
  wallet_hash: 'hash123456789012345678901234567890',
  data_categories: ['profile', 'agents', 'usage'],
  retained_categories: ['audit_log'],
  retention_reason: 'Legal requirement',
  deletion_date: '2026-01-15T10:30:00Z',
  request_id: '550e8400-e29b-41d4-a716-446655440000',
  created_at: '2026-01-15T10:30:00Z',
  total_count: 30,
  ...overrides,
})

const mockState = {
  statsResult: createMockStats(),
  requestsListResult: [
    createMockRequest(),
    createMockRequest({ id: '550e8400-e29b-41d4-a716-446655440001' }),
  ],
  requestDetailsResult: [createMockRequestDetails()],
  deletionsListResult: [
    createMockDeletion(),
    createMockDeletion({ id: '660e8400-e29b-41d4-a716-446655440001' }),
  ],
  updateRequestResult: {
    success: true,
    status: 'completed',
    completed_at: '2026-01-21T10:00:00Z',
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
        case 'admin_get_compliance_stats':
          return Promise.resolve({ data: [mockState.statsResult], error: null })
        case 'admin_list_gdpr_requests':
          return Promise.resolve({ data: mockState.requestsListResult, error: null })
        case 'admin_get_gdpr_request_details':
          if (mockState.simulateNotFound) {
            return Promise.resolve({ data: [], error: null })
          }
          return Promise.resolve({ data: mockState.requestDetailsResult, error: null })
        case 'admin_update_gdpr_request':
          return Promise.resolve({ data: [mockState.updateRequestResult], error: null })
        case 'admin_list_deletion_audit':
          return Promise.resolve({ data: mockState.deletionsListResult, error: null })
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

import { adminComplianceRoutes } from './admin-compliance'

describe('Admin Compliance Routes', () => {
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
      c.set('adminPermissions', { dashboards: ['compliance'], actions: ['process_gdpr'] })
      await next()
    })

    app.route('/admin/compliance', adminComplianceRoutes)
  })

  // ============================================
  // GET /admin/compliance/stats
  // ============================================

  describe('GET /admin/compliance/stats', () => {
    it('should return compliance statistics', async () => {
      const res = await app.request('/admin/compliance/stats')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('request_types')
      expect(data).toHaveProperty('statuses')
      expect(data.stats.total_requests).toBe(45)
      expect(data.stats.pending_requests).toBe(5)
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/compliance/stats')
      expect(res.status).toBe(500)
    })
  })

  // ============================================
  // GET /admin/compliance/requests
  // ============================================

  describe('GET /admin/compliance/requests', () => {
    it('should return paginated GDPR requests', async () => {
      const res = await app.request('/admin/compliance/requests?limit=20&offset=0')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('requests')
      expect(data).toHaveProperty('pagination')
      expect(Array.isArray(data.requests)).toBe(true)
    })

    it('should accept filter parameters', async () => {
      const res = await app.request('/admin/compliance/requests?request_type=export&status=pending')
      expect(res.status).toBe(200)
    })

    it('should validate query parameters', async () => {
      const res = await app.request('/admin/compliance/requests?limit=1000')
      expect(res.status).toBe(400)
    })

    it('should validate request type enum', async () => {
      const res = await app.request('/admin/compliance/requests?request_type=invalid')
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // GET /admin/compliance/requests/:id
  // ============================================

  describe('GET /admin/compliance/requests/:id', () => {
    it('should return request details', async () => {
      const res = await app.request(
        '/admin/compliance/requests/550e8400-e29b-41d4-a716-446655440000'
      )
      expect(res.status).toBe(200)
    })

    it('should return 400 for invalid UUID', async () => {
      const res = await app.request('/admin/compliance/requests/invalid-id')
      expect(res.status).toBe(400)
    })

    it('should return 404 when request not found', async () => {
      mockState.simulateNotFound = true
      const res = await app.request(
        '/admin/compliance/requests/550e8400-e29b-41d4-a716-446655440000'
      )
      expect(res.status).toBe(404)
    })
  })

  // ============================================
  // PATCH /admin/compliance/requests/:id
  // ============================================

  describe('PATCH /admin/compliance/requests/:id', () => {
    it('should update request status', async () => {
      const res = await app.request(
        '/admin/compliance/requests/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', notes: 'Data exported successfully' }),
        }
      )
      expect(res.status).toBe(200)
    })

    it('should validate status enum', async () => {
      const res = await app.request(
        '/admin/compliance/requests/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'invalid_status' }),
        }
      )
      expect(res.status).toBe(400)
    })

    it('should validate UUID format', async () => {
      const res = await app.request('/admin/compliance/requests/invalid-id', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      expect(res.status).toBe(400)
    })

    it('should allow optional notes', async () => {
      const res = await app.request(
        '/admin/compliance/requests/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' }),
        }
      )
      expect(res.status).toBe(200)
    })
  })

  // ============================================
  // GET /admin/compliance/deletions
  // ============================================

  describe('GET /admin/compliance/deletions', () => {
    it('should return paginated deletion audit records', async () => {
      const res = await app.request('/admin/compliance/deletions?limit=20&offset=0')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('deletions')
      expect(data).toHaveProperty('pagination')
      expect(Array.isArray(data.deletions)).toBe(true)
    })

    it('should accept search parameter', async () => {
      const res = await app.request('/admin/compliance/deletions?search=hash123')
      expect(res.status).toBe(200)
    })

    it('should validate query parameters', async () => {
      const res = await app.request('/admin/compliance/deletions?limit=1000')
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // GET /admin/compliance/report
  // ============================================

  describe('GET /admin/compliance/report', () => {
    it('should validate date parameters are required', async () => {
      const res = await app.request('/admin/compliance/report')
      expect(res.status).toBe(400)
    })

    it('should validate date format', async () => {
      const res = await app.request('/admin/compliance/report?start_date=invalid&end_date=invalid')
      expect(res.status).toBe(400)
    })

    it('should validate start date before end date', async () => {
      const res = await app.request(
        '/admin/compliance/report?start_date=2026-01-20T00:00:00Z&end_date=2026-01-15T00:00:00Z'
      )
      expect(res.status).toBe(400)
    })

    it('should validate period does not exceed 1 year', async () => {
      const res = await app.request(
        '/admin/compliance/report?start_date=2025-01-01T00:00:00Z&end_date=2026-06-01T00:00:00Z'
      )
      expect(res.status).toBe(400)
    })
  })
})
