/**
 * Admin Audit Routes
 * Administrative endpoints for audit log viewing and export
 *
 * Endpoints:
 * - GET  /admin/audit/stats   - Audit log statistics
 * - GET  /admin/audit/logs    - List audit logs with filters
 * - GET  /admin/audit/export  - Export logs as CSV or JSON
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
  getAuditStats,
  listAuditLogs,
  exportAuditLogsCSV,
  exportAuditLogsJSON,
  getAvailableActionTypes,
  getAvailableTargetTypes,
  getAvailableStatusCodes,
} from '../services/admin-audit'

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

export const adminAuditRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================
// VALIDATION SCHEMAS
// ============================================

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const listLogsSchema = paginationSchema.extend({
  admin_hash: z.string().optional(),
  action_prefix: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).optional(),
  target_type: z.string().optional(),
  status_code: z.coerce.number().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  order_by: z.enum(['created_at', 'action']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
})

const exportSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  admin_hash: z.string().optional(),
  action_prefix: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']).optional(),
  target_type: z.string().optional(),
  status_code: z.coerce.number().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  max_rows: z.coerce.number().min(1).max(50000).default(10000),
})

// Apply admin auth to all routes
adminAuditRoutes.use('*', adminAuthMiddleware)
adminAuditRoutes.use('*', adminAuditMiddleware)

// ============================================
// AUDIT STATISTICS
// ============================================

/**
 * GET /admin/audit/stats
 *
 * Get audit log statistics.
 * Access: audit dashboard
 */
adminAuditRoutes.get('/stats', requireDashboard('audit'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const stats = await getAuditStats(supabase)

    return c.json({
      stats,
      action_types: getAvailableActionTypes(),
      target_types: getAvailableTargetTypes(),
      status_codes: getAvailableStatusCodes(),
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get audit stats:', error)
    return c.json({ error: 'Failed to get audit statistics' }, 500)
  }
})

// ============================================
// AUDIT LOG LISTING
// ============================================

/**
 * GET /admin/audit/logs
 *
 * List audit logs with filtering and pagination.
 * Access: audit dashboard
 */
adminAuditRoutes.get('/logs', requireDashboard('audit'), async (c) => {
  const query = listLogsSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    admin_hash: c.req.query('admin_hash'),
    action_prefix: c.req.query('action_prefix'),
    target_type: c.req.query('target_type'),
    status_code: c.req.query('status_code'),
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
    order_by: c.req.query('order_by'),
    order_dir: c.req.query('order_dir'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { logs, total } = await listAuditLogs(supabase, query.data.limit, query.data.offset, {
      admin_hash: query.data.admin_hash,
      action_prefix: query.data.action_prefix,
      target_type: query.data.target_type,
      status_code: query.data.status_code,
      start_date: query.data.start_date,
      end_date: query.data.end_date,
      orderBy: query.data.order_by,
      orderDir: query.data.order_dir,
    })

    return c.json({
      logs,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: logs.length,
        total,
      },
      filters: {
        admin_hash: query.data.admin_hash || null,
        action_prefix: query.data.action_prefix || null,
        target_type: query.data.target_type || null,
        status_code: query.data.status_code ?? null,
        start_date: query.data.start_date || null,
        end_date: query.data.end_date || null,
      },
    })
  } catch (error) {
    console.error('Failed to list audit logs:', error)
    return c.json({ error: 'Failed to list audit logs' }, 500)
  }
})

// ============================================
// AUDIT LOG EXPORT
// ============================================

/**
 * GET /admin/audit/export
 *
 * Export audit logs as CSV or JSON.
 * Access: export_audit action
 */
adminAuditRoutes.get('/export', requireAction('export_audit'), async (c) => {
  const query = exportSchema.safeParse({
    format: c.req.query('format'),
    admin_hash: c.req.query('admin_hash'),
    action_prefix: c.req.query('action_prefix'),
    target_type: c.req.query('target_type'),
    status_code: c.req.query('status_code'),
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
    max_rows: c.req.query('max_rows'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const filters = {
    admin_hash: query.data.admin_hash,
    action_prefix: query.data.action_prefix,
    target_type: query.data.target_type,
    status_code: query.data.status_code,
    start_date: query.data.start_date,
    end_date: query.data.end_date,
  }

  try {
    if (query.data.format === 'csv') {
      const csv = await exportAuditLogsCSV(supabase, filters, query.data.max_rows)

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    } else {
      const json = await exportAuditLogsJSON(supabase, filters, query.data.max_rows)

      return new Response(json, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="audit_logs_${new Date().toISOString().split('T')[0]}.json"`,
        },
      })
    }
  } catch (error) {
    console.error('Failed to export audit logs:', error)
    return c.json({ error: 'Failed to export audit logs' }, 500)
  }
})
