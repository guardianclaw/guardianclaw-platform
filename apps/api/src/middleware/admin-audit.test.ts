/**
 * Admin Audit Middleware Tests
 *
 * Tests for GDPR-compliant admin action logging.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { adminAuditMiddleware, logAdminAction } from './admin-audit'

// Mock Supabase
const mockInsert = vi.fn().mockResolvedValue({ error: null })
const mockSupabase = {
  from: vi.fn().mockReturnValue({
    insert: mockInsert,
  }),
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase),
}))

describe('Admin Audit Middleware', () => {
  let app: Hono

  const mockEnv = {
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
    IP_HASH_SECRET: 'test-ip-secret',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
  })

  describe('adminAuditMiddleware', () => {
    it('logs GET requests with correct action format', async () => {
      // Setup middleware that sets admin context
      app.use('*', async (c, next) => {
        c.set('wallet', 'testWallet123')
        c.set('walletHash', 'hashedWallet123')
        c.set('adminRole', 'admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.get('/admin/users/search', (c) => c.json({ users: [] }))

      const res = await app.request(
        '/admin/users/search?query=test',
        {
          headers: { 'cf-connecting-ip': '1.2.3.4' },
        },
        mockEnv
      )

      expect(res.status).toBe(200)

      // Check that audit log was called
      expect(mockSupabase.from).toHaveBeenCalledWith('admin_audit_log')
      expect(mockInsert).toHaveBeenCalled()

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.action).toBe('GET /admin/users/search')
      expect(insertCall.admin_wallet_hash).toBe('hashedWallet123')
      expect(insertCall.status_code).toBe(200)
    })

    it('logs POST requests with body details', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet123')
        c.set('adminRole', 'super_admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.post('/admin/roles', async (c) => {
        await c.req.json()
        return c.json({ success: true }, 201)
      })

      const res = await app.request(
        '/admin/roles',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'cf-connecting-ip': '1.2.3.4',
          },
          body: JSON.stringify({
            wallet_address: 'testWallet',
            role: 'admin',
          }),
        },
        mockEnv
      )

      expect(res.status).toBe(201)
      expect(mockInsert).toHaveBeenCalled()

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.action).toBe('POST /admin/roles')
      expect(insertCall.details.body).toBeDefined()
    })

    it('extracts target info from user paths', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'support')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.get('/admin/users/:wallet', (c) => c.json({ user: {} }))

      await app.request('/admin/users/ABC123XYZ', {}, mockEnv)

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.target_type).toBe('user')
      expect(insertCall.target_id).toBe('ABC123XYZ')
    })

    it('extracts target info from alert paths', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.patch('/admin/alerts/:id', (c) => c.json({ success: true }))

      await app.request(
        '/admin/alerts/uuid-123-456',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'acknowledged' }),
        },
        mockEnv
      )

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.target_type).toBe('alert')
      expect(insertCall.target_id).toBe('uuid-123-456')
    })

    it('extracts target info from rule paths', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'super_admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.delete('/admin/rules/:id', (c) => c.json({ success: true }))

      await app.request(
        '/admin/rules/rule-uuid-789',
        {
          method: 'DELETE',
        },
        mockEnv
      )

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.target_type).toBe('rule')
      expect(insertCall.target_id).toBe('rule-uuid-789')
    })

    it('hashes IP address for GDPR compliance', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.get('/admin/test', (c) => c.json({ ok: true }))

      await app.request(
        '/admin/test',
        {
          headers: { 'cf-connecting-ip': '192.168.1.1' },
        },
        mockEnv
      )

      const insertCall = mockInsert.mock.calls[0][0]
      // IP hash should be a 16-char hex string, not the raw IP
      expect(insertCall.ip_hash).not.toBe('192.168.1.1')
      expect(insertCall.ip_hash).toHaveLength(16)
    })

    it('scrubs sensitive data from request body', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'super_admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.post('/admin/test', async (c) => {
        await c.req.json()
        return c.json({ ok: true })
      })

      await app.request(
        '/admin/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: 'secret-key-123',
            password: 'supersecret',
            data: 'safe-data',
          }),
        },
        mockEnv
      )

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.details.body.api_key).toBe('[REDACTED]')
      expect(insertCall.details.body.password).toBe('[REDACTED]')
      expect(insertCall.details.body.data).toBe('safe-data')
    })

    it('truncates long string values', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.post('/admin/test', async (c) => {
        await c.req.json()
        return c.json({ ok: true })
      })

      const longString = 'x'.repeat(1000)

      await app.request(
        '/admin/test',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ longField: longString }),
        },
        mockEnv
      )

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.details.body.longField).toContain('...[truncated]')
      expect(insertCall.details.body.longField.length).toBeLessThan(600)
    })

    it('records duration in details', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.get('/admin/test', async (c) => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10))
        return c.json({ ok: true })
      })

      await app.request('/admin/test', {}, mockEnv)

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.details.duration_ms).toBeGreaterThanOrEqual(10)
    })

    it('continues even if audit logging fails', async () => {
      mockInsert.mockRejectedValueOnce(new Error('DB Error'))

      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.get('/admin/test', (c) => c.json({ ok: true }))

      const res = await app.request('/admin/test', {}, mockEnv)

      // Request should still succeed
      expect(res.status).toBe(200)
    })

    it('handles requests without IP header', async () => {
      app.use('*', async (c, next) => {
        c.set('walletHash', 'hashedWallet')
        c.set('adminRole', 'admin')
        await next()
      })
      app.use('*', adminAuditMiddleware)
      app.get('/admin/test', (c) => c.json({ ok: true }))

      await app.request('/admin/test', {}, mockEnv)

      // Should still log, with hashed 'unknown' IP
      expect(mockInsert).toHaveBeenCalled()
    })
  })

  describe('logAdminAction helper', () => {
    it('logs custom actions correctly', async () => {
      await logAdminAction(mockSupabase as unknown, {
        adminWalletHash: 'customWalletHash',
        action: 'custom_bulk_operation',
        targetType: 'users',
        targetId: 'batch-123',
        details: { affected_count: 50 },
        statusCode: 200,
      })

      expect(mockInsert).toHaveBeenCalled()
      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.action).toBe('custom_bulk_operation')
      expect(insertCall.target_type).toBe('users')
      expect(insertCall.details.affected_count).toBe(50)
    })

    it('handles missing optional fields', async () => {
      await logAdminAction(mockSupabase as unknown, {
        adminWalletHash: 'walletHash',
        action: 'simple_action',
      })

      const insertCall = mockInsert.mock.calls[0][0]
      expect(insertCall.target_type).toBeNull()
      expect(insertCall.target_id).toBeNull()
      expect(insertCall.status_code).toBe(200)
    })
  })
})
