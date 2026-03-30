import { Hono } from 'hono'
import { z } from 'zod'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import nacl from 'tweetnacl'
import {
  getGuardianClawBalance,
  getGuardianClawBalanceAtSlot,
  getCurrentSlot,
  getTokenSupply,
  TOKEN_DECIMALS,
} from '../services/solana-token'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  SOLANA_RPC_URL?: string
  SOLANA_ARCHIVE_RPC_URL?: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
}

import bs58 from 'bs58'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Utility to verify signature
function verifySignature(message: string, signature: string, publicKey: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message)
    // Solana public keys are Base58
    const publicKeyBytes = bs58.decode(publicKey)
    // Signature is Base64 from frontend
    const sigString = atob(signature)
    const signatureBytes = new Uint8Array(sigString.length)
    for (let i = 0; i < sigString.length; i++) {
      signatureBytes[i] = sigString.charCodeAt(i)
    }
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)
  } catch (e) {
    console.error('Signature verification failed:', e)
    return false
  }
}

export const governanceRoutes = new Hono<{
  Bindings: Bindings & { GOVERNANCE_PAUSED?: string }
  Variables: Variables
}>()

// Emergency pause state (in-memory, toggleable via admin endpoint)
let governancePaused = false

function isGovernancePaused(c: { env?: { GOVERNANCE_PAUSED?: string } }): boolean {
  if (c.env?.GOVERNANCE_PAUSED === 'true') return true
  return governancePaused
}

// Admin pause toggle — placed before auth middleware so it uses its own auth check
governanceRoutes.patch('/admin/pause', authMiddleware, async (c) => {
  const wallet = c.get('wallet')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data: adminRole, error: roleError } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('wallet_address', wallet)
    .eq('is_active', true)
    .single()

  if (roleError || !adminRole || !['admin', 'super_admin'].includes(adminRole.role)) {
    return c.json({ error: 'Admin access required' }, 403)
  }

  const body = await c.req.json().catch(() => ({}))
  governancePaused = !!body.paused

  console.log(
    `[governance] Emergency pause ${governancePaused ? 'ENABLED' : 'DISABLED'} by ${wallet}`
  )
  return c.json({ paused: governancePaused })
})

// Public pause status
governanceRoutes.get('/admin/pause', async (c) => {
  return c.json({ paused: isGovernancePaused(c) })
})

// Middleware: auth + wallet-based rate limiting (100/min per wallet)
governanceRoutes.use('/proposals', authMiddleware)
governanceRoutes.use('/proposals/*', authMiddleware)
governanceRoutes.use('/profile', authMiddleware)
governanceRoutes.use('/proposals', walletRateLimitMiddleware())
governanceRoutes.use('/proposals/*', walletRateLimitMiddleware())
governanceRoutes.use('/profile', walletRateLimitMiddleware())
// Note: stats are public (no auth or rate limit)

// Pause middleware for write operations
governanceRoutes.use('/proposals', async (c, next) => {
  if (c.req.method !== 'GET' && isGovernancePaused(c)) {
    return c.json({ error: 'Governance is temporarily paused', paused: true }, 503)
  }
  await next()
})
governanceRoutes.use('/proposals/*', async (c, next) => {
  if (c.req.method !== 'GET' && isGovernancePaused(c)) {
    return c.json({ error: 'Governance is temporarily paused', paused: true }, 503)
  }
  await next()
})

// Schemas
const proposalQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(10),
})

const createProposalSchema = z.object({
  title: z.string().min(10).max(200),
  body: z.string().min(100),
  type: z.enum(['feature', 'governance', 'seed', 'docs', 'partnership', 'meta']),
})

const voteSchema = z.object({
  vote_direction: z.enum(['for', 'against']),
  signature: z.string(),
  message: z.string(), // The full JSON message string that was signed
})

const commentSchema = z.object({
  content: z.string().min(1).max(5000),
  parent_comment_id: z.string().uuid().optional(),
  signature: z.string(),
  message: z.string(),
})

const submitProposalSchema = z.object({
  signature: z.string(),
  message: z.string(),
  voting_period_days: z.number().min(3).max(30).optional(),
})

const cancelProposalSchema = z.object({
  signature: z.string(),
  message: z.string(),
  reason: z.string().max(500).optional(),
})

/**
 * Shared finalization logic used by both the manual endpoint and the scheduled job.
 * Returns the finalized proposal data or throws on error.
 */
