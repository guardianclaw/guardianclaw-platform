/**
 * Admin Credits Service
 * Administrative functions for credit management
 *
 * Provides platform-wide credit statistics, user credit details,
 * manual adjustments, and user status management.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { COST_PER_EXECUTION } from './credits'

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface PlatformCreditsStats {
  total_balance: number
  total_deposited: number
  total_spent: number
  total_adjustments: number
  active_accounts: number
  zero_balance_accounts: number
  low_balance_accounts: number
  avg_balance: number
  deposits_24h: number
  deposits_7d: number
  deposits_30d: number
  revenue_24h: number
  revenue_7d: number
  revenue_30d: number
}

export interface UserCreditsDetails {
  balance_usd: number
  total_deposited: number
  total_spent: number
  executions_remaining: number
  deposits_count: number
  adjustments_count: number
  first_deposit_at: string | null
  last_deposit_at: string | null
  last_usage_at: string | null
  created_at: string | null
}

export interface CreditAdjustment {
  id: string
  wallet_address: string
  display_name: string | null
  amount: number
  type: AdjustmentType
  reason: string
  admin_wallet_hash: string
  reference_id: string | null
  reference_type: ReferenceType | null
  balance_before: number
  balance_after: number
  created_at: string
}

export interface DepositRecord {
  id: string
  wallet_address: string
  display_name: string | null
  token: string
  amount: number
  price_usd: number | null
  credits_usd: number
  bonus_applied: number
  tx_signature: string
  status: string
  created_at: string
}

export interface LowBalanceUser {
  wallet_address: string
  display_name: string | null
  balance_usd: number
  executions_remaining: number
  last_deposit_at: string | null
  total_spent: number
}

export interface UserNote {
  id: string
  wallet_address: string
  note: string
  category: NoteCategory
  admin_wallet_hash: string
  is_pinned: boolean
  created_at: string
  updated_at: string
}

export type AdjustmentType = 'refund' | 'courtesy' | 'correction' | 'bonus' | 'penalty'
export type ReferenceType = 'ticket' | 'deposit' | 'agent_event' | 'other'
export type NoteCategory = 'general' | 'support' | 'billing' | 'security' | 'compliance'

export interface AdjustCreditsParams {
  walletAddress: string
  amount: number
  type: AdjustmentType
  reason: string
  adminHash: string
  referenceId?: string
  referenceType?: ReferenceType
}

export interface AdjustCreditsResult {
  success: boolean
  new_balance: number
  adjustment_id: string | null
  error?: string
}

export interface SetUserStatusResult {
  success: boolean
  previous_status: string | null
  new_status: string | null
  error?: string
}

export interface DepositsFilter {
  status?: string
  token?: string
  startDate?: Date
  endDate?: Date
}

export interface AdjustmentsFilter {
  type?: AdjustmentType
  startDate?: Date
  endDate?: Date
}

// ============================================
// PLATFORM STATISTICS
// ============================================

/**
 * Get platform-wide credit statistics for admin dashboard
 */
export async function getPlatformCreditsStats(
  supabase: SupabaseClient
): Promise<PlatformCreditsStats> {
  const { data, error } = await supabase.rpc('admin_get_credits_stats')

  if (error) {
    console.error('Failed to get platform credits stats:', error)
    throw new Error('Failed to get platform credits statistics')
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    total_balance: Number(row?.total_balance ?? 0),
    total_deposited: Number(row?.total_deposited ?? 0),
    total_spent: Number(row?.total_spent ?? 0),
    total_adjustments: Number(row?.total_adjustments ?? 0),
    active_accounts: Number(row?.active_accounts ?? 0),
    zero_balance_accounts: Number(row?.zero_balance_accounts ?? 0),
    low_balance_accounts: Number(row?.low_balance_accounts ?? 0),
    avg_balance: Number(row?.avg_balance ?? 0),
    deposits_24h: Number(row?.deposits_24h ?? 0),
    deposits_7d: Number(row?.deposits_7d ?? 0),
    deposits_30d: Number(row?.deposits_30d ?? 0),
    revenue_24h: Number(row?.revenue_24h ?? 0),
    revenue_7d: Number(row?.revenue_7d ?? 0),
    revenue_30d: Number(row?.revenue_30d ?? 0),
  }
}

// ============================================
// USER CREDIT DETAILS
// ============================================

/**
 * Get detailed credit information for a specific user
 */
export async function getUserCreditsDetails(
  supabase: SupabaseClient,
  walletAddress: string
): Promise<UserCreditsDetails> {
  const { data, error } = await supabase.rpc('admin_get_user_credits', {
    p_wallet_address: walletAddress,
  })

  if (error) {
    console.error('Failed to get user credits details:', error)
    throw new Error('Failed to get user credits details')
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    balance_usd: Number(row?.balance_usd ?? 0),
    total_deposited: Number(row?.total_deposited ?? 0),
    total_spent: Number(row?.total_spent ?? 0),
    executions_remaining: Number(row?.executions_remaining ?? 0),
    deposits_count: Number(row?.deposits_count ?? 0),
    adjustments_count: Number(row?.adjustments_count ?? 0),
    first_deposit_at: row?.first_deposit_at || null,
    last_deposit_at: row?.last_deposit_at || null,
    last_usage_at: row?.last_usage_at || null,
    created_at: row?.created_at || null,
  }
}

