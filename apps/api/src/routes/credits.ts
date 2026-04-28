/**
 * Credits Routes
 * API endpoints for pay-per-use credit system
 *
 * Endpoints:
 * - GET  /credits/balance    - Get current balance and summary
 * - POST /credits/deposit    - Verify Solana tx and add credits
 * - GET  /credits/history    - Get deposit history
 * - GET  /credits/usage      - Get usage/spending history
 * - GET  /credits/pricing    - Get pricing information
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getUserClient } from '../lib/supabase-client'
import {
  getBalance,
  processDeposit,
  getDepositHistory,
  getUsageHistory,
  calculateCredits,
  validateMinimumDeposit,
  parseSolTransfer,
  parseTokenTransfer,
  getBalanceWarningLevel,
  COST_PER_EXECUTION,
  GCLAW_BONUS,
  MIN_DEPOSIT_USD,
  TOKEN_MINTS,
  TOKEN_DECIMALS,
  type PaymentToken,
} from '../services/credits'
import { getTokenPrice } from '../services/prices'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY: string
  SUPABASE_JWT_SECRET: string
  JWT_SECRET: string
  SOLANA_RPC_URL?: string
  TREASURY_WALLET?: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
}

export const creditsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Validation schemas
const depositSchema = z.object({
  tx_signature: z.string().min(80).max(100),
  token: z.enum(['SOL', 'USDC', 'GCLAW']),
  expected_amount: z.number().positive().optional(),
})

const historyQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
})

// GET /credits/pricing - Get pricing information (public)
creditsRoutes.get('/pricing', (c) => {
  return c.json({
    cost_per_execution: COST_PER_EXECUTION,
    minimum_deposit: MIN_DEPOSIT_USD,
    payment_tokens: [
      { token: 'SOL', bonus: 1.0, note: null },
      { token: 'USDC', bonus: 1.0, note: null },
      { token: 'GCLAW', bonus: GCLAW_BONUS, note: '20% bonus with $GCLAW' },
    ],
    treasury: c.env.TREASURY_WALLET || 'Not configured',
    examples: {
      '$3.00_deposit': Math.floor(3.0 / COST_PER_EXECUTION),
      '$10.00_deposit': Math.floor(10.0 / COST_PER_EXECUTION),
      '$50.00_deposit': Math.floor(50.0 / COST_PER_EXECUTION),
      '$3.00_claw_deposit': Math.floor((3.0 * GCLAW_BONUS) / COST_PER_EXECUTION),
    },
  })
})

// GET /credits/balance - Get current balance (requires auth)
creditsRoutes.get('/balance', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const wallet = c.get('wallet')
  const supabase = await getUserClient(c.env, wallet)

  const balance = await getBalance(supabase, wallet)
  const warningLevel = getBalanceWarningLevel(balance.executions_remaining)

  return c.json({
    balance_usd: balance.balance_usd,
    total_deposited: balance.total_deposited,
    total_spent: balance.total_spent,
    executions_remaining: balance.executions_remaining,
    cost_per_execution: COST_PER_EXECUTION,
    warning_level: warningLevel,
    alerts: {
      low_balance: warningLevel !== 'normal',
      message:
        warningLevel === 'critical'
          ? 'Critical: Less than 10 executions remaining'
          : warningLevel === 'low'
            ? 'Warning: Less than 100 executions remaining'
            : null,
    },
  })
})

// POST /credits/deposit - Verify Solana transaction and add credits
creditsRoutes.post('/deposit', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const wallet = c.get('wallet')

  const body = await c.req.json()
  const parsed = depositSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const { tx_signature, token } = parsed.data

  // Validate treasury wallet is configured
  const treasuryWallet = c.env.TREASURY_WALLET
  if (!treasuryWallet) {
    return c.json({ error: 'Payment system not configured' }, 503)
  }

  const supabase = await getUserClient(c.env, wallet)

  // Replay check is now handled atomically inside process_deposit RPC
  // via UNIQUE constraint on tx_signature

  // Fetch and verify transaction from Solana
  const rpcUrl = c.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'

  try {
    const txResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getTransaction',
        params: [
          tx_signature,
          {
            encoding: 'jsonParsed',
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0,
          },
        ],
      }),
    })

    interface TransactionData {
      result?: {
        meta?: {
          err: unknown
          preBalances: number[]
          postBalances: number[]
          preTokenBalances?: Array<{
            accountIndex: number
            mint: string
            owner: string
            uiTokenAmount: { amount: string; uiAmount: number }
          }>
          postTokenBalances?: Array<{
            accountIndex: number
            mint: string
            owner: string
            uiTokenAmount: { amount: string; uiAmount: number }
          }>
        }
        transaction?: {
          message?: {
            accountKeys?: Array<{ pubkey: string; signer?: boolean; writable?: boolean }>
            instructions?: Array<{
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
                  lamports?: number
                }
              }
            }>
          }
        }
        blockTime?: number
      }
      error?: { message: string }
    }

    const txData = (await txResponse.json()) as TransactionData

    if (txData.error || !txData.result) {
      return c.json(
        {
          error: 'Transaction not found or not confirmed',
          details: txData.error?.message || 'No result returned',
        },
        400
      )
    }

    const tx = txData.result

    // Require blockTime (some RPC nodes may not return it)
    if (!tx.blockTime) {
      return c.json(
        {
          error: 'Transaction block time unavailable',
          hint: 'Please retry — the RPC node may not have full data for this transaction',
        },
        400
      )
    }

    // Check transaction is recent (within 15 minutes for deposits)
    const txTime = tx.blockTime * 1000
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000
    if (txTime < fifteenMinutesAgo) {
      return c.json(
        {
          error: 'Transaction is too old',
          tx_time: new Date(txTime).toISOString(),
          current_time: new Date().toISOString(),
          hint: 'Deposits must be verified within 15 minutes',
        },
        400
      )
    }

    // Check transaction succeeded
    if (tx.meta?.err) {
      return c.json(
        {
          error: 'Transaction failed on chain',
          chain_error: tx.meta.err,
        },
        400
      )
    }

    const instructions = tx.transaction?.message?.instructions || []
    const decimals = TOKEN_DECIMALS[token]

    let verifiedAmount: number
    let verifiedSender: string
    let priceUsd: number | null = null

    if (token === 'SOL') {
      // Verify native SOL transfer
      const solTransfer = parseSolTransfer(instructions)

      if (!solTransfer) {
        return c.json({ error: 'No SOL transfer found in transaction' }, 400)
      }

      verifiedSender = solTransfer.source
      verifiedAmount = solTransfer.lamports / Math.pow(10, decimals)

      // Verify recipient is treasury
      if (solTransfer.destination !== treasuryWallet) {
        return c.json(
          {
            error: 'Transaction recipient is not our treasury',
            expected: treasuryWallet,
            received: solTransfer.destination,
          },
          400
        )
      }

      // Use centralized price service for SOL price
      const solPrice = await getTokenPrice('SOL')
      priceUsd = solPrice.priceUsd
    } else {
      // Verify SPL token transfer (USDC or GCLAW)
      const tokenTransfer = parseTokenTransfer(instructions)

      if (!tokenTransfer) {
        return c.json({ error: `No ${token} token transfer found in transaction` }, 400)
      }

      // Verify correct token mint (if available from transferChecked instruction)
      const expectedMint = TOKEN_MINTS[token as keyof typeof TOKEN_MINTS]
      if (tokenTransfer.mint && tokenTransfer.mint !== expectedMint) {
        return c.json(
          {
            error: 'Wrong token mint',
            expected: expectedMint,
            received: tokenTransfer.mint,
          },
          400
        )
      }

      verifiedSender = tokenTransfer.authority
      verifiedAmount = tokenTransfer.amount / Math.pow(10, decimals)

      // Verify treasury actually received tokens by comparing pre/post balances
      // This also covers the mint bypass case: findTreasuryBalance filters by expectedMint,
      // so even plain 'transfer' instructions (no mint field) are validated correctly.
      const preTokenBalances = tx.meta?.preTokenBalances || []
      const postTokenBalances = tx.meta?.postTokenBalances || []

      const findTreasuryBalance = (balances: typeof preTokenBalances) =>
        balances.find((b) => b.owner === treasuryWallet && b.mint === expectedMint)

      const preBal = findTreasuryBalance(preTokenBalances)
      const postBal = findTreasuryBalance(postTokenBalances)

      const preAmount = parseInt(preBal?.uiTokenAmount?.amount || '0', 10)
      const postAmount = parseInt(postBal?.uiTokenAmount?.amount || '0', 10)
      const balanceDelta = postAmount - preAmount

      if (balanceDelta <= 0) {
        return c.json(
          {
            error: 'Treasury did not receive tokens',
            details: 'Pre/post balance delta is zero or negative',
          },
          400
        )
      }

      // Verify the delta matches the parsed transfer amount (1% tolerance for fees)
      const deltaInTokens = balanceDelta / Math.pow(10, decimals)
      const tolerance = verifiedAmount * 0.01
      if (Math.abs(deltaInTokens - verifiedAmount) > tolerance) {
        return c.json(
          {
            error: 'Transfer amount mismatch',
            expected: verifiedAmount,
            received: deltaInTokens,
          },
          400
        )
      }

      // Token prices via centralized price service
      if (token === 'USDC') {
        priceUsd = 1.0
      } else if (token === 'GCLAW') {
        const clawPrice = await getTokenPrice('GCLAW')
        priceUsd = clawPrice.priceUsd
      }
    }

    // Verify sender matches authenticated wallet
    if (verifiedSender !== wallet) {
      return c.json(
        {
          error: 'Transaction sender does not match authenticated wallet',
          expected: wallet,
          received: verifiedSender,
        },
        400
      )
    }

    // Calculate credits with bonus
    const { creditsUsd, bonus } = calculateCredits(
      token as PaymentToken,
      verifiedAmount,
      priceUsd || 0
    )

    // Validate minimum deposit
    const minValidation = validateMinimumDeposit(creditsUsd)
    if (!minValidation.valid) {
      return c.json(
        {
          error: 'Deposit below minimum',
          minimum_usd: minValidation.minimum,
          provided_usd: minValidation.provided,
          hint: `Minimum deposit is $${MIN_DEPOSIT_USD} (~${Math.floor(MIN_DEPOSIT_USD / COST_PER_EXECUTION)} executions)`,
        },
        400
      )
    }

    // Atomic deposit: insert record + add credits in single transaction
    const result = await processDeposit(supabase, {
      walletAddress: wallet,
      token: token as PaymentToken,
      amount: verifiedAmount,
      priceUsd: priceUsd ?? 0,
      creditsUsd,
      bonusApplied: bonus,
      txSignature: tx_signature,
    })

    if (!result.success) {
      if (result.error === 'DUPLICATE_TRANSACTION') {
        return c.json({ error: 'Transaction already processed' }, 409)
      }
      return c.json({ error: 'Failed to process deposit' }, 500)
    }

    return c.json({
      success: true,
      deposit: {
        token,
        amount: verifiedAmount,
        price_usd: priceUsd,
        credits_usd: creditsUsd,
        bonus_applied: bonus > 1 ? `${((bonus - 1) * 100).toFixed(0)}%` : null,
      },
      balance: {
        new_balance_usd: result.newBalance,
        executions_available: Math.floor(result.newBalance / COST_PER_EXECUTION),
      },
      tx_signature,
    })
  } catch (error) {
    console.error('Deposit verification error:', error)
    return c.json(
      {
        error: 'Failed to verify transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// GET /credits/history - Get deposit history
creditsRoutes.get('/history', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const wallet = c.get('wallet')
  const query = historyQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)
  const deposits = await getDepositHistory(supabase, wallet, query.data.limit, query.data.offset)

  return c.json({
    deposits,
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: deposits.length,
    },
  })
})

// GET /credits/usage - Get usage/spending history
creditsRoutes.get('/usage', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const wallet = c.get('wallet')
  const query = historyQuerySchema.safeParse({
    limit: c.req.query('limit'),
    offset: c.req.query('offset'),
  })

  if (!query.success) {
    return c.json({ error: 'Invalid query parameters', details: query.error.flatten() }, 400)
  }

  const supabase = await getUserClient(c.env, wallet)
  const usage = await getUsageHistory(supabase, wallet, query.data.limit, query.data.offset)

  // Calculate totals
  const totalSpent = usage.reduce((sum, entry) => sum + entry.cost_usd, 0)
  const executionCount = usage.length

  return c.json({
    usage,
    summary: {
      total_spent: totalSpent,
      execution_count: executionCount,
      cost_per_execution: COST_PER_EXECUTION,
    },
    pagination: {
      limit: query.data.limit,
      offset: query.data.offset,
      count: usage.length,
    },
  })
})
