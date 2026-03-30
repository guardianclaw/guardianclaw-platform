/**
 * Admin Deployments Routes
 * Administrative endpoints for deployment management
 *
 * Endpoints:
 * - GET  /admin/deployments/stats         - Platform-wide deployment statistics
 * - GET  /admin/deployments               - List deployments with filters
 * - GET  /admin/deployments/:id           - Deployment details
 * - PATCH /admin/deployments/:id/status   - Suspend/unsuspend deployment
 * - PATCH /admin/deployments/:id/ratelimit - Set deployment rate limit
 * - GET  /admin/deployments/:id/logs      - Deployment execution logs
 * - GET  /admin/deployments/:id/keys      - Deployment API keys
 *
 * All routes require admin authentication via adminAuthMiddleware
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import {
  adminAuthMiddleware,
  requireDashboard,
  requireAction,
  type AdminRole,
} from '../middleware/admin-auth'
import { adminAuditMiddleware } from '../middleware/admin-audit'
import {
  getDeploymentsStats,
  listDeployments,
  getDeploymentDetails,
  setDeploymentStatus,
  setDeploymentRateLimit,
  getDeploymentLogs,
  getDeploymentApiKeys,
  getAvailableEnvironments,
  getAvailableDeploymentStatuses,
} from '../services/admin-deployments'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  JWT_ES256_PRIVATE_KEY?: string
  JWT_ES256_PUBLIC_KEY?: string
  RATE_LIMIT_KV?: KVNamespace
}

type Variables = {
  wallet: string
  plan: string
  adminRole: AdminRole
  adminPermissions: {
    dashboards: string[]
    actions: string[]
  }
  walletHash: string
  requestId?: string
}

export const adminDeploymentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================
// VALIDATION SCHEMAS
// ============================================

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const listDeploymentsSchema = paginationSchema.extend({
  environment: z.enum(['development', 'staging', 'production']).optional(),
  status: z.enum(['pending', 'deployed', 'stopped', 'failed']).optional(),
  suspended: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  active_only: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

const setStatusSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().min(5).max(500).optional(),
})

const setRateLimitSchema = z.object({
  rate_limit: z.number().min(0).max(10000).nullable(),
})

const logsSchema = paginationSchema.extend({
  blocked_only: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})

// Apply admin auth to all routes
adminDeploymentsRoutes.use('*', adminAuthMiddleware)
adminDeploymentsRoutes.use('*', adminAuditMiddleware)

// ============================================
// DEPLOYMENT STATISTICS
// ============================================

/**
 * GET /admin/deployments/stats
 *
 * Get platform-wide deployment statistics.
 * Access: deployments dashboard
 */