/**
 * Get user's deposit history
 */
export async function getUserDeposits(
  supabase: SupabaseClient,
  walletAddress: string,
  limit: number = 20,
  offset: number = 0
): Promise<DepositRecord[]> {
  const { data, error } = await supabase
    .from('deposits')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to get user deposits:', error)
    return []
  }

  return (data || []).map((d) => ({
    id: d.id,
    wallet_address: d.wallet_address,
    display_name: null,
    token: d.token,
    amount: Number(d.amount),
    price_usd: d.price_usd ? Number(d.price_usd) : null,
    credits_usd: Number(d.credits_usd),
    bonus_applied: Number(d.bonus_applied),
    tx_signature: d.tx_signature,
    status: d.status,
    created_at: d.created_at,
  }))
}

/**
 * Get user's credit adjustment history
 */
export async function getUserAdjustments(
  supabase: SupabaseClient,
  walletAddress: string,
  limit: number = 20,
  offset: number = 0
): Promise<CreditAdjustment[]> {
  const { data, error } = await supabase
    .from('credit_adjustments')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to get user adjustments:', error)
    return []
  }

  return (data || []).map((a) => ({
    id: a.id,
    wallet_address: a.wallet_address,
    display_name: null,
    amount: Number(a.amount),
    type: a.type as AdjustmentType,
    reason: a.reason,
    admin_wallet_hash: a.admin_wallet_hash,
    reference_id: a.reference_id,
    reference_type: a.reference_type as ReferenceType | null,
    balance_before: Number(a.balance_before),
    balance_after: Number(a.balance_after),
    created_at: a.created_at,
  }))
}

// ============================================
// CREDIT ADJUSTMENTS
// ============================================

/**
 * Adjust credits for a user (refund, courtesy, correction, etc.)
 */
export async function adjustCredits(
  supabase: SupabaseClient,
  params: AdjustCreditsParams
): Promise<AdjustCreditsResult> {
  const { data, error } = await supabase.rpc('admin_adjust_credits', {
    p_wallet_address: params.walletAddress,
    p_amount: params.amount,
    p_type: params.type,
    p_reason: params.reason,
    p_admin_hash: params.adminHash,
    p_reference_id: params.referenceId || null,
    p_reference_type: params.referenceType || null,
  })

  if (error) {
    console.error('Failed to adjust credits:', error)
    return {
      success: false,
      new_balance: 0,
      adjustment_id: null,
      error: 'DATABASE_ERROR',
    }
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    success: row?.success ?? false,
    new_balance: Number(row?.new_balance ?? 0),
    adjustment_id: row?.adjustment_id || null,
    error: row?.error || undefined,
  }
}

// ============================================
// LOW BALANCE USERS
// ============================================

/**
 * Get users with low credit balance (for proactive support)
 */
export async function getLowBalanceUsers(
  supabase: SupabaseClient,
  threshold: number = 0.3,
  limit: number = 50,
  offset: number = 0
): Promise<LowBalanceUser[]> {
  const { data, error } = await supabase.rpc('admin_get_low_balance_users', {
    p_threshold: threshold,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('Failed to get low balance users:', error)
    return []
  }

  return (data || []).map((u: Record<string, unknown>) => ({
    wallet_address: u.wallet_address as string,
    display_name: u.display_name as string | null,
    balance_usd: Number(u.balance_usd ?? 0),
    executions_remaining: Number(u.executions_remaining ?? 0),
    last_deposit_at: u.last_deposit_at as string | null,
    total_spent: Number(u.total_spent ?? 0),
  }))
}

// ============================================
// USER STATUS MANAGEMENT
// ============================================

/**
 * Suspend or unsuspend a user account
 */
export async function setUserStatus(
  supabase: SupabaseClient,
  walletAddress: string,
  status: 'active' | 'suspended',
  adminHash: string,
  reason?: string
): Promise<SetUserStatusResult> {
  const { data, error } = await supabase.rpc('admin_set_user_status', {
    p_wallet_address: walletAddress,
    p_status: status,
    p_admin_hash: adminHash,
    p_reason: reason || null,
  })

  if (error) {
    console.error('Failed to set user status:', error)
    return {
      success: false,
      previous_status: null,
      new_status: null,
      error: 'DATABASE_ERROR',
    }
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    success: row?.success ?? false,
    previous_status: row?.previous_status || null,
    new_status: row?.new_status || null,
    error: row?.error || undefined,
  }
}

// ============================================
// ALL DEPOSITS (PLATFORM-WIDE)
// ============================================

/**
 * Get all deposits across the platform (with filters)
 */
export async function getAllDeposits(
  supabase: SupabaseClient,
  limit: number = 50,
  offset: number = 0,
  filters?: DepositsFilter
): Promise<{ deposits: DepositRecord[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_all_deposits', {
    p_limit: limit,
    p_offset: offset,
    p_status: filters?.status || null,
    p_token: filters?.token || null,
    p_start_date: filters?.startDate?.toISOString() || null,
    p_end_date: filters?.endDate?.toISOString() || null,
  })

  if (error) {
    console.error('Failed to get all deposits:', error)
    return { deposits: [], total: 0 }
  }

  const deposits = (data || []).map((d: Record<string, unknown>) => ({
    id: d.id as string,
    wallet_address: d.wallet_address as string,
    display_name: d.display_name as string | null,
    token: d.token as string,
    amount: Number(d.amount ?? 0),
    price_usd: d.price_usd ? Number(d.price_usd) : null,
    credits_usd: Number(d.credits_usd ?? 0),
    bonus_applied: Number(d.bonus_applied ?? 1),
    tx_signature: d.tx_signature as string,
    status: d.status as string,
    created_at: d.created_at as string,
  }))

  // Get total count (separate query for efficiency)
  const { count } = await supabase.from('deposits').select('*', { count: 'exact', head: true })

  return { deposits, total: count || 0 }
}