export async function finalizeProposal(
  supabase: SupabaseClient,
  proposal: Record<string, unknown>,
  rpcUrl?: string
): Promise<{
  proposal: Record<string, unknown>
  details: {
    total_votes: number
    votes_for: number
    votes_against: number
    quorum_reached: boolean
    quorum_required: number
    majority_required: number
    supply_source: string
  }
}> {
  const proposalId = proposal.id as string

  // Get vote totals
  const { data: votes, error: votesError } = await supabase
    .from('votes')
    .select('vote_direction, vote_power')
    .eq('proposal_id', proposalId)

  if (votesError) {
    throw new Error(`Failed to fetch votes: ${votesError.message}`)
  }

  let votesFor = 0
  let votesAgainst = 0
  for (const vote of votes || []) {
    if (vote.vote_direction === 'for') {
      votesFor += vote.vote_power
    } else {
      votesAgainst += vote.vote_power
    }
  }

  const totalVotes = votesFor + votesAgainst
  const quorumRequired = (proposal.quorum_required as number) || 0.1
  const majorityRequired = (proposal.majority_required as number) || 0.5

  // Get real token supply for quorum calculation
  let totalSupply: number
  let supplySource: string

  if (rpcUrl) {
    const supplyResult = await getTokenSupply(rpcUrl)
    if (supplyResult.fallback) {
      // Don't use unreliable fallback values for quorum decisions
      throw new Error('Cannot finalize: token supply unavailable. Retry later.')
    }
    totalSupply = supplyResult.supply
    supplySource = supplyResult.cached ? 'cached' : 'on-chain'
    if (supplyResult.error) {
      console.warn(`[governance] Supply warning for proposal ${proposalId}: ${supplyResult.error}`)
    }
  } else {
    // No RPC configured — cannot make reliable quorum decisions
    throw new Error('Cannot finalize: Solana RPC not configured.')
  }

  const quorumReached = totalVotes >= totalSupply * quorumRequired

  let finalStatus: string
  if (!quorumReached) {
    finalStatus = 'no_quorum'
  } else if (totalVotes > 0 && votesFor / totalVotes >= majorityRequired) {
    finalStatus = 'passed'
  } else {
    finalStatus = 'rejected'
  }

  const now = new Date()
  const { data: updated, error: updateError } = await supabase
    .from('proposals')
    .update({
      status: finalStatus,
      votes_for: votesFor,
      votes_against: votesAgainst,
      updated_at: now.toISOString(),
    })
    .eq('id', proposalId)
    .select()
    .single()

  if (updateError) {
    throw new Error(`Failed to finalize proposal: ${updateError.message}`)
  }

  return {
    proposal: updated,
    details: {
      total_votes: totalVotes,
      votes_for: votesFor,
      votes_against: votesAgainst,
      quorum_reached: quorumReached,
      quorum_required: quorumRequired,
      majority_required: majorityRequired,
      supply_source: supplySource,
    },
  }
}

// GET /governance/stats - Public statistics
governanceRoutes.get('/stats', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase.rpc('get_governance_stats')

  if (error) {
    console.error('Get stats error:', error)
    return c.json({ error: 'Failed to retrieve governance stats' }, 500)
  }

  return c.json(data)
})

// GET /governance/config — Public governance configuration
governanceRoutes.get('/config', (c) => {
  return c.json({
    min_tokens_to_propose: 10_000_000,
    min_tokens_to_vote: 1_000_000,
    tokens_per_vote: 1_000_000,
    voting_period_days: 5,
    discussion_period_days: 5,
    quorum_percentage: 10,
    token_decimals: TOKEN_DECIMALS,
  })
})

// GET /governance/health — Governance system health
governanceRoutes.get('/health', async (c) => {
  const hasRpc = !!c.env.SOLANA_RPC_URL
  let dbReachable = false

  try {
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
    const { error } = await supabase.from('proposals').select('id').limit(1)
    dbReachable = !error
  } catch {
    dbReachable = false
  }

  const hasArchiveRpc = !!c.env.SOLANA_ARCHIVE_RPC_URL

  return c.json({
    governance: hasRpc && dbReachable,
    solana_rpc: hasRpc,
    solana_archive_rpc: hasArchiveRpc,
    snapshot_enabled: hasRpc && hasArchiveRpc,
    database: dbReachable,
  })
})

