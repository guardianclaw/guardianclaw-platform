'use client'

import { useState, useEffect, useCallback } from 'react'
import { Coins, AlertTriangle, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { creditsApi, type CreditBalance, type WarningLevel } from '@/lib/api'
import { useAuth } from '@/components/providers/auth-provider'

interface BalanceDisplayProps {
  onDepositClick?: () => void
  compact?: boolean
  showDetails?: boolean
  className?: string
  refreshInterval?: number // in ms, 0 to disable auto-refresh
}

export function BalanceDisplay({
  onDepositClick,
  compact = false,
  showDetails = true,
  className,
  refreshInterval = 60000, // refresh every minute by default
}: BalanceDisplayProps) {
  const { isAuthenticated } = useAuth()
  const [balance, setBalance] = useState<CreditBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }

    try {
      setError(null)
      const data = await creditsApi.getBalance()
      setBalance(data)
    } catch (err) {
      console.error('Failed to fetch balance:', err)
      setError('Failed to load balance')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  // Initial fetch and periodic refresh
  useEffect(() => {
    fetchBalance()

    if (refreshInterval > 0) {
      const interval = setInterval(fetchBalance, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [fetchBalance, refreshInterval])

  // Don't render if not authenticated
  if (!isAuthenticated) {
    return null
  }

  // Loading state
  if (loading && !balance) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="bg-muted h-8 w-20 animate-pulse rounded" />
      </div>
    )
  }

  // Error state
  if (error && !balance) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('text-destructive', className)}
              onClick={fetchBalance}
            >
              <AlertTriangle className="mr-1 h-4 w-4" />
              Error
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{error}</p>
            <p className="text-muted-foreground text-xs">Click to retry</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (!balance) {
    return null
  }

  const warningStyles: Record<WarningLevel, string> = {
    normal: 'text-green-500',
    low: 'text-yellow-500',
    critical: 'text-red-500',
  }

  const warningBadgeStyles: Record<WarningLevel, string> = {
    normal: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
    low: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
    critical: 'bg-red-500/10 text-red-500 hover:bg-red-500/20 animate-pulse',
  }

  // Compact version for header
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn('gap-2', className)}
              onClick={onDepositClick}
            >
              <Coins className={cn('h-4 w-4', warningStyles[balance.warning_level])} />
              <span className="font-mono text-sm">${balance.balance_usd.toFixed(2)}</span>
              {balance.warning_level !== 'normal' && (
                <AlertTriangle className={cn('h-3 w-3', warningStyles[balance.warning_level])} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="w-64">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-mono font-medium">${balance.balance_usd.toFixed(4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Executions</span>
                <span className="font-mono">{balance.executions_remaining.toLocaleString()}</span>
              </div>
              {balance.alerts.message && (
                <p className={cn('text-xs', warningStyles[balance.warning_level])}>
                  {balance.alerts.message}
                </p>
              )}
              <p className="text-muted-foreground border-t pt-1 text-xs">Click to add credits</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full version for settings page
  return (
    <div className={cn('rounded-lg border p-4', className)}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className={cn('h-5 w-5', warningStyles[balance.warning_level])} />
          <h3 className="font-semibold">Credits Balance</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchBalance}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          {onDepositClick && (
            <Button size="sm" onClick={onDepositClick}>
              <Plus className="mr-1 h-4 w-4" />
              Add Credits
            </Button>
          )}
        </div>
      </div>

      {/* Main balance */}
      <div className="mb-4 flex items-baseline gap-1">
        <span className={cn('font-mono text-3xl font-bold', warningStyles[balance.warning_level])}>
          ${balance.balance_usd.toFixed(4)}
        </span>
        <span className="text-muted-foreground text-sm">USD</span>
      </div>

      {/* Warning badge */}
      {balance.warning_level !== 'normal' && (
        <Badge className={cn('mb-4', warningBadgeStyles[balance.warning_level])}>
          <AlertTriangle className="mr-1 h-3 w-3" />
          {balance.alerts.message}
        </Badge>
      )}

      {/* Stats */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <p className="text-muted-foreground text-sm">Executions Remaining</p>
            <p className="font-mono text-lg font-medium">
              {balance.executions_remaining.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Cost per Execution</p>
            <p className="font-mono text-lg font-medium">
              ${balance.cost_per_execution.toFixed(4)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Total Deposited</p>
            <p className="font-mono text-lg font-medium">${balance.total_deposited.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm">Total Spent</p>
            <p className="font-mono text-lg font-medium">${balance.total_spent.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  )
}
