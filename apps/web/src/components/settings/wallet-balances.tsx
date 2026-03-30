'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token'
import Image from 'next/image'
import { Wallet, RefreshCw, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { pricesApi } from '@/lib/api'
import { cn } from '@/lib/utils'

// Token mint addresses (mainnet)
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
const GCLAW_MINT = new PublicKey(process.env.NEXT_PUBLIC_GCLAW_MINT || '11111111111111111111111111111111')

interface TokenBalance {
  symbol: string
  balance: number
  usdValue: number
  price: number
  icon: string
  decimals: number
  mint?: string
}

export function WalletBalances() {
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [totalUsd, setTotalUsd] = useState(0)

  const fetchBalances = useCallback(async () => {
    if (!publicKey || !connection) {
      setLoading(false)
      return
    }

    try {
      // Fetch prices from our backend
      const pricesResponse = await pricesApi.getAll()
      const prices = pricesResponse.success ? pricesResponse.data.prices : null

      const solPrice = prices?.SOL?.priceUsd || 0
      const usdcPrice = prices?.USDC?.priceUsd || 1
      const clawPrice = prices?.GCLAW?.priceUsd || 0

      // Fetch SOL balance
      const solBalance = await connection.getBalance(publicKey)
      const solAmount = solBalance / LAMPORTS_PER_SOL

      // Fetch USDC balance
      let usdcAmount = 0
      try {
        const usdcAta = await getAssociatedTokenAddress(USDC_MINT, publicKey)
        const usdcAccount = await connection.getTokenAccountBalance(usdcAta)
        usdcAmount = parseFloat(usdcAccount.value.uiAmountString || '0')
      } catch {
        // No USDC account
      }

      // Fetch GCLAW balance (Token-2022 program)
      let clawAmount = 0
      try {
        const clawAta = await getAssociatedTokenAddress(
          GCLAW_MINT,
          publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        )
        const clawAccount = await connection.getTokenAccountBalance(clawAta)
        clawAmount = parseFloat(clawAccount.value.uiAmountString || '0')
      } catch {
        // No GCLAW account
      }

      const newBalances: TokenBalance[] = [
        {
          symbol: 'SOL',
          balance: solAmount,
          usdValue: solAmount * solPrice,
          price: solPrice,
          icon: '/images/ecosystem/solana.svg',
          decimals: 9,
        },
        {
          symbol: 'USDC',
          balance: usdcAmount,
          usdValue: usdcAmount * usdcPrice,
          price: usdcPrice,
          icon: '/images/tokens/usdc.svg',
          decimals: 6,
          mint: USDC_MINT.toString(),
        },
        {
          symbol: 'GCLAW',
          balance: clawAmount,
          usdValue: clawAmount * clawPrice,
          price: clawPrice,
          icon: '/favicon.svg',
          decimals: 9,
          mint: GCLAW_MINT.toString(),
        },
      ]

      setBalances(newBalances)
      setTotalUsd(newBalances.reduce((sum, b) => sum + b.usdValue, 0))
    } catch (error) {
      console.error('Failed to fetch balances:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [publicKey, connection])

  useEffect(() => {
    fetchBalances()
  }, [fetchBalances])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchBalances()
  }

  const formatBalance = (balance: number, decimals: number = 4) => {
    if (balance === 0) return '0'
    if (balance < 0.0001) return balance.toExponential(2)
    return balance.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    })
  }

  const formatUsd = (value: number) => {
    if (value === 0) return '$0.00'
    if (value < 0.01) return '<$0.01'
    return `$${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  if (!publicKey) {
    return (
      <div className="bg-card rounded-lg border p-6">
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          <h3 className="text-lg font-medium">Wallet Balances</h3>
        </div>
        <p className="text-muted-foreground text-sm">Connect your wallet to view balances.</p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          <h3 className="text-lg font-medium">Wallet Balances</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {balances.map((token) => (
              <div
                key={token.symbol}
                className="flex items-center justify-between border-b py-2 last:border-0"
              >
                <div className="flex items-center gap-3">
                  <Image
                    src={token.icon}
                    alt={token.symbol}
                    width={28}
                    height={28}
                    className="rounded-full"
                  />
                  <div>
                    <p className="font-medium">{token.symbol}</p>
                    <p className="text-muted-foreground text-xs">
                      ${token.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono font-medium">{formatBalance(token.balance)}</p>
                  <p className="text-muted-foreground text-xs">{formatUsd(token.usdValue)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Total Value</span>
              <span className="text-lg font-bold">{formatUsd(totalUsd)}</span>
            </div>
          </div>

          <div className="mt-4">
            <a
              href={`https://solscan.io/account/${publicKey.toString()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center justify-center gap-2 text-sm transition-colors"
            >
              View on Solscan
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </>
      )}
    </div>
  )
}
