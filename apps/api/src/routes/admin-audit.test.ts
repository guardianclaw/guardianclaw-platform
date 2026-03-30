/**
 * Admin Audit Routes Tests
 *
 * Comprehensive test coverage for admin audit endpoints:
 * - Audit log statistics
 * - Audit log listing with filters
 * - Audit log export
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ============================================
// MOCK SETUP
// ============================================

const createMockAuditStats = () => ({
  total_entries: 5000,
  entries_24h: 150,
  entries_7d: 800,
  entries_30d: 3500,
  unique_admins: 5,
  by_action_type: { GET: 3000, POST: 1200, PATCH: 500, DELETE: 300 },
  by_target_type: { user: 1500, agent: 2000, deployment: 1000, alert: 500 },
  by_status_code: {
    '200': 4500,
    '201': 200,
    '400': 150,
    '401': 50,
    '403': 30,
    '404': 50,
    '500': 20,
  },
})

const createMockAuditLog = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  admin_wallet_hash: 'hash_abc123',
  action: 'GET /admin/users/search',
  target_type: 'user',
  target_id: 'user_123',
  details: { query: 'test' },
  ip_hash: 'ip_hash_xyz',
  request_id: 'req_123',
  status_code: 200,
  created_at: '2026-01-21T10:30:00Z',
  total_count: 100,
  ...overrides,
})

const mockState = {
  statsResult: createMockAuditStats(),
  logsResult: [
    createMockAuditLog(),
    createMockAuditLog({
      id: '550e8400-e29b-41d4-a716-446655440001',
      action: 'POST /admin/credits/adjust',
      target_type: 'credits',
      status_code: 201,
    }),
    createMockAuditLog({
      id: '550e8400-e29b-41d4-a716-446655440002',
      action: 'PATCH /admin/users/status',
      target_type: 'user',
      status_code: 200,
    }),
  ],
  simulateError: false,
  simulateEmpty: false,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn((fn: string, _params?: Record<string, unknown>) => {
      if (mockState.simulateError) {
        return Promise.resolve({ data: null, error: { message: 'Database error' } })
      }

      switch (fn) {
        case 'admin_get_audit_stats':
          return Promise.resolve({ data: [mockState.statsResult], error: null })
        case 'admin_list_audit_logs':
          if (mockState.simulateEmpty) {
            return Promise.resolve({ data: [], error: null })
          }
          return Promise.resolve({ data: mockState.logsResult, error: null })
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

import { adminAuditRoutes } from './admin-audit'

describe('Admin Audit Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    mockState.simulateError = false
    mockState.simulateEmpty = false

    app = new Hono()

    app.use('*', async (c, next) => {
      c.env = {
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_KEY: 'test-key',
        JWT_SECRET: 'test-secret',
      }
      c.set('wallet', 'AdminWallet123')
      c.set('walletHash', 'hash123')
      c.set('adminRole', 'super_admin')
      c.set('adminPermissions', { dashboards: ['audit'], actions: ['export_audit'] })
      await next()
    })

    app.route('/admin/audit', adminAuditRoutes)
  })

  // ============================================
  // GET /admin/audit/stats
  // ============================================

  describe('GET /admin/audit/stats', () => {
    it('should return audit statistics', async () => {
      const res = await app.request('/admin/audit/stats')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('action_types')
      expect(data).toHaveProperty('target_types')
      expect(data).toHaveProperty('status_codes')
      expect(data.stats.total_entries).toBe(5000)
    })

    it('should include breakdown by action type', async () => {
      const res = await app.request('/admin/audit/stats')
      const data = await res.json()
      expect(data.stats.by_action_type).toHaveProperty('GET')
      expect(data.stats.by_action_type).toHaveProperty('POST')
      expect(data.stats.by_action_type.GET).toBe(3000)
    })

    it('should include breakdown by status code', async () => {
      const res = await app.request('/admin/audit/stats')
      const data = await res.json()
      expect(data.stats.by_status_code).toHaveProperty('200')
      expect(data.stats.by_status_code['200']).toBe(4500)
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/audit/stats')
      expect(res.status).toBe(500)
    })
  })

  // ============================================
  // GET /admin/audit/logs
  // ============================================

  describe('GET /admin/audit/logs', () => {
    it('should return paginated audit logs', async () => {
      const res = await app.request('/admin/audit/logs?limit=50&offset=0')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('logs')
      expect(data).toHaveProperty('pagination')
      expect(data).toHaveProperty('filters')
      expect(Array.isArray(data.logs)).toBe(true)
    })

    it('should accept action_prefix filter', async () => {
      const res = await app.request('/admin/audit/logs?action_prefix=GET')
      expect(res.status).toBe(200)
    })

    it('should accept target_type filter', async () => {
      const res = await app.request('/admin/audit/logs?target_type=user')
      expect(res.status).toBe(200)
    })

    it('should accept status_code filter', async () => {
      const res = await app.request('/admin/audit/logs?status_code=200')
      expect(res.status).toBe(200)
    })

    it('should accept date range filters', async () => {
      const res = await app.request(
        '/admin/audit/logs?start_date=2026-01-01T00:00:00Z&end_date=2026-01-31T23:59:59Z'
      )
      expect(res.status).toBe(200)
    })

    it('should validate limit parameter', async () => {
      const res = await app.request('/admin/audit/logs?limit=500')
      expect(res.status).toBe(400)
    })

    it('should validate action_prefix enum', async () => {
      const res = await app.request('/admin/audit/logs?action_prefix=INVALID')
      expect(res.status).toBe(400)
    })

    it('should return empty array when no logs found', async () => {
      mockState.simulateEmpty = true
      const res = await app.request('/admin/audit/logs')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.logs).toEqual([])
      expect(data.pagination.total).toBe(0)
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/audit/logs')
      expect(res.status).toBe(500)
    })
  })

  // ============================================
  // GET /admin/audit/export
  // ============================================

  describe('GET /admin/audit/export', () => {
    it('should export logs as CSV', async () => {
      const res = await app.request('/admin/audit/export?format=csv')
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/csv')
      expect(res.headers.get('Content-Disposition')).toContain('audit_logs_')
      expect(res.headers.get('Content-Disposition')).toContain('.csv')
    })

    it('should export logs as JSON', async () => {
      const res = await app.request('/admin/audit/export?format=json')
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/json')
      expect(res.headers.get('Content-Disposition')).toContain('audit_logs_')
      expect(res.headers.get('Content-Disposition')).toContain('.json')
    })

    it('should default to CSV format', async () => {
      const res = await app.request('/admin/audit/export')
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('text/csv')
    })

    it('should accept filter parameters', async () => {
      const res = await app.request(
        '/admin/audit/export?format=csv&action_prefix=GET&status_code=200'
      )
      expect(res.status).toBe(200)
    })

    it('should validate max_rows parameter', async () => {
      const res = await app.request('/admin/audit/export?max_rows=100000')
      expect(res.status).toBe(400)
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/audit/export?format=csv')
      expect(res.status).toBe(500)
    })

    it('should include CSV headers in export', async () => {
      const res = await app.request('/admin/audit/export?format=csv')
      const text = await res.text()
      expect(text).toContain('id,')
      expect(text).toContain('admin_wallet_hash,')
      expect(text).toContain('action,')
    })

    it('should include metadata in JSON export', async () => {
      const res = await app.request('/admin/audit/export?format=json')
      const data = await res.json()
      expect(data).toHaveProperty('exported_at')
      expect(data).toHaveProperty('total_entries')
      expect(data).toHaveProperty('exported_count')
      expect(data).toHaveProperty('filters')
      expect(data).toHaveProperty('logs')
    })
  })
})
