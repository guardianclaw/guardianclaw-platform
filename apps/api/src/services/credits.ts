/**
 * Credits Service
 * Pay-per-use credit system for GuardianClaw Platform
 *
 * Pricing: $0.003 per agent execution
 * Minimum deposit: $3.00 (~1000 executions)
 * Bonus: 20% extra credits when paying with $GCLAW
 */

import { SupabaseClient } from '@supabase/supabase-js'

// Pricing constants
export const COST_PER_EXECUTION = 0.003 // $0.003 per execution
export const COST_PER_EXECUTION_BYOK = 0.001 // $0.001 per execution — covers infra only
export const GCLAW_BONUS = 1.2 // 20% bonus for $GCLAW payments
export const MIN_DEPOSIT_USD = 3.0 // Minimum deposit ~1000 executions

// Token configuration
export const TOKEN_MINTS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  GCLAW: '', // Set when $GCLAW token is deployed
} as const

export const TOKEN_DECIMALS = {
  SOL: 9,
  USDC: 6,
  GCLAW: 6,
} as const

export type PaymentToken = 'SOL' | 'USDC' | 'GCLAW'

// Type definitions
export interface CreditBalance {
  balance_usd: number
  total_deposited: number
  total_spent: number
  executions_remaining: number
}

export interface DeductResult {
  success: boolean
  balance_before: number
  new_balance: number
  error?: string
}

export interface DepositRecord {
  id: string
  wallet_address: string
  token: PaymentToken
  amount: number
  price_usd: number | null
  credits_usd: number
  bonus_applied: number
  tx_signature: string
  status: 'pending' | 'confirmed' | 'failed'
  created_at: string
}

export interface UsageHistoryEntry {
  id: string
  agent_id: string
  cost_usd: number
  balance_after: number
  event_type: string
  created_at: string
}

/**
 * Get credit balance and summary for a wallet
 */
export async function getBalance(
  supabase: SupabaseClient,
  walletAddress: string
): Promise<CreditBalance> {
  const { data, error } = await supabase.rpc('get_credits_summary', {
    p_wallet_address: walletAddress,
  })

  if (error) {
    console.error('Failed to get credits summary:', error)
    // Return zeros on error (new user)
    return {
      balance_usd: 0,
      total_deposited: 0,
      total_spent: 0,
      executions_remaining: 0,
    }
  }

  // RPC returns array with single row
  const row = Array.isArray(data) ? data[0] : data

  return {
    balance_usd: Number(row?.balance_usd ?? 0),
    total_deposited: Number(row?.total_deposited ?? 0),
    total_spent: Number(row?.total_spent ?? 0),
    executions_remaining: Number(row?.executions_remaining ?? 0),
  }
}

/**
 * Deduct credits atomically
 * Uses database-level locking to prevent race conditions.
 * balance_before is now returned from the locked row inside the RPC,
 * so we don't need a separate getBalance() call (which was racy).
 */
export async function deductCredits(
  supabase: SupabaseClient,
  walletAddress: string,
  amount: number = COST_PER_EXECUTION
): Promise<DeductResult> {
  const { data, error } = await supabase.rpc('deduct_credits', {
    p_wallet_address: walletAddress,
    p_amount: amount,
  })

  if (error) {
    console.error('Failed to deduct credits:', error)
    return {
      success: false,
      balance_before: 0,
      new_balance: 0,
      error: 'DATABASE_ERROR',
    }
  }

  // RPC returns array with single row
  const row = Array.isArray(data) ? data[0] : data

  return {
    success: row?.success ?? false,
    balance_before: Number(row?.balance_before ?? 0),
    new_balance: Number(row?.new_balance ?? 0),
    error: row?.error || undefined,
  }
}

/**
 * Process deposit atomically: insert deposit record + add credits in a single
 * database transaction. Handles duplicate tx_signature via unique constraint.
 */
export interface ProcessDepositParams {
  walletAddress: string
  token: PaymentToken
  amount: number
  priceUsd: number | null
  creditsUsd: number
  bonusApplied: number
  txSignature: string
}

export interface ProcessDepositResult {
  success: boolean
  depositId?: string
  newBalance: number
  error?: string
}

