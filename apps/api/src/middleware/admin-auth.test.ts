/**
 * Admin Authentication Middleware Tests
 *
 * Tests for admin role-based authentication and authorization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import {
  adminAuthMiddleware,
  requireRole,
  requireDashboard,
  requireAction,
  ROLE_HIERARCHY,
  DASHBOARD_ACCESS,
  ACTION_PERMISSIONS,
} from './admin-auth'

// Mock dependencies
vi.mock('../lib/jwt-manager', () => ({
  getJWTManager: vi.fn(() =>
    Promise.resolve({
      verifyToken: vi.fn(),
    })
  ),
}))

vi.mock('../lib/token-revocation', () => ({
  createTokenRevocationList: vi.fn(() => ({
    isRevoked: vi.fn(() => Promise.resolve(false)),
    isWalletRevoked: vi.fn(() => Promise.resolve(false)),
  })),
}))

vi.mock('../lib/secure-logger', () => ({
  hashWallet: vi.fn((wallet: string) => Promise.resolve(`hashed_${wallet}`)),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  })),
}))

import { getJWTManager } from '../lib/jwt-manager'
import { createTokenRevocationList } from '../lib/token-revocation'
import { createClient } from '@supabase/supabase-js'

describe('Admin Auth Middleware', () => {
  let app: Hono

  const mockEnv = {
    JWT_SECRET: 'test-secret',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_KEY: 'test-service-key',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
  })

  describe('adminAuthMiddleware', () => {
    it('rejects requests without authorization header', async () => {
      app.use('*', adminAuthMiddleware)
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Missing or invalid authorization header')
    })

    it('rejects requests with invalid token format', async () => {
      app.use('*', adminAuthMiddleware)
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request(
        '/test',
        {
          headers: { Authorization: 'InvalidToken' },
        },
        mockEnv
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Missing or invalid authorization header')
    })

    it('rejects requests with invalid JWT', async () => {
      const mockJwtManager = {
        verifyToken: vi.fn().mockResolvedValue({
          valid: false,
          error: 'Token expired',
        }),
      }
      vi.mocked(getJWTManager).mockResolvedValue(mockJwtManager as unknown)

      app.use('*', adminAuthMiddleware)
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request(
        '/test',
        {
          headers: { Authorization: 'Bearer invalid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Token expired')
    })

    it('rejects requests with revoked token', async () => {
      const mockJwtManager = {
        verifyToken: vi.fn().mockResolvedValue({
          valid: true,
          payload: { sub: 'wallet123', plan: 'pro', jti: 'token-id' },
        }),
      }
      vi.mocked(getJWTManager).mockResolvedValue(mockJwtManager as unknown)

      vi.mocked(createTokenRevocationList).mockReturnValue({
        isRevoked: vi.fn().mockResolvedValue(true),
        isWalletRevoked: vi.fn().mockResolvedValue(false),
      } as unknown)

      app.use('*', adminAuthMiddleware)
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request(
        '/test',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(401)
      const body = await res.json()
      expect(body.error).toBe('Token has been revoked')
    })

    it('rejects requests without admin role', async () => {
      const mockJwtManager = {
        verifyToken: vi.fn().mockResolvedValue({
          valid: true,
          payload: { sub: 'wallet123', plan: 'pro' },
        }),
      }
      vi.mocked(getJWTManager).mockResolvedValue(mockJwtManager as unknown)

      vi.mocked(createTokenRevocationList).mockReturnValue({
        isRevoked: vi.fn().mockResolvedValue(false),
        isWalletRevoked: vi.fn().mockResolvedValue(false),
      } as unknown)

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            }),
          }),
        }),
      }
      vi.mocked(createClient).mockReturnValue(mockSupabase as unknown)

      app.use('*', adminAuthMiddleware)
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request(
        '/test',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Access denied. Admin role required.')
    })

    it('rejects requests with deactivated admin role', async () => {
      const mockJwtManager = {
        verifyToken: vi.fn().mockResolvedValue({
          valid: true,
          payload: { sub: 'wallet123', plan: 'pro' },
        }),
      }
      vi.mocked(getJWTManager).mockResolvedValue(mockJwtManager as unknown)

      vi.mocked(createTokenRevocationList).mockReturnValue({
        isRevoked: vi.fn().mockResolvedValue(false),
        isWalletRevoked: vi.fn().mockResolvedValue(false),
      } as unknown)

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  role: 'admin',
                  permissions: {},
                  is_active: false,
                },
                error: null,
              }),
            }),
          }),
        }),
      }
      vi.mocked(createClient).mockReturnValue(mockSupabase as unknown)

      app.use('*', adminAuthMiddleware)
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request(
        '/test',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toBe('Admin access has been deactivated.')
    })

    it('allows requests with valid admin role', async () => {
      const mockJwtManager = {
        verifyToken: vi.fn().mockResolvedValue({
          valid: true,
          payload: { sub: 'wallet123', plan: 'pro' },
        }),
      }
      vi.mocked(getJWTManager).mockResolvedValue(mockJwtManager as unknown)

      vi.mocked(createTokenRevocationList).mockReturnValue({
        isRevoked: vi.fn().mockResolvedValue(false),
        isWalletRevoked: vi.fn().mockResolvedValue(false),
      } as unknown)

      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  role: 'admin',
                  permissions: {},
                  is_active: true,
                },
                error: null,
              }),
            }),
          }),
        }),
      }
      vi.mocked(createClient).mockReturnValue(mockSupabase as unknown)

      app.use('*', adminAuthMiddleware)
      app.get('/test', (c) => {
        return c.json({
          role: c.get('adminRole'),
          permissions: c.get('adminPermissions'),
        })
      })

      const res = await app.request(
        '/test',
        {
          headers: { Authorization: 'Bearer valid-token' },
        },
        mockEnv
      )

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.role).toBe('admin')
      expect(body.permissions.dashboards).toContain('overview')
    })
  })

  describe('requireRole', () => {
    it('allows access when user has sufficient role level', async () => {
      // Setup app with middleware that sets admin context
      app.use('*', async (c, next) => {
        c.set('adminRole', 'admin')
        c.set('adminPermissions', { dashboards: [], actions: [] })
        await next()
      })
      app.use('*', requireRole('support'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(200)
    })

    it('denies access when user has insufficient role level', async () => {
      app.use('*', async (c, next) => {
        c.set('adminRole', 'support')
        c.set('adminPermissions', { dashboards: [], actions: [] })
        await next()
      })
      app.use('*', requireRole('super_admin'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('Insufficient permissions')
    })

    it('denies access when no admin role is set', async () => {
      app.use('*', requireRole('viewer'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(401)
    })
  })

  describe('requireDashboard', () => {
    it('allows access when user has dashboard permission', async () => {
      app.use('*', async (c, next) => {
        c.set('adminRole', 'support')
        c.set('adminPermissions', {
          dashboards: ['overview', 'support'],
          actions: [],
        })
        await next()
      })
      app.use('*', requireDashboard('support'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(200)
    })

    it('denies access when user lacks dashboard permission', async () => {
      app.use('*', async (c, next) => {
        c.set('adminRole', 'viewer')
        c.set('adminPermissions', {
          dashboards: ['overview'],
          actions: [],
        })
        await next()
      })
      app.use('*', requireDashboard('roles'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('Access denied')
    })
  })

  describe('requireAction', () => {
    it('allows access when user has action permission', async () => {
      app.use('*', async (c, next) => {
        c.set('adminRole', 'admin')
        c.set('adminPermissions', {
          dashboards: [],
          actions: ['manage_alerts', 'view_user'],
        })
        await next()
      })
      app.use('*', requireAction('manage_alerts'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(200)
    })

    it('denies access when user lacks action permission', async () => {
      app.use('*', async (c, next) => {
        c.set('adminRole', 'support')
        c.set('adminPermissions', {
          dashboards: [],
          actions: ['view_user'],
        })
        await next()
      })
      app.use('*', requireAction('suspend_user'))
      app.get('/test', (c) => c.json({ success: true }))

      const res = await app.request('/test', {}, mockEnv)

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error).toContain('Permission denied')
    })
  })

  describe('Role Hierarchy', () => {
    it('has correct hierarchy ordering', () => {
      expect(ROLE_HIERARCHY.viewer).toBeLessThan(ROLE_HIERARCHY.support)
      expect(ROLE_HIERARCHY.support).toBeLessThan(ROLE_HIERARCHY.admin)
      expect(ROLE_HIERARCHY.admin).toBeLessThan(ROLE_HIERARCHY.super_admin)
    })
  })

  describe('Dashboard Access', () => {
    it('viewer has access to core dashboards', () => {
      expect(DASHBOARD_ACCESS.viewer).toContain('overview')
      expect(DASHBOARD_ACCESS.viewer).toContain('operations')
      expect(DASHBOARD_ACCESS.viewer).not.toContain('support')
    })

    it('support has access to support dashboard', () => {
      expect(DASHBOARD_ACCESS.support).toContain('support')
      expect(DASHBOARD_ACCESS.support).not.toContain('alerts')
    })

    it('admin has access to alerts dashboard', () => {
      expect(DASHBOARD_ACCESS.admin).toContain('alerts')
      expect(DASHBOARD_ACCESS.admin).not.toContain('roles')
    })

    it('super_admin has access to roles dashboard', () => {
      expect(DASHBOARD_ACCESS.super_admin).toContain('roles')
    })
  })

  describe('Action Permissions', () => {
    it('viewer has no action permissions', () => {
      expect(ACTION_PERMISSIONS.viewer).toHaveLength(0)
    })

    it('support has view permissions only', () => {
      expect(ACTION_PERMISSIONS.support).toContain('view_user')
      expect(ACTION_PERMISSIONS.support).toContain('view_logs')
      expect(ACTION_PERMISSIONS.support).not.toContain('manage_alerts')
    })

    it('admin has alert management permissions', () => {
      expect(ACTION_PERMISSIONS.admin).toContain('manage_alerts')
      expect(ACTION_PERMISSIONS.admin).not.toContain('manage_roles')
    })

    it('super_admin has all permissions', () => {
      expect(ACTION_PERMISSIONS.super_admin).toContain('manage_roles')
      expect(ACTION_PERMISSIONS.super_admin).toContain('suspend_user')
    })
  })
})
