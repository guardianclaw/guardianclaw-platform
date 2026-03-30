/**
 * Admin Agents Routes
 * Administrative endpoints for agent management
 *
 * Endpoints:
 * - GET  /admin/agents/stats          - Platform-wide agent statistics
 * - GET  /admin/agents                - List agents with filters
 * - GET  /admin/agents/:id            - Agent details
 * - PATCH /admin/agents/:id/status    - Suspend/unsuspend agent
 * - GET  /admin/agents/:id/analytics  - Agent analytics
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
  getAgentsStats,
  listAgents,
  getAgentDetails,
  setAgentStatus,
  getAgentAnalytics,
  getAvailableFrameworks,
  getAvailableStatuses,
} from '../services/admin-agents'

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

export const adminAgentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================
// VALIDATION SCHEMAS
// ============================================

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const listAgentsSchema = paginationSchema.extend({
  framework: z.string().optional(),
  status: z.enum(['draft', 'testing', 'deployed', 'archived']).optional(),
  suspended: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(100).optional(),
  order_by: z.enum(['name', 'created_at', 'updated_at']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
})

const setStatusSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().min(5).max(500).optional(),
})

const analyticsSchema = z.object({
  days: z.coerce.number().min(1).max(90).default(30),
})

// Apply admin auth to all routes
adminAgentsRoutes.use('*', adminAuthMiddleware)
adminAgentsRoutes.use('*', adminAuditMiddleware)

// ============================================
// AGENT STATISTICS
// ============================================

/**
 * GET /admin/agents/stats
 *
 * Get platform-wide agent statistics.
 * Access: agents dashboard
 */
adminAgentsRoutes.get('/stats', requireDashboard('agents'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const stats = await getAgentsStats(supabase)

    return c.json({
      stats,
      frameworks: getAvailableFrameworks(),
      statuses: getAvailableStatuses(),
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get agents stats:', error)
    return c.json({ error: 'Failed to get agent statistics' }, 500)
  }
})

// ============================================
// AGENT LISTING
// ============================================

/**
 * GET /admin/agents
 *
 * List agents with pagination and filters.
 * Access: agents dashboard
 */
adminAgentsRoutes.get('/', requireDashboard('agents'), async (c) => {
  const query = listAgentsSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    framework: c.req.query('framework'),
    status: c.req.query('status'),
    suspended: c.req.query('suspended'),
    search: c.req.query('search'),
    order_by: c.req.query('order_by'),
    order_dir: c.req.query('order_dir'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { agents, total } = await listAgents(supabase, query.data.limit, query.data.offset, {
      framework: query.data.framework,
      status: query.data.status,
      suspended: query.data.suspended,
      search: query.data.search,
      orderBy: query.data.order_by,
      orderDir: query.data.order_dir,
    })

    return c.json({
      agents,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: agents.length,
        total,
      },
      filters: {
        framework: query.data.framework || null,
        status: query.data.status || null,
        suspended: query.data.suspended ?? null,
        search: query.data.search || null,
      },
    })
  } catch (error) {
    console.error('Failed to list agents:', error)
    return c.json({ error: 'Failed to list agents' }, 500)
  }
})

// ============================================
// AGENT DETAILS
// ============================================

/**
 * GET /admin/agents/:id
 *
 * Get detailed information for a specific agent.
 * Access: agents dashboard
 */
adminAgentsRoutes.get('/:id', requireDashboard('agents'), async (c) => {
  const agentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const agent = await getAgentDetails(supabase, agentId)

    if (!agent) {
      return c.json({ error: 'Agent not found' }, 404)
    }

    return c.json({ agent })
  } catch (error) {
    console.error('Failed to get agent details:', error)
    return c.json({ error: 'Failed to get agent details' }, 500)
  }
})

// ============================================
// AGENT STATUS (SUSPEND/UNSUSPEND)
// ============================================

/**
 * PATCH /admin/agents/:id/status
 *
 * Suspend or unsuspend an agent.
 * Access: suspend_agent action
 */
adminAgentsRoutes.patch('/:id/status', requireAction('suspend_agent'), async (c) => {
  const agentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
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
    return c.json({ error: 'Reason is required when suspending an agent' }, 400)
  }

  const adminHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const result = await setAgentStatus(
    supabase,
    agentId,
    parsed.data.suspended,
    adminHash,
    parsed.data.reason
  )

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      AGENT_NOT_FOUND: 'Agent not found',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to update agent status',
        code: result.error,
      },
      result.error === 'AGENT_NOT_FOUND' ? 404 : 400
    )
  }

  return c.json({
    success: true,
    agent_id: agentId,
    previous_status: result.previous_status ? 'suspended' : 'active',
    new_status: result.new_status ? 'suspended' : 'active',
  })
})

// ============================================
// AGENT ANALYTICS
// ============================================

/**
 * GET /admin/agents/:id/analytics
 *
 * Get analytics for a specific agent.
 * Access: agents dashboard
 */
adminAgentsRoutes.get('/:id/analytics', requireDashboard('agents'), async (c) => {
  const agentId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(agentId)) {
    return c.json({ error: 'Invalid agent ID format' }, 400)
  }

  const query = analyticsSchema.safeParse({
    days: c.req.query('days'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const analytics = await getAgentAnalytics(supabase, agentId, query.data.days)

    // Calculate summary
    const summary = analytics.reduce(
      (acc, day) => ({
        total_requests: acc.total_requests + day.requests,
        total_blocks: acc.total_blocks + day.blocks,
        gate_truth_blocks: acc.gate_truth_blocks + day.gate_truth_blocks,
        gate_harm_blocks: acc.gate_harm_blocks + day.gate_harm_blocks,
        gate_scope_blocks: acc.gate_scope_blocks + day.gate_scope_blocks,
        gate_purpose_blocks: acc.gate_purpose_blocks + day.gate_purpose_blocks,
      }),
      {
        total_requests: 0,
        total_blocks: 0,
        gate_truth_blocks: 0,
        gate_harm_blocks: 0,
        gate_scope_blocks: 0,
        gate_purpose_blocks: 0,
      }
    )

    return c.json({
      agent_id: agentId,
      days: query.data.days,
      analytics,
      summary: {
        ...summary,
        block_rate:
          summary.total_requests > 0
            ? Number(((summary.total_blocks / summary.total_requests) * 100).toFixed(2))
            : 0,
      },
    })
  } catch (error) {
    console.error('Failed to get agent analytics:', error)
    return c.json({ error: 'Failed to get agent analytics' }, 500)
  }
})