adminDeploymentsRoutes.get('/stats', requireDashboard('deployments'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const stats = await getDeploymentsStats(supabase)

    return c.json({
      stats,
      environments: getAvailableEnvironments(),
      statuses: getAvailableDeploymentStatuses(),
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get deployments stats:', error)
    return c.json({ error: 'Failed to get deployment statistics' }, 500)
  }
})

// ============================================
// DEPLOYMENT LISTING
// ============================================

/**
 * GET /admin/deployments
 *
 * List deployments with pagination and filters.
 * Access: deployments dashboard
 */
adminDeploymentsRoutes.get('/', requireDashboard('deployments'), async (c) => {
  const query = listDeploymentsSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    environment: c.req.query('environment'),
    status: c.req.query('status'),
    suspended: c.req.query('suspended'),
    active_only: c.req.query('active_only'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { deployments, total } = await listDeployments(
      supabase,
      query.data.limit,
      query.data.offset,
      {
        environment: query.data.environment,
        status: query.data.status,
        suspended: query.data.suspended,
        activeOnly: query.data.active_only,
      }
    )

    return c.json({
      deployments,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: deployments.length,
        total,
      },
      filters: {
        environment: query.data.environment || null,
        status: query.data.status || null,
        suspended: query.data.suspended ?? null,
        active_only: query.data.active_only ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to list deployments:', error)
    return c.json({ error: 'Failed to list deployments' }, 500)
  }
})

// ============================================
// DEPLOYMENT DETAILS
// ============================================

/**
 * GET /admin/deployments/:id
 *
 * Get detailed information for a specific deployment.
 * Access: deployments dashboard
 */
adminDeploymentsRoutes.get('/:id', requireDashboard('deployments'), async (c) => {
  const deploymentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(deploymentId)) {
    return c.json({ error: 'Invalid deployment ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const deployment = await getDeploymentDetails(supabase, deploymentId)

    if (!deployment) {
      return c.json({ error: 'Deployment not found' }, 404)
    }

    return c.json({ deployment })
  } catch (error) {
    console.error('Failed to get deployment details:', error)
    return c.json({ error: 'Failed to get deployment details' }, 500)
  }
})

// ============================================
// DEPLOYMENT STATUS (SUSPEND/UNSUSPEND)
// ============================================

/**
 * PATCH /admin/deployments/:id/status
 *
 * Suspend or unsuspend a deployment.
 * Access: suspend_deployment action
 */
adminDeploymentsRoutes.patch('/:id/status', requireAction('suspend_deployment'), async (c) => {
  const deploymentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(deploymentId)) {
    return c.json({ error: 'Invalid deployment ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = setStatusSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  // Require reason when suspending
  if (parsed.data.suspended && !parsed.data.reason) {
    return c.json({ error: 'Reason is required when suspending a deployment' }, 400)
  }

  const adminHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const result = await setDeploymentStatus(
    supabase,
    deploymentId,
    parsed.data.suspended,
    adminHash,
    parsed.data.reason
  )

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      DEPLOYMENT_NOT_FOUND: 'Deployment not found',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to update deployment status',
        code: result.error,
      },
      result.error === 'DEPLOYMENT_NOT_FOUND' ? 404 : 400
    )
  }

  return c.json({
    success: true,
    deployment_id: deploymentId,
    previous_status: result.previous_status ? 'suspended' : 'active',
    new_status: result.new_status ? 'suspended' : 'active',
  })
})

// ============================================
// DEPLOYMENT RATE LIMIT
// ============================================

/**
 * PATCH /admin/deployments/:id/ratelimit
 *
 * Set a custom rate limit override for a deployment.
 * Access: manage_ratelimit action
 */
adminDeploymentsRoutes.patch('/:id/ratelimit', requireAction('manage_ratelimit'), async (c) => {
  const deploymentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(deploymentId)) {
    return c.json({ error: 'Invalid deployment ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = setRateLimitSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const adminHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const result = await setDeploymentRateLimit(
    supabase,
    deploymentId,
    parsed.data.rate_limit,
    adminHash
  )

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      DEPLOYMENT_NOT_FOUND: 'Deployment not found',
      INVALID_RATE_LIMIT: 'Invalid rate limit value',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to update rate limit',
        code: result.error,
      },
      result.error === 'DEPLOYMENT_NOT_FOUND' ? 404 : 400
    )
  }

  return c.json({
    success: true,
    deployment_id: deploymentId,
    previous_limit: result.previous_limit,
    new_limit: result.new_limit,
    description:
      result.new_limit === null
        ? 'Rate limit reset to default'
        : result.new_limit === 0
          ? 'Rate limiting disabled'
          : `Rate limit set to ${result.new_limit} requests/minute`,
  })
})

// ============================================
// DEPLOYMENT LOGS
// ============================================

/**
 * GET /admin/deployments/:id/logs
 *
 * Get execution logs for a deployment.
 * Access: deployments dashboard
 */
adminDeploymentsRoutes.get('/:id/logs', requireDashboard('deployments'), async (c) => {
  const deploymentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(deploymentId)) {
    return c.json({ error: 'Invalid deployment ID format' }, 400)
  }

  const query = logsSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    blocked_only: c.req.query('blocked_only'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { logs, total } = await getDeploymentLogs(
      supabase,
      deploymentId,
      query.data.limit,
      query.data.offset,
      query.data.blocked_only
    )

    return c.json({
      logs,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: logs.length,
        total,
      },
      filters: {
        blocked_only: query.data.blocked_only ?? null,
      },
    })
  } catch (error) {
    console.error('Failed to get deployment logs:', error)
    return c.json({ error: 'Failed to get deployment logs' }, 500)
  }
})

// ============================================
// DEPLOYMENT API KEYS
// ============================================

/**
 * GET /admin/deployments/:id/keys
 *
 * Get API keys and their usage stats for a deployment.
 * Access: deployments dashboard
 */
adminDeploymentsRoutes.get('/:id/keys', requireDashboard('deployments'), async (c) => {
  const deploymentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(deploymentId)) {
    return c.json({ error: 'Invalid deployment ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const keys = await getDeploymentApiKeys(supabase, deploymentId)

    return c.json({
      keys,
      count: keys.length,
    })
  } catch (error) {
    console.error('Failed to get deployment API keys:', error)
    return c.json({ error: 'Failed to get deployment API keys' }, 500)
  }
})
