/**
 * Admin Authentication Middleware
 *
 * Validates JWT tokens AND admin role for protected admin routes.
 * Requires user to have an active admin role in admin_roles table.
 *
 * Role hierarchy: super_admin > admin > support > viewer
 *
 * Reference: ADMIN_SPEC Phase 8
 */

import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { createClient } from '@supabase/supabase-js'
import { getJWTManager } from '../lib/jwt-manager'
import { createTokenRevocationList } from '../lib/token-revocation'
import { hashWallet } from '../lib/secure-logger'

const SESSION_COOKIE_NAME = 'claw_session'

// Admin role types
export type AdminRole = 'super_admin' | 'admin' | 'support' | 'viewer'

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<AdminRole, number> = {
  viewer: 1,
  support: 2,
  admin: 3,
  super_admin: 4,
}

// Dashboard access by role
const DASHBOARD_ACCESS: Record<AdminRole, string[]> = {
  viewer: ['overview', 'operations', 'business', 'financial', 'security', 'analytics'],
  support: [
    'overview',
    'operations',
    'business',
    'financial',
    'security',
    'analytics',
    'support',
    'credits',
    'agents',
    'deployments',
  ],
  admin: [
    'overview',
    'operations',
    'business',
    'financial',
    'security',
    'analytics',
    'support',
    'alerts',
    'credits',
    'agents',
    'deployments',
    'governance',
    'compliance',
    'system',
    'audit',
  ],
  super_admin: [
    'overview',
    'operations',
    'business',
    'financial',
    'security',
    'analytics',
    'support',
    'alerts',
    'roles',
    'credits',
    'agents',
    'deployments',
    'governance',
    'compliance',
    'system',
    'audit',
  ],
}

// Action permissions by role
const ACTION_PERMISSIONS: Record<AdminRole, string[]> = {
  viewer: [],
  support: ['view_user', 'view_logs', 'view_credits'],
  admin: [
    'view_user',
    'view_logs',
    'manage_alerts',
    'extend_plan',
    'reset_usage',
    'view_credits',
    'adjust_credits',
    'suspend_agent',
    'suspend_deployment',
    'manage_ratelimit',
    'toggle_proposal_visibility',
    'update_gdpr_request',
    'manage_maintenance',
  ],
  super_admin: [
    'view_user',
    'view_logs',
    'manage_alerts',
    'extend_plan',
    'reset_usage',
    'manage_roles',
    'manage_rules',
    'suspend_user',
    'view_credits',
    'adjust_credits',
    'suspend_agent',
    'suspend_deployment',
    'manage_ratelimit',
    'toggle_proposal_visibility',
    'update_gdpr_request',
    'manage_maintenance',
    'modify_config',
    'modify_flags',
    'export_audit',
  ],
}

type Env = {
  Bindings: {
    JWT_SECRET: string
    JWT_ES256_PRIVATE_KEY?: string
    JWT_ES256_PUBLIC_KEY?: string
    SUPABASE_URL: string
    SUPABASE_SERVICE_KEY: string
    RATE_LIMIT_KV?: KVNamespace
  }
  Variables: {
    wallet: string
    plan: string
    adminRole: AdminRole
    adminPermissions: {
      dashboards: string[]
      actions: string[]
    }
    walletHash: string
  }
}

/**
 * Admin authentication middleware.
 *
 * Validates JWT token AND checks admin role in database.
 * Sets admin role and permissions in context.
 */
