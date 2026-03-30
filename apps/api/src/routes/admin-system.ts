/**
 * Admin System Routes
 * Administrative endpoints for platform configuration, feature flags, and maintenance windows
 *
 * Endpoints:
 * - GET  /admin/system/config                - List all config
 * - PATCH /admin/system/config/:key          - Update config value
 * - GET  /admin/system/flags                 - List feature flags
 * - PATCH /admin/system/flags/:id            - Update feature flag
 * - GET  /admin/system/maintenance           - List maintenance windows
 * - POST /admin/system/maintenance           - Create maintenance window
 * - DELETE /admin/system/maintenance/:id     - Delete maintenance window
 * - PATCH /admin/system/maintenance/:id      - Toggle maintenance window
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
  getSystemConfig,
  updateConfig,
  listFeatureFlags,
  updateFeatureFlag,
  listMaintenanceWindows,
  createMaintenanceWindow,
  deleteMaintenanceWindow,
  toggleMaintenanceWindow,
  getConfigCategories,
  getAvailableServices,
  getCronHealthStatus,
  getExpectedCronJobs,
} from '../services/admin-system'

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

export const adminSystemRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================
// VALIDATION SCHEMAS
// ============================================

const updateConfigSchema = z.object({
  value: z.unknown().refine((val) => val !== undefined, {
    message: 'Value is required',
  }),
})

const updateFlagSchema = z.object({
  is_enabled: z.boolean(),
  rollout_percentage: z.number().min(0).max(100),
  conditions: z.record(z.unknown()).optional(),
})

const createMaintenanceSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  show_banner: z.boolean().default(true),
  affects_services: z.array(z.string()).default([]),
})

const toggleMaintenanceSchema = z.object({
  is_active: z.boolean(),
})

// Apply admin auth to all routes
adminSystemRoutes.use('*', adminAuthMiddleware)
adminSystemRoutes.use('*', adminAuditMiddleware)

// ============================================
// PLATFORM CONFIG
// ============================================

/**
 * GET /admin/system/config
 *
 * Get all platform configuration.
 * Access: system dashboard
 */
adminSystemRoutes.get('/config', requireDashboard('system'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const config = await getSystemConfig(supabase)

    // Group by category
    const byCategory: Record<string, typeof config> = {}
    for (const item of config) {
      if (!byCategory[item.category]) {
        byCategory[item.category] = []
      }
      byCategory[item.category].push(item)
    }

    return c.json({
      config,
      by_category: byCategory,
      categories: getConfigCategories(),
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get system config:', error)
    return c.json({ error: 'Failed to get system configuration' }, 500)
  }
})

/**
 * PATCH /admin/system/config/:key
 *
 * Update a configuration value.
 * Access: modify_config action
 */
adminSystemRoutes.patch('/config/:key', requireAction('modify_config'), async (c) => {
  const key = c.req.param('key')

  const body = await c.req.json()
  const parsed = updateConfigSchema.safeParse(body)

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

  const result = await updateConfig(supabase, key, parsed.data.value, adminHash)

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      CONFIG_NOT_FOUND: 'Configuration key not found',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to update configuration',
        code: result.error,
      },
      result.error === 'CONFIG_NOT_FOUND' ? 404 : 400
    )
  }

  return c.json({
    success: true,
    key: result.key,
    value: result.value,
    updated_at: result.updated_at,
  })
})

// ============================================
// FEATURE FLAGS
// ============================================

/**
 * GET /admin/system/flags
 *
 * Get all feature flags.
 * Access: system dashboard
 */
adminSystemRoutes.get('/flags', requireDashboard('system'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const flags = await listFeatureFlags(supabase)

    // Calculate stats
    const enabledCount = flags.filter((f) => f.is_enabled).length
    const disabledCount = flags.length - enabledCount
    const partialRollout = flags.filter((f) => f.is_enabled && f.rollout_percentage < 100).length

    return c.json({
      flags,
      stats: {
        total: flags.length,
        enabled: enabledCount,
        disabled: disabledCount,
        partial_rollout: partialRollout,
      },
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to list feature flags:', error)
    return c.json({ error: 'Failed to list feature flags' }, 500)
  }
})

/**
 * PATCH /admin/system/flags/:id
 *
 * Update a feature flag.
 * Access: modify_flags action
 */
adminSystemRoutes.patch('/flags/:id', requireAction('modify_flags'), async (c) => {
  const id = c.req.param('id')

  const body = await c.req.json()
  const parsed = updateFlagSchema.safeParse(body)

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

  const result = await updateFeatureFlag(
    supabase,
    id,
    parsed.data.is_enabled,
    parsed.data.rollout_percentage,
    parsed.data.conditions || null,
    adminHash
  )

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      FLAG_NOT_FOUND: 'Feature flag not found',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to update feature flag',
        code: result.error,
      },
      result.error === 'FLAG_NOT_FOUND' ? 404 : 400
    )
  }

  return c.json({
    success: true,
    id: result.id,
    is_enabled: result.is_enabled,
    rollout_percentage: result.rollout_percentage,
    updated_at: result.updated_at,
  })
})

// ============================================
// MAINTENANCE WINDOWS
// ============================================

/**
 * GET /admin/system/maintenance
 *
 * Get all maintenance windows.
 * Access: system dashboard
 */
