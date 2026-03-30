/**
 * Admin Compliance Routes
 * Administrative endpoints for GDPR compliance management
 *
 * Endpoints:
 * - GET  /admin/compliance/stats              - Platform-wide compliance statistics
 * - GET  /admin/compliance/requests           - List GDPR requests with filters
 * - GET  /admin/compliance/requests/:id       - GDPR request details
 * - PATCH /admin/compliance/requests/:id      - Update GDPR request status
 * - GET  /admin/compliance/deletions          - List deletion audit records
 * - GET  /admin/compliance/report             - Generate compliance report
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
  getComplianceStats,
  listGdprRequests,
  getGdprRequestDetails,
  updateGdprRequest,
  listDeletionAudit,
  generateComplianceReport,
  getAvailableRequestTypes,
  getAvailableStatuses,
} from '../services/admin-compliance'

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

export const adminComplianceRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================
// VALIDATION SCHEMAS
// ============================================

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const listRequestsSchema = paginationSchema.extend({
  request_type: z.enum(['export', 'deletion', 'access', 'rectification']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']).optional(),
  search: z.string().max(100).optional(),
  order_by: z.enum(['requested_at', 'created_at']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
})

const listDeletionsSchema = paginationSchema.extend({
  search: z.string().max(100).optional(),
  order_by: z.enum(['deletion_date', 'created_at']).default('deletion_date'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
})

const updateRequestSchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'rejected']),
  notes: z.string().max(2000).optional(),
})

const reportSchema = z.object({
  start_date: z.string().datetime(),
  end_date: z.string().datetime(),
})

// Apply admin auth to all routes
adminComplianceRoutes.use('*', adminAuthMiddleware)
adminComplianceRoutes.use('*', adminAuditMiddleware)

// ============================================
// COMPLIANCE STATISTICS
// ============================================

/**
 * GET /admin/compliance/stats
 *
 * Get platform-wide compliance statistics.
 * Access: compliance dashboard
 */
adminComplianceRoutes.get('/stats', requireDashboard('compliance'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const stats = await getComplianceStats(supabase)

    return c.json({
      stats,
      request_types: getAvailableRequestTypes(),
      statuses: getAvailableStatuses(),
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get compliance stats:', error)
    return c.json({ error: 'Failed to get compliance statistics' }, 500)
  }
})

// ============================================
// GDPR REQUESTS LISTING
// ============================================

/**
 * GET /admin/compliance/requests
 *
 * List GDPR requests with pagination and filters.
 * Access: compliance dashboard
 */
adminComplianceRoutes.get('/requests', requireDashboard('compliance'), async (c) => {
  const query = listRequestsSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    request_type: c.req.query('request_type'),
    status: c.req.query('status'),
    search: c.req.query('search'),
    order_by: c.req.query('order_by'),
    order_dir: c.req.query('order_dir'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { requests, total } = await listGdprRequests(
      supabase,
      query.data.limit,
      query.data.offset,
      {
        request_type: query.data.request_type,
        status: query.data.status,
        search: query.data.search,
        orderBy: query.data.order_by,
        orderDir: query.data.order_dir,
      }
    )

    return c.json({
      requests,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: requests.length,
        total,
      },
      filters: {
        request_type: query.data.request_type || null,
        status: query.data.status || null,
        search: query.data.search || null,
      },
    })
  } catch (error) {
    console.error('Failed to list GDPR requests:', error)
    return c.json({ error: 'Failed to list GDPR requests' }, 500)
  }
})

// ============================================
// GDPR REQUEST DETAILS
// ============================================

/**
 * GET /admin/compliance/requests/:id
 *
 * Get detailed GDPR request information.
 * Access: compliance dashboard
 */
adminComplianceRoutes.get('/requests/:id', requireDashboard('compliance'), async (c) => {
  const requestId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(requestId)) {
    return c.json({ error: 'Invalid request ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const request = await getGdprRequestDetails(supabase, requestId)

    if (!request) {
      return c.json({ error: 'Request not found' }, 404)
    }

    return c.json({ request })
  } catch (error) {
    console.error('Failed to get GDPR request details:', error)
    return c.json({ error: 'Failed to get GDPR request details' }, 500)
  }
})

// ============================================
// UPDATE GDPR REQUEST
// ============================================

/**
 * PATCH /admin/compliance/requests/:id
 *
 * Update GDPR request status.
 * Access: process_gdpr action
 */
adminComplianceRoutes.patch('/requests/:id', requireAction('process_gdpr'), async (c) => {
  const requestId = c.req.param('id')
  const body = await c.req.json()
  const parsed = updateRequestSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(requestId)) {
    return c.json({ error: 'Invalid request ID format' }, 400)
  }

  const adminHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    // Verify request exists
    const existingRequest = await getGdprRequestDetails(supabase, requestId)
    if (!existingRequest) {
      return c.json({ error: 'Request not found' }, 404)
    }

    const result = await updateGdprRequest(
      supabase,
      requestId,
      parsed.data.status,
      parsed.data.notes || null,
      adminHash
    )

    if (!result.success) {
      return c.json({ error: result.error || 'Failed to update request' }, 500)
    }

    return c.json({
      success: true,
      request_id: requestId,
      status: result.status,
      completed_at: result.completed_at,
    })
  } catch (error) {
    console.error('Failed to update GDPR request:', error)
    return c.json({ error: 'Failed to update GDPR request' }, 500)
  }
})

// ============================================
// DELETION AUDIT LOG
// ============================================

/**
 * GET /admin/compliance/deletions
 *
 * List deletion audit records.
 * Access: compliance dashboard
 */
adminComplianceRoutes.get('/deletions', requireDashboard('compliance'), async (c) => {
  const query = listDeletionsSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    search: c.req.query('search'),
    order_by: c.req.query('order_by'),
    order_dir: c.req.query('order_dir'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { deletions, total } = await listDeletionAudit(
      supabase,
      query.data.limit,
      query.data.offset,
      {
        search: query.data.search,
        orderBy: query.data.order_by,
        orderDir: query.data.order_dir,
      }
    )

    return c.json({
      deletions,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: deletions.length,
        total,
      },
      filters: {
        search: query.data.search || null,
      },
    })
  } catch (error) {
    console.error('Failed to list deletion audit:', error)
    return c.json({ error: 'Failed to list deletion audit' }, 500)
  }
})

// ============================================
// COMPLIANCE REPORT
// ============================================

/**
 * GET /admin/compliance/report
 *
 * Generate compliance report for a time period.
 * Access: compliance dashboard
 */
adminComplianceRoutes.get('/report', requireDashboard('compliance'), async (c) => {
  const query = reportSchema.safeParse({
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const startDate = new Date(query.data.start_date)
  const endDate = new Date(query.data.end_date)

  // Validate date range
  if (startDate >= endDate) {
    return c.json({ error: 'Start date must be before end date' }, 400)
  }

  // Max report period: 1 year
  const maxPeriodMs = 365 * 24 * 60 * 60 * 1000
  if (endDate.getTime() - startDate.getTime() > maxPeriodMs) {
    return c.json({ error: 'Report period cannot exceed 1 year' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const report = await generateComplianceReport(
      supabase,
      startDate.toISOString(),
      endDate.toISOString()
    )

    return c.json({ report })
  } catch (error) {
    console.error('Failed to generate compliance report:', error)
    return c.json({ error: 'Failed to generate compliance report' }, 500)
  }
})
