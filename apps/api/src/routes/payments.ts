import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { walletRateLimitMiddleware } from '../middleware/rate-limit'
import { getUserClient } from '../lib/supabase-client'
import { IdempotencyLayer, generateAutoKey } from '../lib/idempotency'

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
  plan: string
}

export const paymentsRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Token mint addresses (Solana mainnet)
const TOKEN_MINTS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  GCLAW: '', // Set when $GCLAW token is deployed
} as const

// Token decimals
const TOKEN_DECIMALS = {
  SOL: 9,
  USDC: 6,
  GCLAW: 9,
} as const

// Pricing configuration
const PLAN_PRICING = {
  starter: {
    name: 'Starter',
    price_sol: 0.5,
    price_usdc: 19,
    duration_days: 30,
    features: {
      agents: 10,
      requests_per_month: 10000,
      api_keys_per_agent: 3,
      claw_level: 'full',
      analytics: true,
    },
  },
  pro: {
    name: 'Pro',
    price_sol: 1.2,
    price_usdc: 49,
    duration_days: 30,
    features: {
      agents: 50,
      requests_per_month: 100000,
      api_keys_per_agent: 10,
      claw_level: 'full',
      analytics: true,
      priority_support: true,
      custom_rules: true,
      webhooks: true,
      team_size: 5,
    },
  },
} as const

type PlanType = keyof typeof PLAN_PRICING
type PaymentToken = 'SOL' | 'USDC' | 'GCLAW'

// Validation schemas
const verifyPaymentSchema = z.object({
  tx_signature: z.string().min(80).max(100),
  plan: z.enum(['starter', 'pro']),
  payment_token: z.enum(['SOL', 'USDC', 'GCLAW']).default('SOL'),
})

// GET /payments/plans - Get available plans and pricing
paymentsRoutes.get('/plans', (c) => {
  return c.json({
    plans: {
      free: {
        name: 'Free',
        price_sol: 0,
        price_usd: 0,
        features: {
          agents: 3,
          requests_per_month: 1000,
          api_keys_per_agent: 1,
          claw_level: 'heuristic',
          analytics: false,
        },
      },
      ...PLAN_PRICING,
    },
    payment_methods: [
      { token: 'SOL', discount: 0 },
      { token: 'USDC', discount: 0 },
      { token: 'GCLAW', discount: 0.2, note: '20% discount with $GCLAW' },
    ],
    treasury: c.env.TREASURY_WALLET || 'Not configured',
  })
})

// GET /payments/status - Get current subscription status (requires auth)
paymentsRoutes.get('/status', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const wallet = c.get('wallet')

  const supabase = await getUserClient(c.env, wallet)

  // Get profile with plan info
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('wallet_address', wallet)
    .single()

  // Get active subscription if any
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('wallet_address', wallet)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const plan = profile?.plan || 'free'
  const expiresAt = profile?.plan_expires_at
  const isExpired = expiresAt && new Date(expiresAt) < new Date()

  return c.json({
    plan: isExpired ? 'free' : plan,
    plan_expires_at: expiresAt,
    is_active: !isExpired && plan !== 'free',
    subscription: subscription || null,
    features:
      plan === 'free' || isExpired
        ? { agents: 3, requests_per_month: 1000 }
        : PLAN_PRICING[plan as PlanType]?.features || {},
  })
})

// Helper: Calculate expected price for a plan and token
function getExpectedPrice(plan: PlanType, token: PaymentToken): number {
  const planInfo = PLAN_PRICING[plan]

  switch (token) {
    case 'SOL':
      return planInfo.price_sol
    case 'USDC':
      return planInfo.price_usdc
    case 'GCLAW':
      // 20% discount when paying with GCLAW
      return planInfo.price_sol * 0.8
    default:
      return planInfo.price_sol
  }
}

// Helper: Parse SPL token transfer from transaction instructions
interface TokenTransferInfo {
  mint: string
  source: string
  destination: string
  amount: number
  authority: string
}

