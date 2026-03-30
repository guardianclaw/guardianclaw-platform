/**
 * Admin Credits Routes
 * Administrative endpoints for credit management
 *
 * Endpoints:
 * - GET  /admin/credits/stats           - Platform-wide credit statistics
 * - GET  /admin/credits/user/:wallet    - User credit details
 * - POST /admin/credits/adjust          - Adjust user credits
 * - GET  /admin/credits/deposits        - List all deposits
 * - GET  /admin/credits/adjustments     - List all adjustments
 * - GET  /admin/credits/low-balance     - Users with low balance
 * - GET  /admin/credits/user/:wallet/deposits    - User deposit history
 * - GET  /admin/credits/user/:wallet/adjustments - User adjustment history
 * - GET  /admin/credits/user/:wallet/notes       - User notes
 * - POST /admin/credits/user/:wallet/notes       - Add user note
 * - DELETE /admin/credits/notes/:id              - Delete note
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
  getPlatformCreditsStats,
  getUserCreditsDetails,
  getUserDeposits,
  getUserAdjustments,
  adjustCredits,
  getLowBalanceUsers,
  getAllDeposits,
  getAllAdjustments,
  getUserNotes,
  addUserNote,
  deleteUserNote,
  toggleNotePin,
  type AdjustmentType,
  type ReferenceType,
  type NoteCategory,
} from '../services/admin-credits'
import { COST_PER_EXECUTION, MIN_DEPOSIT_USD } from '../services/credits'

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

export const adminCreditsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// ============================================
// VALIDATION SCHEMAS
// ============================================

const adjustCreditsSchema = z.object({
  wallet_address: z.string().min(32, 'Invalid wallet address').max(64, 'Invalid wallet address'),
  amount: z
    .number({
      required_error: 'Amount is required',
      invalid_type_error: 'Amount must be a number',
    })
    .refine((val) => val !== 0, 'Amount cannot be zero'),
  type: z.enum(['refund', 'courtesy', 'correction', 'bonus', 'penalty'], {
    errorMap: () => ({ message: 'Type must be: refund, courtesy, correction, bonus, or penalty' }),
  }),
  reason: z
    .string()
    .min(5, 'Reason must be at least 5 characters')
    .max(500, 'Reason cannot exceed 500 characters'),
  reference_id: z.string().max(100).optional(),
  reference_type: z.enum(['ticket', 'deposit', 'agent_event', 'other']).optional(),
})

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
})

const depositsFilterSchema = paginationSchema.extend({
  status: z.enum(['pending', 'confirmed', 'failed']).optional(),
  token: z.enum(['SOL', 'USDC', 'GCLAW']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
})

const adjustmentsFilterSchema = paginationSchema.extend({
  type: z.enum(['refund', 'courtesy', 'correction', 'bonus', 'penalty']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
})

const lowBalanceSchema = paginationSchema.extend({
  threshold: z.coerce.number().min(0.01).max(10).default(0.3),
})

const addNoteSchema = z.object({
  note: z.string().min(1, 'Note is required').max(2000, 'Note cannot exceed 2000 characters'),
  category: z.enum(['general', 'support', 'billing', 'security', 'compliance']).default('general'),
})

// Apply admin auth to all routes
adminCreditsRoutes.use('*', adminAuthMiddleware)
adminCreditsRoutes.use('*', adminAuditMiddleware)

// ============================================
// PLATFORM STATISTICS
// ============================================

/**
 * GET /admin/credits/stats
 *
 * Get platform-wide credit statistics.
 * Access: credits dashboard
 */