export async function processDeposit(
  supabase: SupabaseClient,
  params: ProcessDepositParams
): Promise<ProcessDepositResult> {
  const { data, error } = await supabase.rpc('process_deposit', {
    p_wallet_address: params.walletAddress,
    p_token: params.token,
    p_amount: params.amount,
    p_price_usd: params.priceUsd,
    p_credits_usd: params.creditsUsd,
    p_bonus_applied: params.bonusApplied,
    p_tx_signature: params.txSignature,
  })

  if (error) {
    console.error('Failed to process deposit:', error)
    return { success: false, newBalance: 0, error: 'DATABASE_ERROR' }
  }

  const row = Array.isArray(data) ? data[0] : data

  return {
    success: row?.success ?? false,
    depositId: row?.deposit_id || undefined,
    newBalance: Number(row?.new_balance ?? 0),
    error: row?.error || undefined,
  }
}

/**
 * Add credits after a confirmed deposit
 */
export async function addCredits(
  supabase: SupabaseClient,
  walletAddress: string,
  amount: number
): Promise<number> {
  const { data, error } = await supabase.rpc('add_credits', {
    p_wallet_address: walletAddress,
    p_amount: amount,
  })

  if (error) {
    console.error('Failed to add credits:', error)
    throw new Error('Failed to add credits')
  }

  return Number(data ?? 0)
}

/**
 * Refund credits after a failed execution.
 * Uses add_credits RPC to return the amount.
 */
export async function refundCredits(
  supabase: SupabaseClient,
  walletAddress: string,
  amount: number,
  reason: string
): Promise<{ success: boolean; new_balance: number }> {
  try {
    const newBalance = await addCredits(supabase, walletAddress, amount)

    // Log refund event for monitoring
    console.warn(
      JSON.stringify({
        level: 'warn',
        event: 'credit_refund',
        wallet: walletAddress,
        amount,
        reason,
        new_balance: newBalance,
      })
    )

    return { success: true, new_balance: newBalance }
  } catch (err) {
    console.error('Failed to refund credits:', err)
    return { success: false, new_balance: 0 }
  }
}

/**
 * Initialize credits account for new user (idempotent)
 */
export async function initCreditsAccount(
  supabase: SupabaseClient,
  walletAddress: string
): Promise<boolean> {
  const { error } = await supabase.rpc('init_user_credits', {
    p_wallet_address: walletAddress,
  })

  if (error) {
    console.error('Failed to init credits account:', error)
    return false
  }

  return true
}

/**
 * Check if wallet has sufficient balance for execution
 */
export async function checkSufficientBalance(
  supabase: SupabaseClient,
  walletAddress: string,
  amount: number = COST_PER_EXECUTION
): Promise<{ sufficient: boolean; balance: number; required: number }> {
  const balance = await getBalance(supabase, walletAddress)

  return {
    sufficient: balance.balance_usd >= amount,
    balance: balance.balance_usd,
    required: amount,
  }
}

/**
 * Record a deposit in the database
 */
export async function recordDeposit(
  supabase: SupabaseClient,
  params: {
    walletAddress: string
    token: PaymentToken
    amount: number
    priceUsd: number | null
    creditsUsd: number
    bonusApplied: number
    txSignature: string
  }
): Promise<DepositRecord> {
  const { data, error } = await supabase
    .from('deposits')
    .insert({
      wallet_address: params.walletAddress,
      token: params.token,
      amount: params.amount,
      price_usd: params.priceUsd,
      credits_usd: params.creditsUsd,
      bonus_applied: params.bonusApplied,
      tx_signature: params.txSignature,
      status: 'confirmed',
    })
    .select()
    .single()

  if (error) {
    console.error('Failed to record deposit:', error)
    throw new Error('Failed to record deposit')
  }

  return data as DepositRecord
}

/**
 * Get deposit history for a wallet
 */
export async function getDepositHistory(
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
    console.error('Failed to get deposit history:', error)
    return []
  }

  return (data || []) as DepositRecord[]
}

/**
 * Get usage history (credits spent on executions)
 */
