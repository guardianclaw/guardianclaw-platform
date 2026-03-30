/**
 * Admin Governance Service
 * Administrative functions for governance monitoring and moderation
 *
 * Provides platform-wide governance statistics, proposal listing,
 * visibility moderation, and vote analysis.
 *
 * Pattern: Uses RPC functions exclusively (consistent with admin-agents.ts)
 */

import { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface GovernanceStats {
  total_proposals: number
  active_proposals: number
  hidden_proposals: number
  passed_proposals: number
  rejected_proposals: number
  unique_voters: number
  total_votes: number
  total_comments: number
  proposals_7d: number
  proposals_30d: number
  votes_7d: number
  participation_rate: number
  by_status: Record<string, number>
  by_type: Record<string, number>
}

export interface ProposalListItem {
  id: string
  number: number
  title: string
  type: string
  status: string
  author_wallet: string
  author_name: string | null
  is_hidden: boolean
  hidden_at: string | null
  hidden_reason: string | null
  votes_for: number
  votes_against: number
  comments_count: number
  created_at: string
  voting_end_at: string | null
}

export interface ProposalDetails {
  id: string
  number: number
  title: string
  body: string
  type: string
  status: string
  author_wallet: string
  author_name: string | null
  is_hidden: boolean
  hidden_at: string | null
  hidden_by: string | null
  hidden_reason: string | null
  votes_for: number
  votes_against: number
  quorum_required: number
  majority_required: number
  comments_count: number
  discussion_end_at: string | null
  voting_start_at: string | null
  voting_end_at: string | null
  created_at: string
  updated_at: string | null
}

export interface VoteSummary {
  wallet_address: string
  display_name: string | null
  vote_direction: string
  voting_power: number
  created_at: string
}

export interface ProposalListFilters {
  status?: string
  type?: string
  hidden?: boolean
  search?: string
  orderBy?: 'number' | 'created_at' | 'votes'
  orderDir?: 'asc' | 'desc'
}

export interface ToggleVisibilityResult {
  success: boolean
  is_hidden: boolean
  hidden_at: string | null
  error?: string
}

// ============================================
// SERVICE FUNCTIONS
// ============================================

/**
 * Get platform-wide governance statistics
 */
export async function getGovernanceStats(supabase: SupabaseClient): Promise<GovernanceStats> {
  const { data, error } = await supabase.rpc('admin_get_governance_stats')

  if (error) {
    console.error('Failed to get governance stats:', error)
    throw new Error('Failed to get governance statistics')
  }

  if (!data || data.length === 0) {
    return {
      total_proposals: 0,
      active_proposals: 0,
      hidden_proposals: 0,
      passed_proposals: 0,
      rejected_proposals: 0,
      unique_voters: 0,
      total_votes: 0,
      total_comments: 0,
      proposals_7d: 0,
      proposals_30d: 0,
      votes_7d: 0,
      participation_rate: 0,
      by_status: {},
      by_type: {},
    }
  }

  const row = data[0]
  return {
    total_proposals: Number(row.total_proposals) || 0,
    active_proposals: Number(row.active_proposals) || 0,
    hidden_proposals: Number(row.hidden_proposals) || 0,
    passed_proposals: Number(row.passed_proposals) || 0,
    rejected_proposals: Number(row.rejected_proposals) || 0,
    unique_voters: Number(row.unique_voters) || 0,
    total_votes: Number(row.total_votes) || 0,
    total_comments: Number(row.total_comments) || 0,
    proposals_7d: Number(row.proposals_7d) || 0,
    proposals_30d: Number(row.proposals_30d) || 0,
    votes_7d: Number(row.votes_7d) || 0,
    participation_rate: Number(row.participation_rate) || 0,
    by_status: row.by_status || {},
    by_type: row.by_type || {},
  }
}

/**
 * List proposals with pagination and filters
 */
export async function listProposals(
  supabase: SupabaseClient,
  limit: number,
  offset: number,
  filters: ProposalListFilters = {}
): Promise<{ proposals: ProposalListItem[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_list_proposals', {
    p_limit: limit,
    p_offset: offset,
    p_status: filters.status || null,
    p_type: filters.type || null,
    p_hidden: filters.hidden ?? null,
    p_search: filters.search || null,
    p_order_by: filters.orderBy || 'created_at',
    p_order_dir: filters.orderDir || 'desc',
  })

  if (error) {
    console.error('Failed to list proposals:', error)
    throw new Error('Failed to list proposals')
  }

  if (!data || data.length === 0) {
    return { proposals: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const proposals: ProposalListItem[] = data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    number: Number(row.number) || 0,
    title: row.title as string,
    type: row.type as string,
    status: row.status as string,
    author_wallet: row.author_wallet as string,
    author_name: row.author_name as string | null,
    is_hidden: row.is_hidden as boolean,
    hidden_at: row.hidden_at as string | null,
    hidden_reason: row.hidden_reason as string | null,
    votes_for: Number(row.votes_for) || 0,
    votes_against: Number(row.votes_against) || 0,
    comments_count: Number(row.comments_count) || 0,
    created_at: row.created_at as string,
    voting_end_at: row.voting_end_at as string | null,
  }))

  return { proposals, total }
}

