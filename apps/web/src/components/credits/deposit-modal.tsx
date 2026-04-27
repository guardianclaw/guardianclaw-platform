'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Coins,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/providers/auth-provider'
import { creditsApi, pricesApi, type CreditPricing } from '@/lib/api'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

// Token mint addresses (mainnet)
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const GCLAW_MINT = new PublicKey(process.env.NEXT_PUBLIC_GCLAW_MINT || '11111111111111111111111111111111')

type PaymentToken = 'SOL' | 'USDC' | 'GCLAW'

// Token decimals
const TOKEN_DECIMALS: Record<PaymentToken, number> = {
  SOL: 9,
  USDC: 6,
  GCLAW: 6,
}

// GCLAW uses Token-2022; USDC uses standard SPL Token
function getTokenProgramId(token: PaymentToken) {
  return token === 'GCLAW' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
}

// Default prices (will be updated from backend API)
// These are fallbacks only - real prices come from /prices endpoint
const DEFAULT_PRICES: Record<PaymentToken, number> = {
  SOL: 250, // Conservative estimate, will be updated from API
  USDC: 1,
  GCLAW: 0.0001, // Conservative estimate, will be updated from API
}

// localStorage key for pending deposit recovery
const PENDING_DEPOSIT_KEY = 'claw_pending_deposit'

interface PendingDeposit {
  tx_signature: string
  token: PaymentToken
  timestamp: number
}

function savePendingDeposit(tx_signature: string, token: PaymentToken) {
  try {
    const data: PendingDeposit = { tx_signature, token, timestamp: Date.now() }
    localStorage.setItem(PENDING_DEPOSIT_KEY, JSON.stringify(data))
  } catch {
    // localStorage unavailable
  }
}

function loadPendingDeposit(): PendingDeposit | null {
  try {
    const raw = localStorage.getItem(PENDING_DEPOSIT_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PendingDeposit
    // Expire after 14 minutes (backend has 15-minute window)
    if (Date.now() - data.timestamp > 14 * 60 * 1000) {
      localStorage.removeItem(PENDING_DEPOSIT_KEY)
      return null
    }
    return data
  } catch {
    return null
  }
}

function clearPendingDeposit() {
  try {
    localStorage.removeItem(PENDING_DEPOSIT_KEY)
  } catch {
    // localStorage unavailable
  }
}

interface DepositModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  treasuryWallet: string
  onSuccess: () => void
}

type DepositStep = 'select' | 'confirming' | 'sending' | 'verifying' | 'success' | 'error'

interface DepositState {
  step: DepositStep
  txSignature: string | null
  error: string | null
  result?: {
    creditsAdded: number
    newBalance: number
    executionsAvailable: number
    bonusApplied: string | null
  }
}

const PRESET_AMOUNTS = [3, 10, 25, 50, 100]

// Max retries for backend verification
const VERIFY_MAX_RETRIES = 3
const VERIFY_RETRY_DELAYS = [2000, 4000, 6000]

