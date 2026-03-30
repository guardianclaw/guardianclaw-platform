/**
 * Admin System Routes Tests
 *
 * Comprehensive test coverage for admin system endpoints:
 * - Platform configuration
 * - Feature flags
 * - Maintenance windows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ============================================
// MOCK SETUP
// ============================================

const createMockConfigItem = (overrides = {}) => ({
  key: 'rate_limits.default',
  value: { requests_per_minute: 100 },
  description: 'Default rate limit',
  category: 'limits',
  is_sensitive: false,
  updated_at: '2026-01-20T10:00:00Z',
  updated_by: 'admin_hash_123',
  ...overrides,
})

const createMockFeatureFlag = (overrides = {}) => ({
  id: 'governance_v2',
  name: 'Governance V2',
  description: 'New governance UI',
  is_enabled: true,
  rollout_percentage: 100,
  conditions: {},
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-01-20T10:00:00Z',
  updated_by: 'admin_hash_123',
  ...overrides,
})

const createMockMaintenanceWindow = (overrides = {}) => ({
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Scheduled Maintenance',
  description: 'Database upgrade',
  starts_at: '2026-01-25T02:00:00Z',
  ends_at: '2026-01-25T04:00:00Z',
  is_active: false,
  show_banner: true,
  affects_services: ['api', 'database'],
  created_by: 'admin_hash_123',
  created_at: '2026-01-20T10:00:00Z',
  ...overrides,
})

const createMockJobHealth = (overrides = {}) => ({
  job_name: 'aggregate_hourly_metrics',
  last_run: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
  last_status: 'success',
  last_duration_ms: 250,
  last_error: null,
  runs_24h: 24,
  failures_24h: 0,
  ...overrides,
})

const mockState = {
  configResult: [
    createMockConfigItem(),
    createMockConfigItem({
      key: 'pricing.cost_per_execution',
      value: { usd: 0.003 },
      category: 'pricing',
    }),
  ],
  flagsResult: [
    createMockFeatureFlag(),
    createMockFeatureFlag({
      id: 'analytics_v2',
      name: 'Analytics V2',
      is_enabled: false,
      rollout_percentage: 50,
    }),
  ],
  windowsResult: [
    createMockMaintenanceWindow(),
    createMockMaintenanceWindow({
      id: '550e8400-e29b-41d4-a716-446655440001',
      title: 'API Update',
    }),
  ],
  cronHealthResult: [
    createMockJobHealth(),
    createMockJobHealth({ job_name: 'check_alert_rules', runs_24h: 288, last_duration_ms: 150 }),
    createMockJobHealth({
      job_name: 'process_webhook_deliveries',
      runs_24h: 1440,
      last_duration_ms: 50,
    }),
  ],
  updateConfigResult: {
    success: true,
    key: 'rate_limits.default',
    value: { requests_per_minute: 200 },
    updated_at: '2026-01-21T10:00:00Z',
    error: null,
  },
  updateFlagResult: {
    success: true,
    id: 'governance_v2',
    is_enabled: false,
    rollout_percentage: 50,
    updated_at: '2026-01-21T10:00:00Z',
    error: null,
  },
  createWindowResult: {
    success: true,
    id: '550e8400-e29b-41d4-a716-446655440002',
    created_at: '2026-01-21T10:00:00Z',
    error: null,
  },
  deleteWindowResult: { success: true, error: null },
  toggleWindowResult: { success: true, is_active: true, error: null },
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
        case 'admin_get_system_config':
          return Promise.resolve({ data: mockState.configResult, error: null })
        case 'admin_update_config':
          if (mockState.simulateNotFound) {
            return Promise.resolve({
              data: [
                {
                  success: false,
                  key: null,
                  value: null,
                  updated_at: null,
                  error: 'CONFIG_NOT_FOUND',
                },
              ],
              error: null,
            })
          }
          return Promise.resolve({ data: [mockState.updateConfigResult], error: null })
        case 'admin_list_feature_flags':
          return Promise.resolve({ data: mockState.flagsResult, error: null })
        case 'admin_update_feature_flag':
          if (mockState.simulateNotFound) {
            return Promise.resolve({
              data: [
                {
                  success: false,
                  id: null,
                  is_enabled: null,
                  rollout_percentage: null,
                  updated_at: null,
                  error: 'FLAG_NOT_FOUND',
                },
              ],
              error: null,
            })
          }
          return Promise.resolve({ data: [mockState.updateFlagResult], error: null })
        case 'admin_list_maintenance_windows':
          return Promise.resolve({ data: mockState.windowsResult, error: null })
        case 'admin_create_maintenance_window':
          return Promise.resolve({ data: [mockState.createWindowResult], error: null })
        case 'admin_delete_maintenance_window':
          if (mockState.simulateNotFound) {
            return Promise.resolve({
              data: [{ success: false, error: 'WINDOW_NOT_FOUND' }],
              error: null,
            })
          }
          return Promise.resolve({ data: [mockState.deleteWindowResult], error: null })
        case 'admin_toggle_maintenance_window':
          if (mockState.simulateNotFound) {
            return Promise.resolve({
              data: [{ success: false, is_active: null, error: 'WINDOW_NOT_FOUND' }],
              error: null,
            })
          }
          return Promise.resolve({ data: [mockState.toggleWindowResult], error: null })
        case 'get_job_health_status':
          return Promise.resolve({ data: mockState.cronHealthResult, error: null })
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

import { adminSystemRoutes } from './admin-system'

describe('Admin System Routes', () => {
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
      c.set('adminRole', 'super_admin')
      c.set('adminPermissions', {
        dashboards: ['system'],
        actions: ['modify_config', 'modify_flags', 'manage_maintenance'],
      })
      await next()
    })

    app.route('/admin/system', adminSystemRoutes)
  })

  // ============================================
  // GET /admin/system/config
  // ============================================

  describe('GET /admin/system/config', () => {
    it('should return platform configuration', async () => {
      const res = await app.request('/admin/system/config')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('config')
      expect(data).toHaveProperty('by_category')
      expect(data).toHaveProperty('categories')
      expect(Array.isArray(data.config)).toBe(true)
      expect(data.config.length).toBe(2)
    })

    it('should group config by category', async () => {
      const res = await app.request('/admin/system/config')
      const data = await res.json()
      expect(data.by_category).toHaveProperty('limits')
      expect(data.by_category).toHaveProperty('pricing')
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/system/config')
      expect(res.status).toBe(500)
    })
  })

  // ============================================
  // PATCH /admin/system/config/:key
  // ============================================

  describe('PATCH /admin/system/config/:key', () => {
    it('should update config value', async () => {
      const res = await app.request('/admin/system/config/rate_limits.default', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: { requests_per_minute: 200 } }),
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.key).toBe('rate_limits.default')
    })

    it('should return 404 for non-existent config', async () => {
      mockState.simulateNotFound = true
      const res = await app.request('/admin/system/config/non_existent_key', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'test' }),
      })
      expect(res.status).toBe(404)
    })

    it('should validate request body', async () => {
      const res = await app.request('/admin/system/config/rate_limits.default', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // GET /admin/system/flags
  // ============================================

  describe('GET /admin/system/flags', () => {
    it('should return feature flags with stats', async () => {
      const res = await app.request('/admin/system/flags')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('flags')
      expect(data).toHaveProperty('stats')
      expect(Array.isArray(data.flags)).toBe(true)
      expect(data.stats).toHaveProperty('total')
      expect(data.stats).toHaveProperty('enabled')
      expect(data.stats).toHaveProperty('disabled')
    })

    it('should calculate flag statistics correctly', async () => {
      const res = await app.request('/admin/system/flags')
      const data = await res.json()
      expect(data.stats.total).toBe(2)
      expect(data.stats.enabled).toBe(1) // governance_v2 is enabled
      expect(data.stats.disabled).toBe(1) // analytics_v2 is disabled
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/system/flags')
      expect(res.status).toBe(500)
    })
  })

  // ============================================
  // PATCH /admin/system/flags/:id
  // ============================================

  describe('PATCH /admin/system/flags/:id', () => {
    it('should update feature flag', async () => {
      const res = await app.request('/admin/system/flags/governance_v2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: false, rollout_percentage: 50 }),
      })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.id).toBe('governance_v2')
    })

    it('should return 404 for non-existent flag', async () => {
      mockState.simulateNotFound = true
      const res = await app.request('/admin/system/flags/non_existent_flag', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: true, rollout_percentage: 100 }),
      })
      expect(res.status).toBe(404)
    })

    it('should validate rollout percentage range', async () => {
      const res = await app.request('/admin/system/flags/governance_v2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: true, rollout_percentage: 150 }),
      })
      expect(res.status).toBe(400)
    })

    it('should require is_enabled field', async () => {
      const res = await app.request('/admin/system/flags/governance_v2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rollout_percentage: 50 }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // GET /admin/system/maintenance
  // ============================================

  describe('GET /admin/system/maintenance', () => {
    it('should return maintenance windows with stats', async () => {
      const res = await app.request('/admin/system/maintenance')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data).toHaveProperty('windows')
      expect(data).toHaveProperty('stats')
      expect(data).toHaveProperty('services')
      expect(Array.isArray(data.windows)).toBe(true)
    })

    it('should include available services list', async () => {
      const res = await app.request('/admin/system/maintenance')
      const data = await res.json()
      expect(Array.isArray(data.services)).toBe(true)
      expect(data.services).toContain('api')
    })

    it('should return 500 on database error', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/system/maintenance')
      expect(res.status).toBe(500)
    })
  })

  // ============================================
  // POST /admin/system/maintenance
  // ============================================

  describe('POST /admin/system/maintenance', () => {
    it('should create maintenance window', async () => {
      const res = await app.request('/admin/system/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'New Maintenance',
          description: 'System upgrade',
          starts_at: '2026-01-30T02:00:00Z',
          ends_at: '2026-01-30T04:00:00Z',
          show_banner: true,
          affects_services: ['api'],
        }),
      })
      expect(res.status).toBe(201)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data).toHaveProperty('id')
    })

    it('should validate title length', async () => {
      const res = await app.request('/admin/system/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'ab', // Too short
          starts_at: '2026-01-30T02:00:00Z',
          ends_at: '2026-01-30T04:00:00Z',
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should validate time range', async () => {
      const res = await app.request('/admin/system/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Invalid Time Window',
          starts_at: '2026-01-30T04:00:00Z',
          ends_at: '2026-01-30T02:00:00Z', // End before start
        }),
      })
      expect(res.status).toBe(400)
    })

    it('should require datetime format', async () => {
      const res = await app.request('/admin/system/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Invalid Date Format',
          starts_at: '2026-01-30',
          ends_at: '2026-01-31',
        }),
      })
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // DELETE /admin/system/maintenance/:id
  // ============================================

  describe('DELETE /admin/system/maintenance/:id', () => {
    it('should delete maintenance window', async () => {
      const res = await app.request(
        '/admin/system/maintenance/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'DELETE',
        }
      )
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
    })

    it('should return 404 for non-existent window', async () => {
      mockState.simulateNotFound = true
      const res = await app.request(
        '/admin/system/maintenance/550e8400-e29b-41d4-a716-446655440099',
        {
          method: 'DELETE',
        }
      )
      expect(res.status).toBe(404)
    })

    it('should validate UUID format', async () => {
      const res = await app.request('/admin/system/maintenance/invalid-uuid', {
        method: 'DELETE',
      })
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // PATCH /admin/system/maintenance/:id
  // ============================================

  describe('PATCH /admin/system/maintenance/:id', () => {
    it('should toggle maintenance window active status', async () => {
      const res = await app.request(
        '/admin/system/maintenance/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        }
      )
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.is_active).toBe(true)
    })

    it('should return 404 for non-existent window', async () => {
      mockState.simulateNotFound = true
      const res = await app.request(
        '/admin/system/maintenance/550e8400-e29b-41d4-a716-446655440099',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        }
      )
      expect(res.status).toBe(404)
    })

    it('should validate UUID format', async () => {
      const res = await app.request('/admin/system/maintenance/invalid-uuid', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true }),
      })
      expect(res.status).toBe(400)
    })

    it('should require is_active field', async () => {
      const res = await app.request(
        '/admin/system/maintenance/550e8400-e29b-41d4-a716-446655440000',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      expect(res.status).toBe(400)
    })
  })

  // ============================================
  // CRON JOB HEALTH
  // ============================================

  describe('GET /admin/system/cron/health', () => {
    it('should return cron job health status', async () => {
      const res = await app.request('/admin/system/cron/health')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.status).toBeDefined()
      expect(data.jobs).toBeInstanceOf(Array)
      expect(data.summary).toBeDefined()
      expect(data.summary.total_jobs).toBe(3)
      expect(data.generated_at).toBeDefined()
    })

    it('should include expected jobs list', async () => {
      const res = await app.request('/admin/system/cron/health')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.expected_jobs).toBeInstanceOf(Array)
      expect(data.expected_jobs).toContain('aggregate_hourly_metrics')
      expect(data.expected_jobs).toContain('check_alert_rules')
    })

    it('should identify missing jobs', async () => {
      const res = await app.request('/admin/system/cron/health')
      expect(res.status).toBe(200)

      const data = await res.json()
      // mockState only has 3 jobs, expected_jobs has more
      expect(data.missing_jobs).toBeDefined()
      expect(data.missing_jobs.length).toBeGreaterThan(0)
    })

    it('should return healthy status when all jobs are running', async () => {
      const res = await app.request('/admin/system/cron/health')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.status).toBe('healthy')
      expect(data.summary.healthy_jobs).toBe(3)
      expect(data.summary.failed_jobs).toBe(0)
    })

    it('should handle database errors gracefully', async () => {
      mockState.simulateError = true
      const res = await app.request('/admin/system/cron/health')
      expect(res.status).toBe(200) // Returns degraded status, not error

      const data = await res.json()
      expect(data.status).toBe('degraded')
      expect(data.jobs).toEqual([])
    })
  })

  describe('GET /admin/system/cron/jobs', () => {
    it('should return list of expected cron jobs', async () => {
      const res = await app.request('/admin/system/cron/jobs')
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.jobs).toBeInstanceOf(Array)
      expect(data.total).toBeGreaterThan(0)
      expect(data.generated_at).toBeDefined()
    })

    it('should include job details', async () => {
      const res = await app.request('/admin/system/cron/jobs')
      expect(res.status).toBe(200)

      const data = await res.json()
      const job = data.jobs[0]
      expect(job.name).toBeDefined()
      expect(job.cron).toBeDefined()
      expect(job.description).toBeDefined()
      expect(job.frequency).toBeDefined()
    })

    it('should include aggregate_hourly_metrics job', async () => {
      const res = await app.request('/admin/system/cron/jobs')
      expect(res.status).toBe(200)

      const data = await res.json()
      const job = data.jobs.find((j: { name: string }) => j.name === 'aggregate_hourly_metrics')
      expect(job).toBeDefined()
      expect(job.cron).toBe('0 * * * *')
    })
  })
})
