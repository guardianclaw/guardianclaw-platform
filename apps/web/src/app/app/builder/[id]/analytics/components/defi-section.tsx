'use client'

import { Wallet, Shield, AlertTriangle, ArrowUpDown, Coins, Layers, Gem } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { DeFiStats } from '@/lib/api'

interface DeFiSectionProps {
  defi: DeFiStats[]
  loading?: boolean
}

interface OperationConfig {
  name: string
  icon: typeof Wallet
  color: string
}

const operationConfig: Record<string, OperationConfig> = {
  transfer: { name: 'Transfer', icon: ArrowUpDown, color: 'text-blue-500' },
  swap: { name: 'Swap', icon: ArrowUpDown, color: 'text-purple-500' },
  stake: { name: 'Stake', icon: Layers, color: 'text-green-500' },
  mint: { name: 'Mint', icon: Gem, color: 'text-orange-500' },
  burn: { name: 'Burn', icon: Coins, color: 'text-red-500' },
}

function formatUSD(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function OperationRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-20" />
      </div>
    </div>
  )
}

function SummaryBoxSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <Skeleton className="mx-auto mb-1 h-8 w-16" />
      <Skeleton className="mx-auto h-3 w-20" />
    </div>
  )
}

export function DeFiSection({ defi, loading }: DeFiSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="mt-1 h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <SummaryBoxSkeleton />
            <SummaryBoxSkeleton />
            <SummaryBoxSkeleton />
          </div>
          <div className="space-y-2">
            <OperationRowSkeleton />
            <OperationRowSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (defi.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="text-muted-foreground h-5 w-5" />
            DeFi Protection
          </CardTitle>
          <CardDescription>No DeFi transactions in this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            DeFi protection metrics will appear when your agent processes transactions
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalTxns = defi.reduce((sum, d) => sum + d.total_transactions, 0)
  const totalBlocked = defi.reduce((sum, d) => sum + d.blocked_count, 0)
  const totalValue = defi.reduce((sum, d) => sum + d.total_value_usd, 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-emerald-500" />
          DeFi Protection
        </CardTitle>
        <CardDescription>Transaction validation and risk prevention</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{totalTxns.toLocaleString()}</div>
            <div className="text-muted-foreground text-xs">Transactions</div>
          </div>
          <div className="rounded-lg bg-red-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-red-500">{totalBlocked.toLocaleString()}</div>
            <div className="text-muted-foreground text-xs">Blocked</div>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-emerald-500">{formatUSD(totalValue)}</div>
            <div className="text-muted-foreground text-xs">Value Protected</div>
          </div>
        </div>

        {/* Per operation */}
        <div className="space-y-2">
          {defi.map((stat) => {
            const config = operationConfig[stat.operation] || {
              name: stat.operation,
              icon: Wallet,
              color: 'text-gray-500',
            }
            const Icon = config.icon

            return (
              <div key={stat.operation} className="flex items-center justify-between p-2 text-sm">
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', config.color)} />
                  <span className="font-medium">{config.name}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">
                    {stat.total_transactions.toLocaleString()} txns
                  </span>
                  {stat.blocked_count > 0 && (
                    <span className="flex items-center gap-1 text-red-500">
                      <AlertTriangle className="h-3 w-3" />
                      {stat.blocked_count.toLocaleString()}
                    </span>
                  )}
                  <span className="text-muted-foreground min-w-[80px] text-right">
                    {formatUSD(stat.total_value_usd)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