export function DepositModal({ open, onOpenChange, treasuryWallet, onSuccess }: DepositModalProps) {
  const { publicKey, sendTransaction, connected } = useWallet()
  const { connection } = useConnection()
  const { isAuthenticated } = useAuth()

  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [paymentToken, setPaymentToken] = useState<PaymentToken>('SOL')
  const [amountUsd, setAmountUsd] = useState<number>(10)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [pricing, setPricing] = useState<CreditPricing | null>(null)
  const [tokenPrices, setTokenPrices] = useState<Record<PaymentToken, number>>(DEFAULT_PRICES)
  const [state, setState] = useState<DepositState>({
    step: 'select',
    txSignature: null,
    error: null,
  })

  // Fetch pricing info
  useEffect(() => {
    creditsApi.getPricing().then(setPricing).catch(console.error)
  }, [])

  // Fetch token prices from backend API
  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await pricesApi.getAll()
        if (response.success && response.data?.prices) {
          const prices = response.data.prices
          setTokenPrices({
            SOL: prices.SOL?.priceUsd || DEFAULT_PRICES.SOL,
            USDC: prices.USDC?.priceUsd || DEFAULT_PRICES.USDC,
            GCLAW: prices.GCLAW?.priceUsd || DEFAULT_PRICES.GCLAW,
          })
        }
      } catch (error) {
        console.error('Failed to fetch token prices:', error)
        // Keep default prices on error
      }
    }

    fetchPrices()
    // Refresh prices every 30 seconds
    const interval = setInterval(fetchPrices, 30000)
    return () => clearInterval(interval)
  }, [])

  // Verify deposit with backend (with retry logic)
  const verifyDeposit = useCallback(
    async (signature: string, depositToken: PaymentToken) => {
      setState({ step: 'verifying', txSignature: signature, error: null })

      let lastError: Error | null = null

      for (let attempt = 0; attempt < VERIFY_MAX_RETRIES; attempt++) {
        try {
          const depositResult = await creditsApi.deposit({
            tx_signature: signature,
            token: depositToken,
          })

          // Verification succeeded — clear pending and update state
          clearPendingDeposit()

          setState({
            step: 'success',
            txSignature: signature,
            error: null,
            result: {
              creditsAdded: depositResult.deposit.credits_usd,
              newBalance: depositResult.balance.new_balance_usd,
              executionsAvailable: depositResult.balance.executions_available,
              bonusApplied: depositResult.deposit.bonus_applied,
            },
          })

          successTimerRef.current = setTimeout(() => {
            onSuccess()
            onOpenChange(false)
          }, 3000)

          return // success
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error')

          // Don't retry on definitive failures (duplicate, wrong recipient, etc.)
          const msg = lastError.message.toLowerCase()
          if (
            msg.includes('already processed') ||
            msg.includes('already used') ||
            msg.includes('not our treasury') ||
            msg.includes('does not match') ||
            msg.includes('wrong token') ||
            msg.includes('below minimum')
          ) {
            break
          }

          // Wait before retrying (except on last attempt)
          if (attempt < VERIFY_MAX_RETRIES - 1) {
            await new Promise((r) => setTimeout(r, VERIFY_RETRY_DELAYS[attempt]))
          }
        }
      }

      // All retries failed
      setState((s) => ({
        ...s,
        step: 'error',
        error: lastError?.message || 'Deposit verification failed',
      }))
    },
    [onSuccess, onOpenChange]
  )

  // Check for pending deposit when modal opens
  useEffect(() => {
    if (open) {
      const pending = loadPendingDeposit()
      if (pending) {
        // Resume verification of pending deposit
        setPaymentToken(pending.token)
        verifyDeposit(pending.tx_signature, pending.token)
      } else {
        setState({ step: 'select', txSignature: null, error: null })
        setPaymentToken('SOL')
        setAmountUsd(10)
        setCustomAmount('')
      }
    }
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current)
        successTimerRef.current = null
      }
    }
  }, [open, verifyDeposit])

  // Calculate token amount from USD
  const getTokenAmount = useCallback(() => {
    const price = tokenPrices[paymentToken]
    const tokenAmount = amountUsd / price
    return {
      amount: tokenAmount,
      decimals: TOKEN_DECIMALS[paymentToken],
      symbol: paymentToken,
    }
  }, [paymentToken, amountUsd, tokenPrices])

  // Calculate credits (with bonus for GCLAW)
  const getCredits = useCallback(() => {
    const bonus = paymentToken === 'GCLAW' ? 1.2 : 1.0
    const credits = amountUsd * bonus
    const executions = Math.floor(credits / (pricing?.cost_per_execution || 0.003))
    return {
      credits,
      bonus: bonus > 1 ? '20%' : null,
      executions,
    }
  }, [paymentToken, amountUsd, pricing])

  // Handle amount selection
  const handleAmountSelect = (amount: number) => {
    setAmountUsd(amount)
    setCustomAmount('')
  }

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value)
    const parsed = parseFloat(value)
    if (!isNaN(parsed) && parsed > 0) {
      setAmountUsd(parsed)
    }
  }

  // Create and send transaction
  const handleDeposit = useCallback(async () => {
    if (!publicKey || !sendTransaction || !connection || !isAuthenticated) {
      setState((s) => ({ ...s, error: 'Wallet not connected' }))
      return
    }

    const minDeposit = pricing?.minimum_deposit || 3
    if (amountUsd < minDeposit) {
      setState((s) => ({
        ...s,
        step: 'error',
        error: `Minimum deposit is $${minDeposit}`,
      }))
      return
    }

    const treasury = new PublicKey(treasuryWallet)
    const tokenAmount = getTokenAmount()

    setState({ step: 'confirming', txSignature: null, error: null })

    try {
      const transaction = new Transaction()

      if (paymentToken === 'SOL') {
        // Native SOL transfer
        const lamports = Math.floor(tokenAmount.amount * LAMPORTS_PER_SOL)
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: treasury,
            lamports,
          })
        )
      } else {
        // SPL token transfer (USDC or GCLAW)
        const mint = paymentToken === 'USDC' ? USDC_MINT : GCLAW_MINT
        const amount = Math.floor(tokenAmount.amount * Math.pow(10, tokenAmount.decimals))

        // Get associated token accounts (Token-2022 for GCLAW, standard for USDC)
        const tokenProgramId = getTokenProgramId(paymentToken)
        const fromAta = await getAssociatedTokenAddress(mint, publicKey, false, tokenProgramId)
        const toAta = await getAssociatedTokenAddress(mint, treasury, false, tokenProgramId)

        // Check if sender has the token account
        const fromAccount = await connection.getAccountInfo(fromAta)
        if (!fromAccount) {
          throw new Error(`You don't have a ${tokenAmount.symbol} token account`)
        }

        // Check balance
        const tokenBalance = await connection.getTokenAccountBalance(fromAta)
        const requiredAmount = tokenAmount.amount
        const availableBalance = parseFloat(tokenBalance.value.uiAmountString || '0')

        if (availableBalance < requiredAmount) {
          throw new Error(
            `Insufficient ${tokenAmount.symbol} balance. Required: ${requiredAmount.toFixed(4)}, Available: ${availableBalance.toFixed(4)}`
          )
        }

        // Create treasury ATA if it doesn't exist (payer covers rent)
        const toAccount = await connection.getAccountInfo(toAta)
        if (!toAccount) {
          transaction.add(
            createAssociatedTokenAccountInstruction(
              publicKey, // payer
              toAta, // ata address
              treasury, // owner
              mint, // mint
              tokenProgramId // token program (Token-2022 for GCLAW)
            )
          )
        }

        transaction.add(
          createTransferInstruction(
            fromAta,
            toAta,
            publicKey,
            amount,
            [],
            tokenProgramId // token program (Token-2022 for GCLAW)
          )
        )
      }

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed')
      transaction.recentBlockhash = blockhash
      transaction.feePayer = publicKey

      setState({ step: 'sending', txSignature: null, error: null })

      // Send transaction
      const signature = await sendTransaction(transaction, connection)

      // Persist pending deposit BEFORE any async verification.
      // If the page reloads or the modal closes, we can recover from localStorage.
      savePendingDeposit(signature, paymentToken)

      setState({ step: 'verifying', txSignature: signature, error: null })

      // Wait for on-chain confirmation
      try {
        const confirmation = await connection.confirmTransaction(
          {
            signature,
            blockhash,
            lastValidBlockHeight,
          },
          'confirmed'
        )

        if (confirmation.value.err) {
          clearPendingDeposit()
          throw new Error('Transaction failed on chain')
        }
      } catch (confirmError) {
        // confirmTransaction can fail even if the tx succeeded (blockhash expired, timeout).
        // We still attempt backend verification since the tx may have landed.
        console.warn(
          'On-chain confirmation error (proceeding with backend verification):',
          confirmError
        )
      }

      // Verify with backend (includes retry logic)
      await verifyDeposit(signature, paymentToken)
    } catch (error) {
      console.error('Deposit error:', error)

      let errorMessage = 'Deposit failed'
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled by user'
          clearPendingDeposit()
        } else if (
          error.message.includes('insufficient') ||
          error.message.includes('Insufficient')
        ) {
          errorMessage = error.message
          clearPendingDeposit()
        } else if (error.message.includes('minimum')) {
          errorMessage = error.message
          clearPendingDeposit()
        } else {
          errorMessage = error.message
        }
      }

      setState((s) => ({
        ...s,
        step: 'error',
        error: errorMessage,
      }))
    }
  }, [
    publicKey,
    sendTransaction,
    connection,
    isAuthenticated,
    treasuryWallet,
    paymentToken,
    amountUsd,
    pricing,
    getTokenAmount,
    verifyDeposit,
  ])

  // Retry verification for a failed deposit that has a tx_signature
  const handleRetryVerification = useCallback(() => {
    if (state.txSignature) {
      verifyDeposit(state.txSignature, paymentToken)
    }
  }, [state.txSignature, paymentToken, verifyDeposit])

  // Dismiss error and start fresh (clears pending deposit)
  const handleDismissError = useCallback(() => {
    clearPendingDeposit()
    setState({ step: 'select', txSignature: null, error: null })
  }, [])

  const tokenAmount = getTokenAmount()
  const credits = getCredits()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.step === 'success'
              ? 'Credits Added!'
              : state.step === 'error'
                ? 'Deposit Failed'
                : 'Add Credits'}
          </DialogTitle>
          <DialogDescription>
            {state.step === 'select' && 'Deposit SOL, USDC, or $GCLAW to add credits'}
            {state.step === 'confirming' && 'Please confirm the transaction in your wallet'}
            {state.step === 'sending' && 'Sending transaction to the network...'}
            {state.step === 'verifying' && 'Verifying deposit...'}
            {state.step === 'success' && 'Your credits have been added!'}
            {state.step === 'error' && 'Something went wrong with your deposit'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Selection Step */}
          {state.step === 'select' && (
            <div className="space-y-4">
              {/* Payment Token Selection */}
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={paymentToken}
                  onValueChange={(v) => setPaymentToken(v as PaymentToken)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOL">SOL (${tokenPrices.SOL.toFixed(2)}/SOL)</SelectItem>
                    <SelectItem value="USDC">USDC ($1.00/USDC)</SelectItem>
                    <SelectItem value="GCLAW">$GCLAW (+20% bonus!)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount Selection */}
              <div className="space-y-2">
                <Label>Amount (USD)</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_AMOUNTS.map((amount) => (
                    <Button
                      key={amount}
                      variant={amountUsd === amount && !customAmount ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleAmountSelect(amount)}
                    >
                      ${amount}
                    </Button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">or</span>
                  <Input
                    type="number"
                    placeholder="Custom amount"
                    value={customAmount}
                    onChange={(e) => handleCustomAmountChange(e.target.value)}
                    min={pricing?.minimum_deposit || 3}
                    step="0.01"
                    className="w-32"
                  />
                  <span className="text-muted-foreground text-sm">USD</span>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-muted space-y-3 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">You Pay</span>
                  <span className="font-mono text-lg font-bold">
                    {tokenAmount.amount.toFixed(4)} {tokenAmount.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Credits</span>
                  <span className="font-mono text-lg font-bold text-green-500">
                    ${credits.credits.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Executions</span>
                  <span className="font-mono">~{credits.executions.toLocaleString()}</span>
                </div>
                {credits.bonus && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20">
                      <Sparkles className="mr-1 h-3 w-3" />
                      {credits.bonus} bonus applied!
                    </Badge>
                  </div>
                )}
              </div>

              {/* Minimum deposit warning */}
              {amountUsd < (pricing?.minimum_deposit || 3) && (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="mr-2 inline h-4 w-4" />
                  Minimum deposit is ${pricing?.minimum_deposit || 3}
                </div>
              )}

              {/* Wallet not connected warning */}
              {!connected && (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="mr-2 inline h-4 w-4" />
                  Please connect your wallet to continue
                </div>
              )}
            </div>
          )}

          {/* Processing Steps */}
          {(state.step === 'confirming' ||
            state.step === 'sending' ||
            state.step === 'verifying') && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="text-primary mb-4 h-12 w-12 animate-spin" />
              <p className="text-muted-foreground text-center">
                {state.step === 'confirming' && 'Waiting for wallet confirmation...'}
                {state.step === 'sending' && 'Broadcasting transaction...'}
                {state.step === 'verifying' && 'Verifying deposit...'}
              </p>
              {state.txSignature && (
                <a
                  href={`https://solscan.io/tx/${state.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary mt-2 text-sm hover:underline"
                >
                  View on Solscan
                </a>
              )}
            </div>
          )}

          {/* Success */}
          {state.step === 'success' && state.result && (
            <div className="flex flex-col items-center py-8">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <p className="mb-2 text-center font-medium">Credits Added!</p>
              <div className="space-y-1 text-center">
                <p className="text-2xl font-bold text-green-500">
                  +${state.result.creditsAdded.toFixed(2)}
                </p>
                {state.result.bonusApplied && (
                  <Badge className="bg-green-500/10 text-green-500">
                    <Sparkles className="mr-1 h-3 w-3" />
                    {state.result.bonusApplied} bonus included!
                  </Badge>
                )}
              </div>
              <div className="bg-muted mt-4 rounded-lg p-3 text-center">
                <p className="text-muted-foreground text-sm">New Balance</p>
                <p className="font-mono text-lg font-bold">${state.result.newBalance.toFixed(4)}</p>
                <p className="text-muted-foreground text-xs">
                  ~{state.result.executionsAvailable.toLocaleString()} executions
                </p>
              </div>
              {state.txSignature && (
                <a
                  href={`https://solscan.io/tx/${state.txSignature}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary mt-4 text-sm hover:underline"
                >
                  View transaction
                </a>
              )}
            </div>
          )}

          {/* Error */}
          {state.step === 'error' && (
            <div className="flex flex-col items-center py-8">
              <div className="bg-destructive/10 mb-4 flex h-16 w-16 items-center justify-center rounded-full">
                <XCircle className="text-destructive h-8 w-8" />
              </div>
              <p className="mb-2 text-center font-medium">Deposit Failed</p>
              <p className="text-muted-foreground text-center text-sm">{state.error}</p>
              {state.txSignature && (
                <>
                  <p className="text-muted-foreground mt-3 text-center text-xs">
                    Your transaction was sent. You can retry the verification.
                  </p>
                  <a
                    href={`https://solscan.io/tx/${state.txSignature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary mt-2 text-sm hover:underline"
                  >
                    View transaction
                  </a>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {state.step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDeposit}
                disabled={!connected || amountUsd < (pricing?.minimum_deposit || 3)}
              >
                <Coins className="mr-2 h-4 w-4" />
                Deposit {tokenAmount.amount.toFixed(4)} {tokenAmount.symbol}
              </Button>
            </>
          )}

          {state.step === 'error' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {state.txSignature ? (
                <Button onClick={handleRetryVerification}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry Verification
                </Button>
              ) : (
                <Button onClick={handleDismissError}>Try Again</Button>
              )}
            </>
          )}

          {state.step === 'success' && (
            <Button onClick={() => onOpenChange(false)} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