adminCreditsRoutes.get('/stats', requireDashboard('credits'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    const stats = await getPlatformCreditsStats(supabase)

    return c.json({
      stats,
      config: {
        cost_per_execution: COST_PER_EXECUTION,
        min_deposit_usd: MIN_DEPOSIT_USD,
      },
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Failed to get platform credits stats:', error)
    return c.json({ error: 'Failed to get platform credit statistics' }, 500)
  }
})

// ============================================
// USER CREDIT DETAILS
// ============================================

/**
 * GET /admin/credits/user/:wallet
 *
 * Get detailed credit information for a specific user.
 * Access: credits dashboard
 */
adminCreditsRoutes.get('/user/:wallet', requireDashboard('credits'), async (c) => {
  const wallet = c.req.param('wallet')

  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return c.json({ error: 'Invalid wallet address' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  try {
    // Get credit details
    const credits = await getUserCreditsDetails(supabase, wallet)

    // Get user profile for display name
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, status, plan, created_at')
      .eq('wallet_address', wallet)
      .single()

    return c.json({
      wallet_address: wallet,
      display_name: profile?.display_name || null,
      status: profile?.status || 'unknown',
      plan: profile?.plan || 'free',
      member_since: profile?.created_at || null,
      credits,
      config: {
        cost_per_execution: COST_PER_EXECUTION,
      },
    })
  } catch (error) {
    console.error('Failed to get user credits:', error)
    return c.json({ error: 'Failed to get user credit details' }, 500)
  }
})

/**
 * GET /admin/credits/user/:wallet/deposits
 *
 * Get deposit history for a specific user.
 * Access: credits dashboard
 */
adminCreditsRoutes.get('/user/:wallet/deposits', requireDashboard('credits'), async (c) => {
  const wallet = c.req.param('wallet')
  const query = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
  const deposits = await getUserDeposits(supabase, wallet, query.data.limit, query.data.offset)

  return c.json({
    deposits,
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: deposits.length,
    },
  })
})

/**
 * GET /admin/credits/user/:wallet/adjustments
 *
 * Get adjustment history for a specific user.
 * Access: credits dashboard
 */
adminCreditsRoutes.get('/user/:wallet/adjustments', requireDashboard('credits'), async (c) => {
  const wallet = c.req.param('wallet')
  const query = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
  const adjustments = await getUserAdjustments(
    supabase,
    wallet,
    query.data.limit,
    query.data.offset
  )

  return c.json({
    adjustments,
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: adjustments.length,
    },
  })
})

// ============================================
// CREDIT ADJUSTMENTS
// ============================================

/**
 * POST /admin/credits/adjust
 *
 * Adjust credits for a user (refund, courtesy, correction, etc.)
 * Access: adjust_credits action
 */
adminCreditsRoutes.post('/adjust', requireAction('adjust_credits'), async (c) => {
  const body = await c.req.json()
  const parsed = adjustCreditsSchema.safeParse(body)

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

  // Verify target user exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address, display_name')
    .eq('wallet_address', parsed.data.wallet_address)
    .single()

  if (!profile) {
    return c.json({ error: 'User not found' }, 404)
  }

  const result = await adjustCredits(supabase, {
    walletAddress: parsed.data.wallet_address,
    amount: parsed.data.amount,
    type: parsed.data.type as AdjustmentType,
    reason: parsed.data.reason,
    adminHash,
    referenceId: parsed.data.reference_id,
    referenceType: parsed.data.reference_type as ReferenceType | undefined,
  })

  if (!result.success) {
    const errorMessages: Record<string, string> = {
      INSUFFICIENT_BALANCE: 'Cannot reduce balance below zero',
      DATABASE_ERROR: 'Database error occurred',
    }
    return c.json(
      {
        error: errorMessages[result.error || ''] || 'Failed to adjust credits',
        code: result.error,
      },
      400
    )
  }

  return c.json({
    success: true,
    adjustment: {
      id: result.adjustment_id,
      wallet_address: parsed.data.wallet_address,
      amount: parsed.data.amount,
      type: parsed.data.type,
      reason: parsed.data.reason,
    },
    new_balance: result.new_balance,
    executions_remaining: Math.floor(result.new_balance / COST_PER_EXECUTION),
  })
})

// ============================================
// PLATFORM-WIDE LISTINGS
// ============================================

/**
 * GET /admin/credits/deposits
 *
 * List all deposits across the platform.
 * Access: credits dashboard
 */
adminCreditsRoutes.get('/deposits', requireDashboard('credits'), async (c) => {
  const query = depositsFilterSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    status: c.req.query('status'),
    token: c.req.query('token'),
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const filters = {
    status: query.data.status,
    token: query.data.token,
    startDate: query.data.start_date ? new Date(query.data.start_date) : undefined,
    endDate: query.data.end_date ? new Date(query.data.end_date) : undefined,
  }

  const { deposits, total } = await getAllDeposits(
    supabase,
    query.data.limit,
    query.data.offset,
    filters
  )

  return c.json({
    deposits,
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: deposits.length,
      total,
    },
    filters: {
      status: query.data.status || null,
      token: query.data.token || null,
      start_date: query.data.start_date || null,
      end_date: query.data.end_date || null,
    },
  })
})

