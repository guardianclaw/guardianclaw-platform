'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  AlertTriangle,
  CreditCard,
  Coins,
  BarChart3,
  Percent,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

interface FinancialMetrics {
  revenue: {
    mtd_usd: number
    last_month_usd: number
    growth_percent: number
  }
  subscriptions: {
    active: number
    mrr: number
    arr_estimated: number
    arpu: number | null
    churn_rate: number | null
    churn_note: string
  }
  by_plan: Record<string, { count: number; revenue_usd: number }>
  by_token: Record<string, { count: number; revenue_usd: number }>
  daily: Array<{
    date: string
    revenue_usd: number
    new_subs: number
  }>
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  loading,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  trend?: 'up' | 'down' | 'neutral'
  loading?: boolean
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="mb-1 h-8 w-20" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend && trend !== 'neutral' && (
            <div className={trend === 'up' ? 'text-green-500' : 'text-red-500'}>
              {trend === 'up' ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
            </div>
          )}
        </div>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function SimpleChart({
  data,
  dataKey,
}: {
  data: Array<{ [key: string]: unknown }>
  dataKey: string
}) {
  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
        No data
      </div>
    )
  }

  const values = data.map((d) => Number(d[dataKey]) || 0)
  const max = Math.max(...values, 1)

  return (
    <div className="flex h-24 items-end gap-0.5">
      {values.map((value, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-green-500/80"
          style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '2px' : '0' }}
        />
      ))}
    </div>
  )
}

function formatCurrency(value: number | undefined | null): string {
  const v = value ?? 0
  if (v >= 1000000) {
    return `$${(v / 1000000).toFixed(2)}M`
  } else if (v >= 1000) {
    return `$${(v / 1000).toFixed(2)}K`
  }
  return `$${v.toFixed(2)}`
}

export default function AdminFinancialPage() {
  const { token } = useAuth()
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      if (!token) return

      try {
        const response = await fetch(`${API_URL}/admin/metrics/financial`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch metrics')
        }

        const data = await response.json()
        setMetrics(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [token])

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="text-destructive mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  const plans = Object.entries(metrics?.by_plan || {})
  const tokens = Object.entries(metrics?.by_token || {})

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Financial</h2>
        <p className="text-muted-foreground">
          Revenue, subscriptions, and financial health metrics.
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="MTD Revenue"
          value={formatCurrency(metrics?.revenue.mtd_usd || 0)}
          subtitle={`${metrics?.revenue.growth_percent?.toFixed(1) || 0}% vs last month`}
          icon={DollarSign}
          trend={
            (metrics?.revenue.growth_percent || 0) > 0
              ? 'up'
              : (metrics?.revenue.growth_percent || 0) < 0
                ? 'down'
                : 'neutral'
          }
          loading={loading}
        />
        <MetricCard
          title="MRR"
          value={formatCurrency(metrics?.subscriptions.mrr || 0)}
          subtitle="Monthly Recurring Revenue"
          icon={TrendingUp}
          loading={loading}
        />
        <MetricCard
          title="ARR (Estimated)"
          value={formatCurrency(metrics?.subscriptions.arr_estimated || 0)}
          subtitle="Annual Recurring Revenue"
          icon={BarChart3}
          loading={loading}
        />
        <MetricCard
          title="Active Subscriptions"
          value={(metrics?.subscriptions?.active ?? 0).toLocaleString()}
          subtitle={
            metrics?.subscriptions.arpu != null
              ? `ARPU: ${formatCurrency(metrics.subscriptions.arpu)}`
              : 'ARPU: N/A'
          }
          icon={Users}
          loading={loading}
        />
      </div>

      {/* Churn & Revenue Chart */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Churn Rate
            </CardTitle>
            <CardDescription>Monthly subscription churn</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Current Churn Rate</span>
                  <span className="text-2xl font-bold">
                    {metrics?.subscriptions?.churn_rate != null
                      ? `${metrics.subscriptions.churn_rate.toFixed(2)}%`
                      : 'N/A'}
                  </span>
                </div>
                {metrics?.subscriptions?.churn_note && (
                  <p className="text-muted-foreground text-xs">
                    {metrics.subscriptions.churn_note}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Daily Revenue (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <SimpleChart data={metrics?.daily || []} dataKey="revenue_usd" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Plan & Token */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Revenue by Plan
            </CardTitle>
            <CardDescription>This month's revenue breakdown by subscription plan</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">No revenue data yet</div>
            ) : (
              <div className="space-y-4">
                {plans.map(([plan, data]) => (
                  <div
                    key={plan}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          plan === 'pro' ? 'default' : plan === 'starter' ? 'secondary' : 'outline'
                        }
                        className="capitalize"
                      >
                        {plan}
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        {data.count} subscription{data.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="font-bold text-green-500">
                      {formatCurrency(data.revenue_usd)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Revenue by Token
            </CardTitle>
            <CardDescription>This month's revenue breakdown by payment token</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">No revenue data yet</div>
            ) : (
              <div className="space-y-4">
                {tokens.map(([token, data]) => (
                  <div
                    key={token}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="uppercase">
                        {token}
                      </Badge>
                      <span className="text-muted-foreground text-sm">
                        {data.count} transaction{data.count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="font-bold text-green-500">
                      {formatCurrency(data.revenue_usd)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Month Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Month Over Month</CardTitle>
          <CardDescription>Revenue comparison with last month</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-muted-foreground mb-2 text-sm">Last Month</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(metrics?.revenue.last_month_usd || 0)}
                </p>
              </div>
              <div className="rounded-lg bg-green-500/10 p-4 text-center">
                <p className="text-muted-foreground mb-2 text-sm">This Month (MTD)</p>
                <p className="text-3xl font-bold text-green-500">
                  {formatCurrency(metrics?.revenue.mtd_usd || 0)}
                </p>
                {(metrics?.revenue.growth_percent || 0) !== 0 && (
                  <Badge
                    variant={(metrics?.revenue.growth_percent || 0) > 0 ? 'default' : 'destructive'}
                    className="mt-2"
                  >
                    {(metrics?.revenue.growth_percent || 0) > 0 ? '+' : ''}
                    {metrics?.revenue.growth_percent?.toFixed(1)}%
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
