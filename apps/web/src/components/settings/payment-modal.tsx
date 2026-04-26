'use client'

import { useState, useCallback, useEffect } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useAuth } from '@/components/providers/auth-provider'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

// Token mint addresses (mainnet)
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const GCLAW_MINT = new PublicKey(process.env.NEXT_PUBLIC_GCLAW_MINT || '11111111111111111111111111111111')

// Plan pricing
const PLAN_PRICING = {
  starter: {
    name: 'Starter',
    price_sol: 0.5,
    price_usdc: 19,
    duration_days: 30,
  },
  pro: {
    name: 'Pro',
    price_sol: 1.2,
    price_usdc: 49,
    duration_days: 30,
  },
} as const

type PlanType = keyof typeof PLAN_PRICING
type PaymentToken = 'SOL' | 'USDC' | 'GCLAW'

interface PaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan: PlanType
  treasuryWallet: string
  onSuccess: () => void
}

type PaymentStep = 'select' | 'confirming' | 'sending' | 'verifying' | 'success' | 'error'

interface PaymentState {
  step: PaymentStep
  txSignature: string | null
  error: string | null
}

export function PaymentModal({
  open,
  onOpenChange,
  plan,
  treasuryWallet,
  onSuccess,
}: PaymentModalProps) {
  const { publicKey, sendTransaction, connected } = useWallet()
  const { connection } = useConnection()
  const { isAuthenticated } = useAuth()

  const [paymentToken, setPaymentToken] = useState<PaymentToken>('SOL')
  const [state, setState] = useState<PaymentState>({
    step: 'select',
    txSignature: null,
    error: null,
  })

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setState({ step: 'select', txSignature: null, error: null })
      setPaymentToken('SOL')
    }
  }, [open])

  const planInfo = PLAN_PRICING[plan]

  // Calculate price based on payment token
  const getPrice = useCallback(() => {
    switch (paymentToken) {
      case 'SOL':
        return { amount: planInfo.price_sol, symbol: 'SOL', decimals: 9 }
      case 'USDC':
        return { amount: planInfo.price_usdc, symbol: 'USDC', decimals: 6 }
      case 'GCLAW':
        // 20% discount with GCLAW
        const discountedSol = planInfo.price_sol * 0.8
        return { amount: discountedSol, symbol: 'GCLAW', decimals: 9 }
      default:
        return { amount: planInfo.price_sol, symbol: 'SOL', decimals: 9 }
    }
  }, [paymentToken, planInfo])

  // Create and send transaction
  const handlePayment = useCallback(async () => {
    if (!publicKey || !sendTransaction || !connection || !isAuthenticated) {
      setState((s) => ({ ...s, error: 'Wallet not connected' }))
      return
    }

    const treasury = new PublicKey(treasuryWallet)
    const price = getPrice()

    setState({ step: 'confirming', txSignature: null, error: null })

    try {
      const transaction = new Transaction()

      if (paymentToken === 'SOL') {
        // Native SOL transfer
        const lamports = Math.floor(price.amount * LAMPORTS_PER_SOL)
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
        const tokenProgramId = paymentToken === 'GCLAW' ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
        const amount = Math.floor(price.amount * Math.pow(10, price.decimals))

        // Get associated token accounts (Token-2022 for GCLAW, standard for USDC)
        const fromAta = await getAssociatedTokenAddress(mint, publicKey, false, tokenProgramId)
        const toAta = await getAssociatedTokenAddress(mint, treasury, false, tokenProgramId)

        // Check if sender has the token account
        const fromAccount = await connection.getAccountInfo(fromAta)
        if (!fromAccount) {
          throw new Error(`You don't have a ${price.symbol} token account`)
        }

        // Check balance
        const tokenBalance = await connection.getTokenAccountBalance(fromAta)
        const requiredAmount = amount / Math.pow(10, price.decimals)
        const availableBalance = parseFloat(tokenBalance.value.uiAmountString || '0')

        if (availableBalance < requiredAmount) {
          throw new Error(
            `Insufficient ${price.symbol} balance. Required: ${requiredAmount}, Available: ${availableBalance.toFixed(2)}`
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
              tokenProgramId // token program
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
            tokenProgramId // token program
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

      setState({ step: 'verifying', txSignature: signature, error: null })

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        'confirmed'
      )

      if (confirmation.value.err) {
        throw new Error('Transaction failed on chain')
      }

      // Verify with backend
      const verifyResponse = await fetch(`${API_URL}/payments/verify`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_signature: signature,
          plan,
          payment_token: paymentToken,
        }),
      })

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json()
        throw new Error(errorData.error || 'Verification failed')
      }

      setState({ step: 'success', txSignature: signature, error: null })

      // Notify parent of success after delay
      setTimeout(() => {
        onSuccess()
        onOpenChange(false)
      }, 2000)
    } catch (error) {
      console.error('Payment error:', error)

      let errorMessage = 'Payment failed'
      if (error instanceof Error) {
        if (error.message.includes('User rejected')) {
          errorMessage = 'Transaction cancelled by user'
        } else if (error.message.includes('insufficient')) {
          errorMessage = error.message
        } else if (error.message.includes('Insufficient')) {
          errorMessage = error.message
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
    plan,
    getPrice,
    onSuccess,
    onOpenChange,
  ])

  const price = getPrice()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {state.step === 'success'
              ? 'Payment Successful!'
              : state.step === 'error'
                ? 'Payment Failed'
                : `Upgrade to ${planInfo.name}`}
          </DialogTitle>
          <DialogDescription>
            {state.step === 'select' && <>Subscribe for {planInfo.duration_days} days</>}
            {state.step === 'confirming' && 'Please confirm the transaction in your wallet'}
            {state.step === 'sending' && 'Sending transaction to the network...'}
            {state.step === 'verifying' && 'Verifying payment...'}
            {state.step === 'success' && 'Your subscription has been activated!'}
            {state.step === 'error' && 'Something went wrong with your payment'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Selection Step */}
          {state.step === 'select' && (
            <div className="space-y-4">
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
                    <SelectItem value="SOL">SOL ({planInfo.price_sol} SOL)</SelectItem>
                    <SelectItem value="USDC">USDC ({planInfo.price_usdc} USDC)</SelectItem>
                    <SelectItem value="GCLAW">
                      $GCLAW ({(planInfo.price_sol * 0.8).toFixed(2)} - 20% off!)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-muted rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="text-xl font-bold">
                    {price.amount} {price.symbol}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{planInfo.duration_days} days</span>
                </div>
                {paymentToken === 'GCLAW' && (
                  <div className="mt-2 flex items-center gap-1 text-sm text-green-500">
                    <CheckCircle2 className="h-4 w-4" />
                    20% discount applied!
                  </div>
                )}
              </div>

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
                {state.step === 'verifying' && 'Verifying on blockchain...'}
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
          {state.step === 'success' && (
            <div className="flex flex-col items-center py-8">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
              <p className="mb-2 text-center font-medium">Welcome to {planInfo.name}!</p>
              <p className="text-muted-foreground text-center text-sm">
                Your subscription is now active.
              </p>
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
              <p className="mb-2 text-center font-medium">Payment Failed</p>
              <p className="text-muted-foreground text-center text-sm">{state.error}</p>
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
        </div>

        <DialogFooter>
          {state.step === 'select' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handlePayment} disabled={!connected}>
                Pay {price.amount} {price.symbol}
              </Button>
            </>
          )}

          {state.step === 'error' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={() => setState({ step: 'select', txSignature: null, error: null })}>
                Try Again
              </Button>
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