/**
 * Get full proposal details
 */
export async function getProposalDetails(
  supabase: SupabaseClient,
  proposalId: string
): Promise<ProposalDetails | null> {
  const { data, error } = await supabase.rpc('admin_get_proposal_details', {
    p_proposal_id: proposalId,
  })

  if (error) {
    console.error('Failed to get proposal details:', error)
    throw new Error('Failed to get proposal details')
  }

  if (!data || data.length === 0) {
    return null
  }

  const row = data[0]
  return {
    id: row.id,
    number: Number(row.number) || 0,
    title: row.title,
    body: row.body,
    type: row.type,
    status: row.status,
    author_wallet: row.author_wallet,
    author_name: row.author_name,
    is_hidden: row.is_hidden,
    hidden_at: row.hidden_at,
    hidden_by: row.hidden_by,
    hidden_reason: row.hidden_reason,
    votes_for: Number(row.votes_for) || 0,
    votes_against: Number(row.votes_against) || 0,
    quorum_required: Number(row.quorum_required) || 0,
    majority_required: Number(row.majority_required) || 0,
    comments_count: Number(row.comments_count) || 0,
    discussion_end_at: row.discussion_end_at,
    voting_start_at: row.voting_start_at,
    voting_end_at: row.voting_end_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Get votes for a proposal
 */
export async function getProposalVotes(
  supabase: SupabaseClient,
  proposalId: string,
  limit: number,
  offset: number
): Promise<{ votes: VoteSummary[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_proposal_votes', {
    p_proposal_id: proposalId,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('Failed to get proposal votes:', error)
    throw new Error('Failed to get proposal votes')
  }

  if (!data || data.length === 0) {
    return { votes: [], total: 0 }
  }

  const total = Number(data[0].total_count) || 0

  const votes: VoteSummary[] = data.map((row: Record<string, unknown>) => ({
    wallet_address: row.wallet_address as string,
    display_name: row.display_name as string | null,
    vote_direction: row.vote_direction as string,
    voting_power: Number(row.voting_power) || 0,
    created_at: row.created_at as string,
  }))

  return { votes, total }
}

/**
 * Toggle proposal visibility (hide/show)
 */
export async function toggleProposalVisibility(
  supabase: SupabaseClient,
  proposalId: string,
  hidden: boolean,
  reason: string | null,
  adminHash: string
): Promise<ToggleVisibilityResult> {
  const { data, error } = await supabase.rpc('admin_toggle_proposal_visibility', {
    p_proposal_id: proposalId,
    p_hidden: hidden,
    p_reason: reason || null,
    p_admin_hash: adminHash,
  })

  if (error) {
    console.error('Failed to toggle proposal visibility:', error)
    return {
      success: false,
      is_hidden: false,
      hidden_at: null,
      error: 'DATABASE_ERROR',
    }
  }

  if (!data || data.length === 0) {
    return {
      success: false,
      is_hidden: false,
      hidden_at: null,
      error: 'NO_RESULT',
    }
  }

  const row = data[0]

  if (!row.success) {
    return {
      success: false,
      is_hidden: false,
      hidden_at: null,
      error: row.error || 'UNKNOWN_ERROR',
    }
  }

  return {
    success: true,
    is_hidden: row.is_hidden,
    hidden_at: row.hidden_at,
  }
}

/**
 * Get available proposal statuses for filtering
 */
export function getAvailableStatuses(): string[] {
  return [
    'draft',
    'discussion',
    'voting',
    'passed',
    'rejected',
    'executed',
    'cancelled',
    'no_quorum',
  ]
}

/**
 * Get available proposal types for filtering
 */
export function getAvailableTypes(): string[] {
  return ['feature', 'governance', 'seed', 'docs', 'partnership', 'meta']
}
