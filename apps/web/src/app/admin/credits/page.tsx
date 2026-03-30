'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricCard } from '@/components/admin/metric-card'
import {
  useCreditsStats,
  useAllDeposits,
  useAllAdjustments,
  useLowBalanceUsers,
} from '@/hooks/use-admin-api'
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  Activity,
  Wallet,
  RefreshCw,
  ChevronRight,
} from 'lucide-react'

function formatCurrency(amount: number, decimals = 2): string {
  return `$${amount.toFixed(decimals)}`
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function TokenBadge({ token }: { token: string }) {
  const colors: Record<string, string> = {
    SOL: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    USDC: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    GCLAW: 'bg-claw-500/10 text-claw-500 border-claw-500/20',
  }

  return (
    <Badge variant="outline" className={colors[token] || ''}>
      {token}
    </Badge>
  )
}

function AdjustmentTypeBadge({ type }: { type: string }) {
  const config: Record<string, { color: string; label: string }> = {
    refund: { color: 'bg-blue-500/10 text-blue-500', label: 'Refund' },
    courtesy: { color: 'bg-green-500/10 text-green-500', label: 'Courtesy' },
    correction: { color: 'bg-yellow-500/10 text-yellow-500', label: 'Correction' },
    bonus: { color: 'bg-purple-500/10 text-purple-500', label: 'Bonus' },
    penalty: { color: 'bg-red-500/10 text-red-500', label: 'Penalty' },
  }

  const { color, label } = config[type] || { color: '', label: type }

  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

function BalanceWarningBadge({ balance, executions }: { balance: number; executions: number }) {
  if (executions < 10) {
    return (
      <Badge variant="destructive" className="text-xs">
        Critical
      </Badge>
    )
  }
  if (executions < 100) {
    return (
      <Badge
        variant="outline"
        className="border-yellow-500/20 bg-yellow-500/10 text-xs text-yellow-500"
      >
        Low
      </Badge>
    )
  }
  return null
}

export default function AdminCreditsPage() {
  const { data: statsData, isLoading: statsLoading, error: statsError } = useCreditsStats()
  const { data: depositsData, isLoading: depositsLoading } = useAllDeposits({ limit: 10 })
  const { data: adjustmentsData, isLoading: adjustmentsLoading } = useAllAdjustments({ limit: 10 })
  const { data: lowBalanceData, isLoading: lowBalanceLoading } = useLowBalanceUsers({
    threshold: 0.3,
    limit: 10,
  })

  const stats = statsData?.stats
  const config = statsData?.config

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Credits Management</h2>
          <p className="text-muted-foreground">Monitor and manage platform credit system</p>
        </div>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          {config && (
            <>
              <span>Cost: {formatCurrency(config.cost_per_execution, 3)}/exec</span>
              <span className="text-muted-foreground/50">|</span>
              <span>Min deposit: {formatCurrency(config.min_deposit_usd)}</span>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Balance"
          value={stats ? formatCurrency(stats.total_balance) : '-'}
          subtitle={`${stats?.active_accounts || 0} active accounts`}
          icon={Wallet}
          loading={statsLoading}
        />
        <MetricCard
          title="Revenue (30d)"
          value={stats ? formatCurrency(stats.revenue_30d) : '-'}
          subtitle={`${stats?.deposits_30d || 0} deposits`}
          icon={TrendingUp}
          variant="success"
          loading={statsLoading}
        />
        <MetricCard
          title="Total Spent"
          value={stats ? formatCurrency(stats.total_spent) : '-'}
          subtitle={`Avg: ${stats ? formatCurrency(stats.avg_balance) : '-'}/user`}
          icon={Activity}
          loading={statsLoading}
        />
        <MetricCard
          title="Low Balance"
          value={stats?.low_balance_accounts || 0}
          subtitle={`${stats?.zero_balance_accounts || 0} with zero balance`}
          icon={AlertTriangle}
          variant={stats && stats.low_balance_accounts > 10 ? 'warning' : 'default'}
          loading={statsLoading}
        />
      </div>

      {/* Revenue Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Last 24 Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats ? formatCurrency(stats.revenue_24h) : '-'}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {stats?.deposits_24h || 0} deposits
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">Last 7 Days</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {stats ? formatCurrency(stats.revenue_7d) : '-'}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {stats?.deposits_7d || 0} deposits
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Total Adjustments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div
                  className={`text-2xl font-bold ${(stats?.total_adjustments || 0) < 0 ? 'text-red-500' : ''}`}
                >
                  {stats ? formatCurrency(stats.total_adjustments) : '-'}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Refunds, courtesy credits, etc.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Details */}
      <Tabs defaultValue="deposits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="deposits">Recent Deposits</TabsTrigger>
          <TabsTrigger value="adjustments">Recent Adjustments</TabsTrigger>
          <TabsTrigger value="low-balance">Low Balance Users</TabsTrigger>
        </TabsList>

        {/* Deposits Tab */}
        <TabsContent value="deposits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Deposits</CardTitle>
                <CardDescription>Latest credit deposits across all users</CardDescription>
              </div>
              <Link href="/admin/credits/deposits">
                <Button variant="outline" size="sm">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {depositsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : depositsData?.deposits.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <Coins className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No deposits yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depositsData?.deposits.map((deposit) => (
                      <TableRow key={deposit.id}>
                        <TableCell>
                          <Link
                            href={`/admin/support/${deposit.wallet_address}`}
                            className="font-mono text-sm hover:underline"
                          >
                            {deposit.display_name || `${deposit.wallet_address.slice(0, 8)}...`}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <TokenBadge token={deposit.token} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {deposit.amount.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(deposit.credits_usd)}
                          {deposit.bonus_applied > 1 && (
                            <span className="ml-1 text-xs text-green-500">
                              +{((deposit.bonus_applied - 1) * 100).toFixed(0)}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(deposit.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Adjustments Tab */}
        <TabsContent value="adjustments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Adjustments</CardTitle>
                <CardDescription>Manual credit adjustments by admins</CardDescription>
              </div>
              <Link href="/admin/credits/adjustments">
                <Button variant="outline" size="sm">
                  View All
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {adjustmentsLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : adjustmentsData?.adjustments.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <RefreshCw className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No adjustments yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adjustmentsData?.adjustments.map((adj) => (
                      <TableRow key={adj.id}>
                        <TableCell>
                          <Link
                            href={`/admin/support/${adj.wallet_address}`}
                            className="font-mono text-sm hover:underline"
                          >
                            {adj.display_name || `${adj.wallet_address.slice(0, 8)}...`}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <AdjustmentTypeBadge type={adj.type} />
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${adj.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}
                        >
                          {adj.amount >= 0 ? '+' : ''}
                          {formatCurrency(adj.amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                          {adj.reason}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(adj.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Low Balance Tab */}
        <TabsContent value="low-balance">
          <Card>
            <CardHeader>
              <CardTitle>Low Balance Users</CardTitle>
              <CardDescription>
                Users with less than {lowBalanceData?.threshold_executions || 100} executions
                remaining
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lowBalanceLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : lowBalanceData?.users.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No users with low balance</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Executions Left</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                      <TableHead>Last Deposit</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lowBalanceData?.users.map((user) => (
                      <TableRow key={user.wallet_address}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/admin/support/${user.wallet_address}`}
                              className="font-mono text-sm hover:underline"
                            >
                              {user.display_name || `${user.wallet_address.slice(0, 8)}...`}
                            </Link>
                            <BalanceWarningBadge
                              balance={user.balance_usd}
                              executions={user.executions_remaining}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(user.balance_usd, 4)}
                        </TableCell>
                        <TableCell className="text-right">{user.executions_remaining}</TableCell>
                        <TableCell className="text-muted-foreground text-right">
                          {formatCurrency(user.total_spent)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {user.last_deposit_at
                            ? new Date(user.last_deposit_at).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/support/${user.wallet_address}`}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