function parseTokenTransfer(
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
    if (programId !== 'TokenkegQvGj4wWY9ArbGcRRwMqs3wFxwZ4wfAFhfRr') continue

    const parsed = ix.parsed
    if (!parsed || (parsed.type !== 'transferChecked' && parsed.type !== 'transfer')) continue

    const info = parsed.info
    if (!info) continue

    // transferChecked has tokenAmount, transfer has amount
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

// Helper: Parse SOL transfer from transaction
interface SolTransferInfo {
  source: string
  destination: string
  lamports: number
}

function parseSolTransfer(
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

// Helper: Get associated token address (simplified, no on-chain lookup)
function _getAssociatedTokenAddress(mint: string, owner: string): string {
  // This is a simplified check. In production, you'd want to derive or look up the ATA
  // For verification purposes, we check if the destination matches the expected pattern
  return `${owner}_${mint}_ata`
}

// POST /payments/verify - Verify Solana payment and activate subscription
paymentsRoutes.post('/verify', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const wallet = c.get('wallet')

  const body = await c.req.json()
  const parsed = verifyPaymentSchema.safeParse(body)

  if (!parsed.success) {
    return c.json({ error: 'Invalid request', details: parsed.error.flatten() }, 400)
  }

  const { tx_signature, plan, payment_token } = parsed.data

  // Idempotency: prefer client-supplied key; fall back to a deterministic hash
  // of the payment intent so replays of the same Solana transaction return the
  // same response. The key flows through both the KV cache (fast path) and the
  // record_payment RPC (durable UNIQUE (wallet_address, idempotency_key)).
  const idempotencyKeyHeader = c.req.header('Idempotency-Key')
  const idempotencyKey =
    idempotencyKeyHeader ||
    (await generateAutoKey(wallet, tx_signature, JSON.stringify({ plan, payment_token })))
  const idempotency = new IdempotencyLayer(c.env.RATE_LIMIT_KV || null)

  const existingEntry = await idempotency.check(idempotencyKey)
  if (existingEntry?.status === 'complete' && existingEntry.response) {
    c.header('X-Idempotent-Replay', 'true')
    return c.json(
      existingEntry.response as Record<string, unknown>,
      (existingEntry.statusCode || 200) as 200
    )
  }
  if (existingEntry?.status === 'processing') {
    c.header('Retry-After', '5')
    return c.json(
      { error: 'Request already in progress', code: 'DUPLICATE_REQUEST' },
      409
    )
  }

  // Get treasury wallet
  const treasuryWallet = c.env.TREASURY_WALLET
  if (!treasuryWallet) {
    // 503 is transient — do not cache. Stakeholder fixes config and the client retries.
    return c.json({ error: 'Payment system not configured' }, 503)
  }

  await idempotency.markProcessing(idempotencyKey)

  const supabase = await getUserClient(c.env, wallet)

  // Verify transaction on Solana
  // (Cross-tenant tx_signature uniqueness check is enforced atomically inside
  // the record_payment SECURITY DEFINER RPC further below.)
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

    // Require blockTime
    if (!tx.blockTime) {
      return c.json(
        {
          error: 'Transaction block time unavailable',
          hint: 'Please retry — the RPC node may not have full data for this transaction',
        },
        400
      )
    }

    // Check transaction is recent (within 10 minutes)
    const txTime = tx.blockTime * 1000
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000
    if (txTime < tenMinutesAgo) {
      return c.json(
        {
          error: 'Transaction is too old',
          tx_time: new Date(txTime).toISOString(),
          current_time: new Date().toISOString(),
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
    const _accountKeys = tx.transaction?.message?.accountKeys || []
    const expectedPrice = getExpectedPrice(plan, payment_token)
    const decimals = TOKEN_DECIMALS[payment_token]

    let verifiedAmount: number
    let verifiedSender: string
    let verifiedRecipient: string

    if (payment_token === 'SOL') {
      // Verify native SOL transfer
      const solTransfer = parseSolTransfer(instructions)

      if (!solTransfer) {
        return c.json({ error: 'No SOL transfer found in transaction' }, 400)
      }

      verifiedSender = solTransfer.source
      verifiedRecipient = solTransfer.destination
      verifiedAmount = solTransfer.lamports / Math.pow(10, decimals)

      // Verify recipient is treasury
      if (verifiedRecipient !== treasuryWallet) {
        return c.json(
          {
            error: 'Transaction recipient is not our treasury',
            expected: treasuryWallet,
            received: verifiedRecipient,
          },
          400
        )
      }
    } else {
      // Verify SPL token transfer (USDC or GCLAW)
      const tokenTransfer = parseTokenTransfer(instructions)

      if (!tokenTransfer) {
        return c.json({ error: `No ${payment_token} token transfer found in transaction` }, 400)
      }

      // Verify correct token mint
      const expectedMint = TOKEN_MINTS[payment_token]
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

      // For SPL tokens, the authority is the signer
      verifiedSender = tokenTransfer.authority
      verifiedAmount = tokenTransfer.amount / Math.pow(10, decimals)

      // Verify treasury actually received tokens by comparing pre/post balances
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

      // Verify delta matches expected amount (5% tolerance for subscription payments)
      const deltaInTokens = balanceDelta / Math.pow(10, decimals)
      const tolerance = verifiedAmount * 0.05
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

      verifiedRecipient = treasuryWallet
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

    // Verify amount matches plan price (with 5% tolerance for rounding/fees)
    const minAmount = expectedPrice * 0.95
    if (verifiedAmount < minAmount) {
      return c.json(
        {
          error: 'Insufficient payment amount',
          expected: expectedPrice,
          received: verifiedAmount,
          token: payment_token,
          min_accepted: minAmount,
        },
        400
      )
    }

    // Atomically: cross-tenant tx_signature uniqueness check, subscription
    // insert, profile plan update — all behind record_payment SECURITY DEFINER
    // (mig 20260507000000). The RPC verifies the JWT wallet claim matches
    // p_wallet so a misbehaving handler cannot record a payment against a
    // wallet other than the authenticated caller's.
    const periodStart = new Date()
    const periodEnd = new Date()
    periodEnd.setDate(periodEnd.getDate() + PLAN_PRICING[plan].duration_days)
    const amountSmallestUnit = Math.floor(verifiedAmount * Math.pow(10, decimals))

    const { data: rpcData, error: rpcError } = await supabase.rpc('record_payment', {
      p_wallet: wallet,
      p_tx_signature: tx_signature,
      p_plan: plan,
      p_payment_token: payment_token,
      p_amount_lamports: amountSmallestUnit,
      p_period_start: periodStart.toISOString(),
      p_period_end: periodEnd.toISOString(),
      p_idempotency_key: idempotencyKey,
    })

    if (rpcError) {
      console.error('Failed to record payment:', rpcError)
      // Transient backend failure — clear the in-flight marker so the client
      // can retry under the same idempotency key.
      await idempotency.remove(idempotencyKey)
      return c.json({ error: 'Failed to create subscription' }, 500)
    }

    const result = rpcData as
      | {
          success: true
          replayed?: boolean
          plan: string
          period_start: string
          period_end: string
          subscription_id?: string
          tx_signature?: string
        }
      | { success: false; error: string; existing_subscription_id?: string }

    if (!result.success) {
      if (result.error === 'tx_signature_already_used') {
        const conflictBody = { error: 'Transaction already used' }
        // Deterministic conflict — cache so the next retry returns the same
        // 409 immediately instead of re-running Solana validation.
        await idempotency.markComplete(idempotencyKey, conflictBody, 409)
        return c.json(conflictBody, 409)
      }
      await idempotency.remove(idempotencyKey)
      return c.json({ error: result.error || 'Failed to record payment' }, 500)
    }

    const responseBody = {
      success: true,
      plan,
      payment_token,
      amount: verifiedAmount,
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      message: `Successfully upgraded to ${PLAN_PRICING[plan].name}!`,
      ...(result.replayed ? { replayed: true } : {}),
    }
    await idempotency.markComplete(idempotencyKey, responseBody, 200)
    if (result.replayed) {
      c.header('X-Idempotent-Replay', 'true')
    }
    return c.json(responseBody)
  } catch (error) {
    console.error('Payment verification error:', error)
    // Transient — drop the marker so the client can retry.
    await idempotency.remove(idempotencyKey)
    return c.json(
      {
        error: 'Failed to verify transaction',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

// GET /payments/history - Get payment history (requires auth)
paymentsRoutes.get('/history', authMiddleware, walletRateLimitMiddleware(), async (c) => {
  const wallet = c.get('wallet')

  const supabase = await getUserClient(c.env, wallet)

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('wallet_address', wallet)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    console.error('Failed to fetch payment history:', error)
    return c.json({ error: 'Failed to fetch payment history' }, 500)
  }

  return c.json({
    subscriptions: subscriptions || [],
  })
})