/**
 * Get all credit adjustments across the platform
 */
export async function getAllAdjustments(
  supabase: SupabaseClient,
  limit: number = 50,
  offset: number = 0,
  filters?: AdjustmentsFilter
): Promise<{ adjustments: CreditAdjustment[]; total: number }> {
  const { data, error } = await supabase.rpc('admin_get_all_adjustments', {
    p_limit: limit,
    p_offset: offset,
    p_type: filters?.type || null,
    p_start_date: filters?.startDate?.toISOString() || null,
    p_end_date: filters?.endDate?.toISOString() || null,
  })

  if (error) {
    console.error('Failed to get all adjustments:', error)
    return { adjustments: [], total: 0 }
  }

  const adjustments = (data || []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    wallet_address: a.wallet_address as string,
    display_name: a.display_name as string | null,
    amount: Number(a.amount ?? 0),
    type: a.type as AdjustmentType,
    reason: a.reason as string,
    admin_wallet_hash: a.admin_wallet_hash as string,
    reference_id: a.reference_id as string | null,
    reference_type: a.reference_type as ReferenceType | null,
    balance_before: Number(a.balance_before ?? 0),
    balance_after: Number(a.balance_after ?? 0),
    created_at: a.created_at as string,
  }))

  // Get total count
  const { count } = await supabase
    .from('credit_adjustments')
    .select('*', { count: 'exact', head: true })

  return { adjustments, total: count || 0 }
}

// ============================================
// USER NOTES
// ============================================

/**
 * Get notes for a user
 */
export async function getUserNotes(
  supabase: SupabaseClient,
  walletAddress: string,
  limit: number = 20,
  offset: number = 0
): Promise<UserNote[]> {
  const { data, error } = await supabase
    .from('user_notes')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Failed to get user notes:', error)
    return []
  }

  return (data || []).map((n) => ({
    id: n.id,
    wallet_address: n.wallet_address,
    note: n.note,
    category: n.category as NoteCategory,
    admin_wallet_hash: n.admin_wallet_hash,
    is_pinned: n.is_pinned,
    created_at: n.created_at,
    updated_at: n.updated_at,
  }))
}

/**
 * Add a note to a user
 */
export async function addUserNote(
  supabase: SupabaseClient,
  walletAddress: string,
  note: string,
  adminHash: string,
  category: NoteCategory = 'general'
): Promise<UserNote | null> {
  const { data, error } = await supabase
    .from('user_notes')
    .insert({
      wallet_address: walletAddress,
      note,
      category,
      admin_wallet_hash: adminHash,
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to add user note:', error)
    return null
  }

  return {
    id: data.id,
    wallet_address: data.wallet_address,
    note: data.note,
    category: data.category as NoteCategory,
    admin_wallet_hash: data.admin_wallet_hash,
    is_pinned: data.is_pinned,
    created_at: data.created_at,
    updated_at: data.updated_at,
  }
}

/**
 * Delete a user note
 */
export async function deleteUserNote(supabase: SupabaseClient, noteId: string): Promise<boolean> {
  const { error } = await supabase.from('user_notes').delete().eq('id', noteId)

  if (error) {
    console.error('Failed to delete user note:', error)
    return false
  }

  return true
}

/**
 * Toggle pin status of a note
 */
export async function toggleNotePin(
  supabase: SupabaseClient,
  noteId: string,
  isPinned: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('user_notes')
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq('id', noteId)

  if (error) {
    console.error('Failed to toggle note pin:', error)
    return false
  }

  return true
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Calculate executions remaining from balance
 */
export function calculateExecutionsRemaining(balanceUsd: number): number {
  return Math.floor(balanceUsd / COST_PER_EXECUTION)
}

/**
 * Get balance warning level
 */
export function getBalanceWarningLevel(
  balanceUsd: number
): 'critical' | 'low' | 'normal' | 'healthy' {
  const executions = calculateExecutionsRemaining(balanceUsd)
  if (executions < 10) return 'critical'
  if (executions < 100) return 'low'
  if (executions < 1000) return 'normal'
  return 'healthy'
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, decimals: number = 4): string {
  return `$${amount.toFixed(decimals)}`
}