export async function getUsageHistory(
  supabase: SupabaseClient,
  walletAddress: string,
  limit: number = 50,
  offset: number = 0
): Promise<UsageHistoryEntry[]> {
  const { data, error } = await supabase.rpc('get_credits_usage_history', {
    p_wallet_address: walletAddress,
    p_limit: limit,
    p_offset: offset,
  })

  if (error) {
    console.error('Failed to get usage history:', error)
    return []
  }

  return (data || []) as UsageHistoryEntry[]
}

/**
 * Check if a transaction signature has been used before
 */
export async function isTransactionUsed(
  supabase: SupabaseClient,
  txSignature: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('deposits')
    .select('id')
    .eq('tx_signature', txSignature)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Failed to check transaction:', error)
  }

  return !!data
}

/**
 * Calculate credits from deposit amount
 * Applies 20% bonus for $GCLAW payments
 */
export function calculateCredits(
  token: PaymentToken,
  tokenAmount: number,
  tokenPriceUsd: number
): { creditsUsd: number; bonus: number } {
  const baseCredits = tokenAmount * tokenPriceUsd

  if (token === 'GCLAW') {
    return {
      creditsUsd: baseCredits * GCLAW_BONUS,
      bonus: GCLAW_BONUS,
    }
  }

  return {
    creditsUsd: baseCredits,
    bonus: 1.0,
  }
}

/**
 * Validate minimum deposit amount
 */
export function validateMinimumDeposit(creditsUsd: number): {
  valid: boolean
  minimum: number
  provided: number
} {
  return {
    valid: creditsUsd >= MIN_DEPOSIT_USD,
    minimum: MIN_DEPOSIT_USD,
    provided: creditsUsd,
  }
}

/**
 * Parse SOL transfer from Solana transaction
 */
export interface SolTransferInfo {
  source: string
  destination: string
  lamports: number
}

export function parseSolTransfer(
  instructions: Array<{
    program?: string
    programId?: string
    parsed?: {
      type?: string
      info?: {
        source?: string
        destination?: string
        lamports?: number
      }
    }
  }>
): SolTransferInfo | null {
  for (const ix of instructions) {
    const programId = ix.programId || ix.program
    if (programId !== '11111111111111111111111111111111') continue

    const parsed = ix.parsed
    if (!parsed || parsed.type !== 'transfer') continue

    const info = parsed.info
    if (!info || !info.source || !info.destination || !info.lamports) continue

    return {
      source: info.source,
      destination: info.destination,
      lamports: info.lamports,
    }
  }

  return null
}

/**
 * Parse SPL token transfer from Solana transaction
 */
export interface TokenTransferInfo {
  mint: string
  source: string
  destination: string
  amount: number
  authority: string
}

export function parseTokenTransfer(
  instructions: Array<{
    program?: string
    programId?: string
    parsed?: {
      type?: string
      info?: {
        mint?: string
        source?: string
        destination?: string
        tokenAmount?: { amount?: string; uiAmount?: number }
        authority?: string
        amount?: string
      }
    }
  }>
): TokenTransferInfo | null {
  for (const ix of instructions) {
    const programId = ix.programId || ix.program
    // Accept both standard SPL Token and Token-2022 programs
    const isTokenProgram =
      programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ||
      programId === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' ||
      programId === 'spl-token' ||
      programId === 'spl-token-2022'
    if (!isTokenProgram) continue

    const parsed = ix.parsed
    if (!parsed || (parsed.type !== 'transferChecked' && parsed.type !== 'transfer')) continue

    const info = parsed.info
    if (!info) continue

    let amount: number
    if (info.tokenAmount?.amount) {
      amount = parseInt(info.tokenAmount.amount, 10)
    } else if (info.amount) {
      amount = parseInt(info.amount, 10)
    } else {
      continue
    }

    return {
      mint: info.mint || '',
      source: info.source || '',
      destination: info.destination || '',
      amount,
      authority: info.authority || '',
    }
  }

  return null
}

/**
 * Format balance for display
 */
export function formatBalance(balanceUsd: number): string {
  return `$${balanceUsd.toFixed(4)}`
}

/**
 * Get warning level based on remaining executions
 */
export function getBalanceWarningLevel(executionsRemaining: number): 'critical' | 'low' | 'normal' {
  if (executionsRemaining < 10) return 'critical'
  if (executionsRemaining < 100) return 'low'
  return 'normal'
}