// GET /governance/profile - Get user's governance profile
governanceRoutes.get('/profile', async (c) => {
  const wallet = c.get('wallet')
  const rpcUrl = c.env.SOLANA_RPC_URL
  if (!rpcUrl) {
    return c.json(
      {
        error: 'governance_unavailable',
        message: 'Governance features require Solana RPC configuration',
      },
      503
    )
  }

  // Fetch real token balance from Solana blockchain
  const balanceResult = await getGuardianClawBalance(rpcUrl, wallet)

  if (balanceResult.error) {
    // Don't log raw wallet address - just log the error type
    console.warn(`Token balance warning: ${balanceResult.error}`)
  }

  // 1M tokens = 1 vote
  const votingPower = Math.floor(balanceResult.balance / 1_000_000)
  const can_propose = votingPower >= 10

  return c.json({
    wallet_address: wallet,
    voting_power: votingPower,
    can_propose: can_propose,
    token_balance: balanceResult.balance,
    balance_cached: balanceResult.cached,
    ...(balanceResult.error && { balance_warning: balanceResult.error }),
  })
})

// GET /governance/proposals - List proposals
governanceRoutes.get('/proposals', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)
  const query = c.req.query()
  const parsed = proposalQuerySchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters' }, 400)
  }

  const { status, page, limit } = parsed.data
  const pageNum = page
  const limitNum = limit
  const offset = (pageNum - 1) * limitNum

  let queryBuilder = supabase
    .from('proposals')
    .select('*', { count: 'exact' })
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limitNum - 1)

  if (status && status !== 'undefined') {
    queryBuilder = queryBuilder.eq('status', status)
  }

  const { data, error, count } = await queryBuilder

  if (error) {
    console.error('List proposals error:', JSON.stringify(error))

    // Retry without is_hidden filter if column doesn't exist
    if (error.message?.includes('is_hidden') || error.code === '42703') {
      console.warn('is_hidden column not found, retrying without filter')
      let fallbackBuilder = supabase
        .from('proposals')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1)

      if (status && status !== 'undefined') {
        fallbackBuilder = fallbackBuilder.eq('status', status)
      }

      const fallback = await fallbackBuilder
      if (!fallback.error) {
        return c.json({
          proposals: fallback.data,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: fallback.count,
            pages: Math.ceil((fallback.count || 0) / limitNum),
          },
        })
      }
      console.error('Fallback query also failed:', JSON.stringify(fallback.error))
    }

    return c.json({ error: 'Failed to list proposals', detail: error.message }, 500)
  }

  return c.json({
    proposals: data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count,
      pages: Math.ceil((count || 0) / limitNum),
    },
  })
})

