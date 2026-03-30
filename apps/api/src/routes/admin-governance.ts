/**
 * Admin Governance Routes
 * Administrative endpoints for governance monitoring and moderation
 *
 * Endpoints:
 * - GET  /admin/governance/stats             - Platform-wide governance statistics
 * - GET  /admin/governance/proposals         - List proposals with filters
 * - GET  /admin/governance/proposals/:id     - Proposal details
 * - PATCH /admin/governance/proposals/:id/visibility - Toggle proposal visibility
 * - GET  /admin/governance/proposals/:id/votes - Get proposal votes
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
  getGovernanceStats,
  listProposals,
  getProposalDetails,
  getProposalVotes,
  toggleProposalVisibility,
  getAvailableStatuses,
  getAvailableTypes,
} from '../services/admin-governance'

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

export const adminGovernanceRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================
// VALIDATION SCHEMAS
// ============================================

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const listProposalsSchema = paginationSchema.extend({
  status: z.string().optional(),
  type: z.string().optional(),
  hidden: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  search: z.string().max(200).optional(),
  order_by: z.enum(['number', 'created_at', 'votes']).default('created_at'),
  order_dir: z.enum(['asc', 'desc']).default('desc'),
})

const toggleVisibilitySchema = z.object({
  hidden: z.boolean(),
  reason: z.string().min(5).max(500).optional(),
})

// Apply admin auth to all routes
adminGovernanceRoutes.use('*', adminAuthMiddleware)
adminGovernanceRoutes.use('*', adminAuditMiddleware)

// ============================================
// GOVERNANCE STATISTICS
// ============================================

/**
 * GET /admin/governance/stats
 *
 * Get platform-wide governance statistics.
 * Access: governance dashboard
 */
adminGovernanceRoutes.get('/stats', requireDashboard('governance'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const stats = await getGovernanceStats(supabase)

    return c.json({
      stats,
      statuses: getAvailableStatuses(),
      types: getAvailableTypes(),
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get governance stats:', error)
    return c.json({ error: 'Failed to get governance statistics' }, 500)
  }
})

// ============================================
// PROPOSAL LISTING
// ============================================

/**
 * GET /admin/governance/proposals
 *
 * List proposals with pagination and filters.
 * Access: governance dashboard
 */
adminGovernanceRoutes.get('/proposals', requireDashboard('governance'), async (c) => {
  const query = listProposalsSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    status: c.req.query('status'),
    type: c.req.query('type'),
    hidden: c.req.query('hidden'),
    search: c.req.query('search'),
    order_by: c.req.query('order_by'),
    order_dir: c.req.query('order_dir'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { proposals, total } = await listProposals(
      supabase,
      query.data.limit,
      query.data.offset,
      {
        status: query.data.status,
        type: query.data.type,
        hidden: query.data.hidden,
        search: query.data.search,
        orderBy: query.data.order_by,
        orderDir: query.data.order_dir,
      }
    )

    return c.json({
      proposals,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: proposals.length,
        total,
      },
      filters: {
        status: query.data.status || null,
        type: query.data.type || null,
        hidden: query.data.hidden ?? null,
        search: query.data.search || null,
      },
    })
  } catch (error) {
    console.error('Failed to list proposals:', error)
    return c.json({ error: 'Failed to list proposals' }, 500)
  }
})

// ============================================
// PROPOSAL DETAILS
// ============================================

/**
 * GET /admin/governance/proposals/:id
 *
 * Get detailed proposal information.
 * Access: governance dashboard
 */
adminGovernanceRoutes.get('/proposals/:id', requireDashboard('governance'), async (c) => {
  const proposalId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const proposal = await getProposalDetails(supabase, proposalId)

    if (!proposal) {
      return c.json({ error: 'Proposal not found' }, 404)
    }

    return c.json({ proposal })
  } catch (error) {
    console.error('Failed to get proposal details:', error)
    return c.json({ error: 'Failed to get proposal details' }, 500)
  }
})

// ============================================
// PROPOSAL VOTES
// ============================================

/**
 * GET /admin/governance/proposals/:id/votes
 *
 * Get votes for a proposal with pagination.
 * Access: governance dashboard
 */
adminGovernanceRoutes.get('/proposals/:id/votes', requireDashboard('governance'), async (c) => {
  const proposalId = c.req.param('id')
  const query = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const { votes, total } = await getProposalVotes(
      supabase,
      proposalId,
      query.data.limit,
      query.data.offset
    )

    return c.json({
      votes,
      pagination: {
        limit: query.data.limit,
        offset: query.data.offset,
        count: votes.length,
        total,
      },
    })
  } catch (error) {
    console.error('Failed to get proposal votes:', error)
    return c.json({ error: 'Failed to get proposal votes' }, 500)
  }
})

// ============================================
// PROPOSAL VISIBILITY (MODERATION)
// ============================================

/**
 * PATCH /admin/governance/proposals/:id/visibility
 *
 * Toggle proposal visibility (hide/show).
 * Access: moderate_proposals action
 */
adminGovernanceRoutes.patch(
  '/proposals/:id/visibility',
  requireAction('moderate_proposals'),
  async (c) => {
    const proposalId = c.req.param('id')
    const body = await c.req.json()
    const parsed = toggleVisibilitySchema.safeParse(body)

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
    if (!uuidRegex.test(proposalId)) {
      return c.json({ error: 'Invalid proposal ID format' }, 400)
    }

    // Reason is required when hiding
    if (parsed.data.hidden && !parsed.data.reason) {
      return c.json({ error: 'Reason is required when hiding a proposal' }, 400)
    }

    const adminHash = c.get('walletHash')
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

    try {
      // Verify proposal exists
      const proposal = await getProposalDetails(supabase, proposalId)
      if (!proposal) {
        return c.json({ error: 'Proposal not found' }, 404)
      }

      const result = await toggleProposalVisibility(
        supabase,
        proposalId,
        parsed.data.hidden,
        parsed.data.reason || null,
        adminHash
      )

      if (!result.success) {
        return c.json({ error: result.error || 'Failed to update visibility' }, 500)
      }

      return c.json({
        success: true,
        proposal_id: proposalId,
        is_hidden: result.is_hidden,
        hidden_at: result.hidden_at,
        action: result.is_hidden ? 'hidden' : 'shown',
      })
    } catch (error) {
      console.error('Failed to toggle proposal visibility:', error)
      return c.json({ error: 'Failed to update proposal visibility' }, 500)
    }
  }
)