/**
 * GET /admin/credits/adjustments
 *
 * List all credit adjustments across the platform.
 * Access: credits dashboard
 */
adminCreditsRoutes.get('/adjustments', requireDashboard('credits'), async (c) => {
  const query = adjustmentsFilterSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    type: c.req.query('type'),
    start_date: c.req.query('start_date'),
    end_date: c.req.query('end_date'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const filters = {
    type: query.data.type as AdjustmentType | undefined,
    startDate: query.data.start_date ? new Date(query.data.start_date) : undefined,
    endDate: query.data.end_date ? new Date(query.data.end_date) : undefined,
  }

  const { adjustments, total } = await getAllAdjustments(
    supabase,
    query.data.limit,
    query.data.offset,
    filters
  )

  return c.json({
    adjustments,
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: adjustments.length,
      total,
    },
    filters: {
      type: query.data.type || null,
      start_date: query.data.start_date || null,
      end_date: query.data.end_date || null,
    },
  })
})

/**
 * GET /admin/credits/low-balance
 *
 * Get users with low credit balance for proactive support.
 * Access: credits dashboard
 */
adminCreditsRoutes.get('/low-balance', requireDashboard('credits'), async (c) => {
  const query = lowBalanceSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
    threshold: c.req.query('threshold'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const users = await getLowBalanceUsers(
    supabase,
    query.data.threshold,
    query.data.limit,
    query.data.offset
  )

  return c.json({
    users,
    threshold_usd: query.data.threshold,
    threshold_executions: Math.floor(query.data.threshold / COST_PER_EXECUTION),
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: users.length,
    },
  })
})

// ============================================
// USER NOTES
// ============================================

/**
 * GET /admin/credits/user/:wallet/notes
 *
 * Get notes for a specific user.
 * Access: credits dashboard (support context)
 */
adminCreditsRoutes.get('/user/:wallet/notes', requireDashboard('credits'), async (c) => {
  const wallet = c.req.param('wallet')
  const query = paginationSchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
  const notes = await getUserNotes(supabase, wallet, query.data.limit, query.data.offset)

  return c.json({
    notes,
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: notes.length,
    },
  })
})

/**
 * POST /admin/credits/user/:wallet/notes
 *
 * Add a note to a user.
 * Access: view_user action (support and above)
 */
adminCreditsRoutes.post('/user/:wallet/notes', requireAction('view_user'), async (c) => {
  const wallet = c.req.param('wallet')
  const body = await c.req.json()
  const parsed = addNoteSchema.safeParse(body)

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

  // Verify user exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('wallet_address', wallet)
    .single()

  if (!profile) {
    return c.json({ error: 'User not found' }, 404)
  }

  const note = await addUserNote(
    supabase,
    wallet,
    parsed.data.note,
    adminHash,
    parsed.data.category as NoteCategory
  )

  if (!note) {
    return c.json({ error: 'Failed to add note' }, 500)
  }

  return c.json(note, 201)
})

/**
 * DELETE /admin/credits/notes/:id
 *
 * Delete a note.
 * Access: manage_alerts action (admin and above)
 */
adminCreditsRoutes.delete('/notes/:id', requireAction('manage_alerts'), async (c) => {
  const noteId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(noteId)) {
    return c.json({ error: 'Invalid note ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
  const success = await deleteUserNote(supabase, noteId)

  if (!success) {
    return c.json({ error: 'Failed to delete note' }, 500)
  }

  return c.json({ success: true })
})

/**
 * PATCH /admin/credits/notes/:id/pin
 *
 * Toggle pin status of a note.
 * Access: view_user action
 */
adminCreditsRoutes.patch('/notes/:id/pin', requireAction('view_user'), async (c) => {
  const noteId = c.req.param('id')
  const body = await c.req.json()
  const isPinned = body.is_pinned === true

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(noteId)) {
    return c.json({ error: 'Invalid note ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
  const success = await toggleNotePin(supabase, noteId, isPinned)

  if (!success) {
    return c.json({ error: 'Failed to update note' }, 500)
  }

  return c.json({ success: true, is_pinned: isPinned })
})