export const adminAuthMiddleware = createMiddleware<Env>(async (c, next) => {
  // Browser sessions land here with the JWT in the httpOnly claw_session cookie.
  // SDK / CLI clients send `Authorization: Bearer <jwt>`. Either is acceptable.
  // The browser flow used to send a sentinel string in the Bearer header, which
  // is meaningless after JWT verification — we ignore it and fall back to the
  // cookie below. Real Bearer tokens take priority over the cookie so SDKs can
  // override session state when both are present.
  const authHeader = c.req.header('Authorization')
  const rawBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const bearerToken =
    rawBearer && rawBearer !== 'authenticated' && rawBearer !== 'null' && rawBearer !== ''
      ? rawBearer
      : null
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME)
  const token = bearerToken || cookieToken

  if (!token) {
    return c.json({ error: 'Missing or invalid authorization header' }, 401)
  }

  try {
    // Initialize JWT manager
    const jwtManager = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: c.env.JWT_ES256_PRIVATE_KEY,
      JWT_ES256_PUBLIC_KEY: c.env.JWT_ES256_PUBLIC_KEY,
      JWT_SECRET: c.env.JWT_SECRET,
    })

    // Verify token
    const result = await jwtManager.verifyToken(token)

    if (!result.valid || !result.payload) {
      return c.json({ error: result.error || 'Invalid or expired token' }, 401)
    }

    const payload = result.payload

    // Check token revocation
    const revocationList = createTokenRevocationList(c.env.RATE_LIMIT_KV || null)

    if (payload.jti) {
      const isRevoked = await revocationList.isRevoked(payload.jti)
      if (isRevoked) {
        return c.json({ error: 'Token has been revoked' }, 401)
      }
    }

    // Check wallet-level revocation
    if (payload.sub && payload.iat) {
      const walletHash = await hashWallet(payload.sub)
      const isWalletRevoked = await revocationList.isWalletRevoked(walletHash, payload.iat * 1000)
      if (isWalletRevoked) {
        return c.json({ error: 'Session has been revoked' }, 401)
      }
    }

    // Verify admin role in database
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    const { data: adminRole, error: roleError } = await supabase
      .from('admin_roles')
      .select('role, permissions, is_active')
      .eq('wallet_address', payload.sub)
      .single()

    if (roleError || !adminRole) {
      return c.json({ error: 'Access denied. Admin role required.' }, 403)
    }

    if (!adminRole.is_active) {
      return c.json({ error: 'Admin access has been deactivated.' }, 403)
    }

    const role = adminRole.role as AdminRole

    // Build permissions (base permissions + custom overrides)
    const basePermissions = {
      dashboards: DASHBOARD_ACCESS[role] || [],
      actions: ACTION_PERMISSIONS[role] || [],
    }

    // Apply custom permission overrides if any, validating against known actions
    const customPermissions = adminRole.permissions || {}
    const allValidActions = new Set(Object.values(ACTION_PERMISSIONS).flat())
    const allValidDashboards = new Set(Object.values(DASHBOARD_ACCESS).flat())

    const finalPermissions = {
      dashboards: (customPermissions.dashboards || basePermissions.dashboards).filter((d: string) =>
        allValidDashboards.has(d)
      ),
      actions: (customPermissions.actions || basePermissions.actions).filter((a: string) =>
        allValidActions.has(a)
      ),
    }

    // Set context variables
    c.set('wallet', payload.sub)
    c.set('plan', payload.plan || 'free')
    c.set('adminRole', role)
    c.set('adminPermissions', finalPermissions)
    c.set('walletHash', await hashWallet(payload.sub))

    await next()
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401)
  }
})

/**
 * Require minimum admin role middleware factory.
 *
 * Use after adminAuthMiddleware to enforce minimum role level.
 *
 * @example
 * router.use('*', adminAuthMiddleware)
 * router.post('/dangerous-action', requireRole('super_admin'), handler)
 */
export function requireRole(minRole: AdminRole) {
  return createMiddleware<Env>(async (c, next) => {
    const userRole = c.get('adminRole')

    if (!userRole) {
      return c.json({ error: 'Admin authentication required' }, 401)
    }

    const userLevel = ROLE_HIERARCHY[userRole] || 0
    const requiredLevel = ROLE_HIERARCHY[minRole] || 0

    if (userLevel < requiredLevel) {
      return c.json(
        {
          error: `Insufficient permissions. Required: ${minRole}, Current: ${userRole}`,
        },
        403
      )
    }

    await next()
  })
}

/**
 * Require specific action permission middleware factory.
 *
 * @example
 * router.post('/users/:wallet/suspend', requireAction('suspend_user'), handler)
 */
export function requireAction(action: string) {
  return createMiddleware<Env>(async (c, next) => {
    const permissions = c.get('adminPermissions')

    if (!permissions?.actions?.includes(action)) {
      return c.json(
        {
          error: `Permission denied. Action '${action}' not allowed.`,
        },
        403
      )
    }

    await next()
  })
}

/**
 * Require dashboard access middleware factory.
 *
 * @example
 * router.get('/metrics/financial', requireDashboard('financial'), handler)
 */
export function requireDashboard(dashboard: string) {
  return createMiddleware<Env>(async (c, next) => {
    const permissions = c.get('adminPermissions')

    if (!permissions?.dashboards?.includes(dashboard)) {
      return c.json(
        {
          error: `Access denied to '${dashboard}' dashboard.`,
        },
        403
      )
    }

    await next()
  })
}

// Export types and constants for use in routes
export { ROLE_HIERARCHY, DASHBOARD_ACCESS, ACTION_PERMISSIONS }
