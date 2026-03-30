'use client'

/**
 * Token balance display component
 */

import { motion } from 'framer-motion'
import { Coins, RefreshCw, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTokenBalance } from '@/hooks/use-governance'
import { formatVotingPower, GOVERNANCE_CONFIG } from '@/lib/governance'

interface TokenBalanceProps {
  wallet?: string
  showRefresh?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact'
  className?: string
}

export function TokenBalance({
  wallet,
  showRefresh = true,
  size = 'md',
  variant = 'default',
  className,
}: TokenBalanceProps) {
  const { balance, loading, error, refetch } = useTokenBalance()

  const displayBalance = balance / Math.pow(10, GOVERNANCE_CONFIG.tokenDecimals)

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  }

  const iconSize = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
  }

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2', sizeClasses[size], className)}>
        <Loader2 className={cn(iconSize[size], 'text-muted-foreground animate-spin')} />
        <span className="text-muted-foreground">Loading...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('flex items-center gap-2 text-red-400', sizeClasses[size], className)}>
        <Coins className={iconSize[size]} />
        <span>Error loading balance</span>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn('flex items-center gap-1.5', sizeClasses[size], className)}
      >
        <Coins className={cn(iconSize[size], 'text-emerald-500')} />
        <span className="text-foreground font-medium">{formatVotingPower(displayBalance)}</span>
        <span className="text-muted-foreground">$GCLAW</span>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-card/50 border-border flex items-center gap-3 rounded-lg border p-3',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20">
        <Coins className="h-5 w-5 text-emerald-500" />
      </div>

      <div className="flex-1">
        <p className="text-muted-foreground text-sm">Token Balance</p>
        <p className={cn('text-foreground font-semibold', sizeClasses[size])}>
          {formatVotingPower(displayBalance)} <span className="text-muted-foreground">$GCLAW</span>
        </p>
      </div>

      {showRefresh && (
        <button
          onClick={() => refetch()}
          className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg p-2 transition-colors"
          title="Refresh balance"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  )
}

export default TokenBalance