// GET /governance/proposals/:id - Get a single proposal
governanceRoutes.get('/proposals/:id', async (c) => {
  const id = c.req.param('id')
  if (!UUID_REGEX.test(id)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', id)
    .eq('is_hidden', false)
    .single()

  if (error || !data) {
    return c.json({ error: 'Proposal not found' }, 404)
  }

  return c.json(data)
})

// POST /governance/proposals - Create a new proposal
governanceRoutes.post('/proposals', async (c) => {
  const wallet = c.get('wallet')
  const body = await c.req.json()
  const parsed = createProposalSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  // Real check for can_propose using actual token balance
  const rpcUrl = c.env.SOLANA_RPC_URL
  if (!rpcUrl) {
    return c.json(
      {
        error: 'governance_unavailable',
        message: 'Governance features require Solana RPC configuration',
      },
      503
    )
  }
  const balanceResult = await getGuardianClawBalance(rpcUrl, wallet)
  const votingPower = Math.floor(balanceResult.balance / 1_000_000)
  const can_propose = votingPower >= 10

  if (!can_propose) {
    return c.json(
      {
        error: 'Insufficient voting power to create a proposal',
        required: 10,
        current: votingPower,
      },
      403
    )
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Discussion period: 5 days from creation
  const now = new Date()
  const discussionEndAt = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('proposals')
    .insert({
      author_wallet: wallet,
      title: parsed.data.title,
      body: parsed.data.body,
      type: parsed.data.type,
      status: 'discussion',
      discussion_end_at: discussionEndAt.toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Create proposal error:', error)
    return c.json({ error: 'Failed to create proposal' }, 500)
  }

  return c.json(data, 201)
})

// POST /governance/proposals/:id/votes - Cast a vote
governanceRoutes.post('/proposals/:id/votes', async (c) => {
  const wallet = c.get('wallet')
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = voteSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  // Verify signature against the actual message signed by the frontend
  const isSignatureValid = verifySignature(parsed.data.message, parsed.data.signature, wallet)

  if (!isSignatureValid) {
    return c.json({ error: 'Invalid signature' }, 403)
  }

  // Verify the message intent
  try {
    const messageData = JSON.parse(parsed.data.message)
    if (messageData.action !== 'vote' || messageData.proposal_id !== proposalId) {
      return c.json({ error: 'Signature message mismatch' }, 403)
    }
    // Domain verification (optional but good)
    if (messageData.domain !== 'guardianclaw.org') {
      return c.json({ error: 'Invalid domain signature' }, 403)
    }
  } catch (e) {
    return c.json({ error: 'Invalid message format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify proposal exists and is in voting status
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('id, status, is_hidden, snapshot_slot')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return c.json({ error: 'Proposal not found' }, 404)
  }
  if (proposal.status !== 'voting') {
    return c.json({ error: `Cannot vote on proposal with status '${proposal.status}'` }, 400)
  }
  if (proposal.is_hidden) {
    return c.json({ error: 'Proposal not found' }, 404)
  }

  // Fetch real voting power from blockchain
  const rpcUrl = c.env.SOLANA_RPC_URL
  if (!rpcUrl) {
    return c.json(
      {
        error: 'governance_unavailable',
        message: 'Governance features require Solana RPC configuration',
      },
      503
    )
  }

  // Resolve balance: prefer snapshot slot if available + archive RPC configured
  let balanceResult
  let snapshotVerified = false
  const archiveRpcUrl = c.env.SOLANA_ARCHIVE_RPC_URL

  if (proposal.snapshot_slot && archiveRpcUrl) {
    // Try historical balance at the snapshot slot
    balanceResult = await getGuardianClawBalanceAtSlot(
      archiveRpcUrl,
      wallet,
      proposal.snapshot_slot
    )
    if (!balanceResult.error) {
      snapshotVerified = true
    } else {
      // Fallback to current balance if archive RPC fails
      console.warn(
        `[governance] Archive RPC failed for vote on ${proposalId}, falling back to current balance: ${balanceResult.error}`
      )
      balanceResult = await getGuardianClawBalance(rpcUrl, wallet)
    }
  } else {
    // No snapshot (legacy proposal) or no archive RPC — use current balance
    balanceResult = await getGuardianClawBalance(rpcUrl, wallet)
  }

  const voting_power = Math.floor(balanceResult.balance / 1_000_000)

  if (voting_power < 1) {
    return c.json(
      {
        error: 'Insufficient voting power to vote',
        required: 1,
        current: voting_power,
      },
      403
    )
  }

  const { data, error } = await supabase
    .from('votes')
    .insert({
      proposal_id: proposalId,
      wallet_address: wallet,
      vote_direction: parsed.data.vote_direction,
      vote_power: voting_power,
      signature: parsed.data.signature,
    })
    .select()
    .single()

  if (error) {
    // Handle unique constraint violation (already voted)
    if (error.code === '23505') {
      return c.json({ error: 'You have already voted on this proposal' }, 409)
    }
    console.error('Vote error:', error)
    return c.json({ error: 'Failed to cast vote' }, 500)
  }

  return c.json({ ...data, snapshot_verified: snapshotVerified }, 201)
})

// GET /governance/proposals/:id/votes/check - Check if current user has voted
governanceRoutes.get('/proposals/:id/votes/check', async (c) => {
  const wallet = c.get('wallet')
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data: vote, error } = await supabase
    .from('votes')
    .select('vote_direction, vote_power')
    .eq('proposal_id', proposalId)
    .eq('wallet_address', wallet)
    .maybeSingle()

  if (error) {
    console.error('Check vote error:', error)
    return c.json({ error: 'Failed to check vote status' }, 500)
  }

  if (vote) {
    return c.json({
      voted: true,
      vote_direction: vote.vote_direction,
      vote_power: vote.vote_power,
    })
  }

  return c.json({ voted: false })
})

// GET /governance/proposals/:id/comments - Get comments for a proposal
governanceRoutes.get('/proposals/:id/comments', async (c) => {
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('proposal_id', proposalId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Get comments error:', error)
    return c.json({ error: 'Failed to retrieve comments' }, 500)
  }

  return c.json(data)
})

// POST /governance/proposals/:id/comments - Add a comment
governanceRoutes.post('/proposals/:id/comments', async (c) => {
  const wallet = c.get('wallet')
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = commentSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  // Verify signature
  const isSignatureValid = verifySignature(parsed.data.message, parsed.data.signature, wallet)

  if (!isSignatureValid) {
    return c.json({ error: 'Invalid signature' }, 403)
  }

  // Verify intent
  try {
    const messageData = JSON.parse(parsed.data.message)
    if (messageData.action !== 'comment' || messageData.proposal_id !== proposalId) {
      return c.json({ error: 'Signature message mismatch' }, 403)
    }
    if (messageData.domain !== 'guardianclaw.org') {
      return c.json({ error: 'Invalid domain signature' }, 403)
    }
  } catch (e) {
    return c.json({ error: 'Invalid message format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('comments')
    .insert({
      proposal_id: proposalId,
      author_wallet: wallet,
      content: parsed.data.content,
      parent_comment_id: parsed.data.parent_comment_id,
      signature: parsed.data.signature,
    })
    .select()
    .single()

  if (error) {
    console.error('Create comment error:', error)
    return c.json({ error: 'Failed to add comment' }, 500)
  }

  return c.json(data, 201)
})

// PATCH /governance/proposals/:id/submit - Submit proposal for voting
governanceRoutes.patch('/proposals/:id/submit', async (c) => {
  const wallet = c.get('wallet')
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = submitProposalSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  // Verify signature
  const isSignatureValid = verifySignature(parsed.data.message, parsed.data.signature, wallet)

  if (!isSignatureValid) {
    return c.json({ error: 'Invalid signature' }, 403)
  }

  // Verify message intent
  try {
    const messageData = JSON.parse(parsed.data.message)
    if (messageData.action !== 'submit' || messageData.proposal_id !== proposalId) {
      return c.json({ error: 'Signature message mismatch' }, 403)
    }
    if (messageData.domain !== 'guardianclaw.org') {
      return c.json({ error: 'Invalid domain signature' }, 403)
    }
  } catch (e) {
    return c.json({ error: 'Invalid message format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Fetch proposal and verify ownership and status
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return c.json({ error: 'Proposal not found' }, 404)
  }

  if (proposal.author_wallet !== wallet) {
    return c.json({ error: 'Only the proposal author can submit it for voting' }, 403)
  }

  if (proposal.status !== 'discussion') {
    return c.json({ error: `Cannot submit proposal with status '${proposal.status}'` }, 400)
  }

  // Enforce discussion period
  if (proposal.discussion_end_at && new Date(proposal.discussion_end_at) > new Date()) {
    return c.json(
      {
        error: 'Discussion period has not ended yet',
        discussion_end_at: proposal.discussion_end_at,
      },
      400
    )
  }

  // Calculate voting period
  const votingPeriodDays = parsed.data.voting_period_days || 7
  const now = new Date()
  const votingEndAt = new Date(now.getTime() + votingPeriodDays * 24 * 60 * 60 * 1000)

  // Snapshot the current Solana slot for balance verification during voting
  let snapshotSlot: number | null = null
  const rpcUrl = c.env.SOLANA_RPC_URL
  if (rpcUrl) {
    try {
      snapshotSlot = await getCurrentSlot(rpcUrl)
    } catch (err) {
      // Graceful degradation — voting can proceed without snapshot
      console.warn(
        '[governance] Failed to capture snapshot slot:',
        err instanceof Error ? err.message : err
      )
    }
  }

  // Update proposal status to voting
  const { data: updated, error: updateError } = await supabase
    .from('proposals')
    .update({
      status: 'voting',
      voting_start_at: now.toISOString(),
      voting_end_at: votingEndAt.toISOString(),
      updated_at: now.toISOString(),
      ...(snapshotSlot !== null && { snapshot_slot: snapshotSlot }),
    })
    .eq('id', proposalId)
    .select()
    .single()

  if (updateError) {
    console.error('Submit proposal error:', updateError)
    return c.json({ error: 'Failed to submit proposal for voting' }, 500)
  }

  return c.json(updated)
})

// PATCH /governance/proposals/:id/finalize - Finalize voting
governanceRoutes.patch('/proposals/:id/finalize', async (c) => {
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Fetch proposal
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return c.json({ error: 'Proposal not found' }, 404)
  }

  if (proposal.status !== 'voting') {
    return c.json({ error: `Cannot finalize proposal with status '${proposal.status}'` }, 400)
  }

  // Check if voting period has ended
  const now = new Date()
  const votingEndAt = new Date(proposal.voting_end_at)

  if (now < votingEndAt) {
    const remainingMs = votingEndAt.getTime() - now.getTime()
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60))
    return c.json(
      {
        error: 'Voting period has not ended yet',
        voting_end_at: proposal.voting_end_at,
        remaining_hours: remainingHours,
      },
      400
    )
  }

  try {
    const result = await finalizeProposal(supabase, proposal, c.env.SOLANA_RPC_URL)
    return c.json({
      ...result.proposal,
      finalization_details: result.details,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to finalize proposal'
    // Supply-related errors should return 503 (retry later)
    if (message.includes('token supply unavailable') || message.includes('RPC not configured')) {
      return c.json({ error: message }, 503)
    }
    console.error('Finalize proposal error:', err)
    return c.json({ error: message }, 500)
  }
})

// PATCH /governance/proposals/:id/execute - Mark passed proposal as executed (admin only)
governanceRoutes.patch('/proposals/:id/execute', async (c) => {
  const wallet = c.get('wallet')
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Check admin role
  const { data: adminRole, error: roleError } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('wallet_address', wallet)
    .eq('is_active', true)
    .single()

  if (roleError || !adminRole || !['admin', 'super_admin'].includes(adminRole.role)) {
    return c.json({ error: 'Admin access required' }, 403)
  }

  // Fetch proposal
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return c.json({ error: 'Proposal not found' }, 404)
  }

  if (proposal.status !== 'passed') {
    return c.json({ error: `Cannot execute proposal with status '${proposal.status}'` }, 400)
  }

  const body = await c.req.json().catch(() => ({}))
  const executionNotes = body?.execution_notes || null

  const now = new Date()
  const { data: updated, error: updateError } = await supabase
    .from('proposals')
    .update({
      status: 'executed',
      executed_at: now.toISOString(),
      executed_by: wallet,
      execution_notes: executionNotes,
      updated_at: now.toISOString(),
    })
    .eq('id', proposalId)
    .select()
    .single()

  if (updateError) {
    console.error('Execute proposal error:', updateError)
    return c.json({ error: 'Failed to execute proposal' }, 500)
  }

  return c.json(updated)
})

// PATCH /governance/proposals/:id/cancel - Cancel proposal
governanceRoutes.patch('/proposals/:id/cancel', async (c) => {
  const wallet = c.get('wallet')
  const proposalId = c.req.param('id')
  if (!UUID_REGEX.test(proposalId)) {
    return c.json({ error: 'Invalid proposal ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = cancelProposalSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  // Verify signature
  const isSignatureValid = verifySignature(parsed.data.message, parsed.data.signature, wallet)

  if (!isSignatureValid) {
    return c.json({ error: 'Invalid signature' }, 403)
  }

  // Verify message intent
  try {
    const messageData = JSON.parse(parsed.data.message)
    if (messageData.action !== 'cancel' || messageData.proposal_id !== proposalId) {
      return c.json({ error: 'Signature message mismatch' }, 403)
    }
    if (messageData.domain !== 'guardianclaw.org') {
      return c.json({ error: 'Invalid domain signature' }, 403)
    }
  } catch (e) {
    return c.json({ error: 'Invalid message format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Fetch proposal and verify ownership
  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (fetchError || !proposal) {
    return c.json({ error: 'Proposal not found' }, 404)
  }

  if (proposal.author_wallet !== wallet) {
    return c.json({ error: 'Only the proposal author can cancel it' }, 403)
  }

  // Cannot cancel if already finalized
  const finalStatuses = ['passed', 'rejected', 'executed', 'no_quorum', 'cancelled']
  if (finalStatuses.includes(proposal.status)) {
    return c.json({ error: `Cannot cancel proposal with status '${proposal.status}'` }, 400)
  }

  // Update proposal status to cancelled
  const now = new Date()
  const { data: updated, error: updateError } = await supabase
    .from('proposals')
    .update({
      status: 'cancelled',
      updated_at: now.toISOString(),
    })
    .eq('id', proposalId)
    .select()
    .single()

  if (updateError) {
    console.error('Cancel proposal error:', updateError)
    return c.json({ error: 'Failed to cancel proposal' }, 500)
  }

  return c.json(updated)
})

export default governanceRoutes