adminSystemRoutes.get('/maintenance', requireDashboard('system'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const windows = await listMaintenanceWindows(supabase)

    // Categorize windows
    const now = new Date()
    const active = windows.filter((w) => w.is_active)
    const upcoming = windows.filter((w) => !w.is_active && new Date(w.starts_at) > now)
    const past = windows.filter((w) => !w.is_active && new Date(w.ends_at) < now)

    return c.json({
      windows,
      stats: {
        total: windows.length,
        active: active.length,
        upcoming: upcoming.length,
        past: past.length,
      },
      services: getAvailableServices(),
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to list maintenance windows:', error)
    return c.json({ error: 'Failed to list maintenance windows' }, 500)
  }
})

/**
 * POST /admin/system/maintenance
 *
 * Create a new maintenance window.
 * Access: manage_maintenance action
 */
adminSystemRoutes.post('/maintenance', requireAction('manage_maintenance'), async (c) => {
  const body = await c.req.json()
  const parsed = createMaintenanceSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  // Validate time range
  const startsAt = new Date(parsed.data.starts_at)
  const endsAt = new Date(parsed.data.ends_at)
  if (endsAt <= startsAt) {
    return c.json({ error: 'End time must be after start time' }, 400)
  }

  const adminHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const result = await createMaintenanceWindow(
    supabase,
    parsed.data.title,
    parsed.data.description || null,
    parsed.data.starts_at,
    parsed.data.ends_at,
    parsed.data.show_banner,
    parsed.data.affects_services,
    adminHash
  )

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      INVALID_TIME_RANGE: 'Invalid time range',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to create maintenance window',
        code: result.error,
      },
      400
    )
  }

  return c.json(
    {
      success: true,
      id: result.id,
      created_at: result.created_at,
    },
    201
  )
})

/**
 * DELETE /admin/system/maintenance/:id
 *
 * Delete a maintenance window.
 * Access: manage_maintenance action
 */
adminSystemRoutes.delete('/maintenance/:id', requireAction('manage_maintenance'), async (c) => {
  const id = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return c.json({ error: 'Invalid maintenance window ID format' }, 400)
  }

  const adminHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const result = await deleteMaintenanceWindow(supabase, id, adminHash)

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      WINDOW_NOT_FOUND: 'Maintenance window not found',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to delete maintenance window',
        code: result.error,
      },
      result.error === 'WINDOW_NOT_FOUND' ? 404 : 400
    )
  }

  return c.json({ success: true })
})

/**
 * PATCH /admin/system/maintenance/:id
 *
 * Toggle maintenance window active status.
 * Access: manage_maintenance action
 */
adminSystemRoutes.patch('/maintenance/:id', requireAction('manage_maintenance'), async (c) => {
  const id = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(id)) {
    return c.json({ error: 'Invalid maintenance window ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = toggleMaintenanceSchema.safeParse(body)

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

  const result = await toggleMaintenanceWindow(supabase, id, parsed.data.is_active, adminHash)

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      WINDOW_NOT_FOUND: 'Maintenance window not found',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to toggle maintenance window',
        code: result.error,
      },
      result.error === 'WINDOW_NOT_FOUND' ? 404 : 400
    )
  }

  return c.json({
    success: true,
    id,
    is_active: result.is_active,
  })
})

// ============================================
// CRON JOB HEALTH
// ============================================

/**
 * GET /admin/system/cron/health
 *
 * Get health status of all cron jobs.
 * Returns last execution time, status, and 24h statistics.
 * Access: operations or security dashboard
 */
adminSystemRoutes.get('/cron/health', requireDashboard('operations'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const healthStatus = await getCronHealthStatus(supabase)

    // Add expected jobs list for reference
    const expectedJobs = getExpectedCronJobs()
    const missingJobs = expectedJobs.filter(
      (expected) => !healthStatus.jobs.find((j) => j.job_name === expected)
    )

    return c.json({
      ...healthStatus,
      expected_jobs: expectedJobs,
      missing_jobs: missingJobs,
    })
  } catch (error) {
    console.error('Failed to get cron health status:', error)
    return c.json({ error: 'Failed to get cron health status' }, 500)
  }
})

/**
 * GET /admin/system/cron/jobs
 *
 * Get list of expected cron jobs and their schedules.
 * Access: operations or security dashboard
 */
adminSystemRoutes.get('/cron/jobs', requireDashboard('operations'), async (c) => {
  const jobs = [
    {
      name: 'aggregate_hourly_metrics',
      cron: '0 * * * *',
      description: 'Aggregate platform metrics from agent_events',
      frequency: 'Hourly at minute 0',
    },
    {
      name: 'refresh_platform_summary',
      cron: '5 * * * *',
      description: 'Refresh materialized view for dashboard',
      frequency: 'Hourly at minute 5',
    },
    {
      name: 'aggregate_daily_metrics',
      cron: '0 0 * * *',
      description: 'Aggregate daily metrics for reporting',
      frequency: 'Daily at midnight UTC',
    },
    {
      name: 'cleanup_old_hourly_metrics',
      cron: '0 1 * * *',
      description: 'Remove hourly metrics older than 7 days',
      frequency: 'Daily at 1 AM UTC',
    },
    {
      name: 'check_alert_rules',
      cron: '*/5 * * * *',
      description: 'Evaluate platform-level alert rules',
      frequency: 'Every 5 minutes',
    },
    {
      name: 'check_agent_alert_rules',
      cron: '*/5 * * * *',
      description: 'Evaluate per-agent alert rules',
      frequency: 'Every 5 minutes',
    },
    {
      name: 'process_webhook_deliveries',
      cron: '* * * * *',
      description: 'Retry failed webhook deliveries',
      frequency: 'Every minute',
    },
    {
      name: 'cleanup_old_deliveries',
      cron: '0 0 * * *',
      description: 'Remove webhook deliveries older than 30 days',
      frequency: 'Daily at midnight UTC',
    },
    {
      name: 'aggregate_daily_revenue',
      cron: '0 0 * * *',
      description: 'Aggregate revenue by plan and token',
      frequency: 'Daily at midnight UTC',
    },
  ]

  return c.json({
    jobs,
    total: jobs.length,
    generated_at: new Date().toISOString(),
  })
})
