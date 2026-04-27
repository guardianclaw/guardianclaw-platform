'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  BarChart3,
  Bot,
  Activity,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Gauge,
  Layers,
  Shield,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

interface AnalyticsMetrics {
  capacity: {
    avg_daily_requests: number
    peak_daily_requests: number
    growth_rate_percent: number
    note: string
  }
  usage: {
    total_requests_30d: number
    total_blocked_30d: number
    block_rate_percent: number
  }
  claw_stats: {
    agents_with_claw: number
    total_agents: number
    adoption_percent: number
    blocks_per_agent_avg: number
  }
  top_agents: Array<{
    id: string
    name: string
    framework: string | null
    requests: number
    blocked: number
  }>
  by_framework: Record<string, { count: number; requests: number }>
  daily: Array<{
    date: string
    requests: number
    blocked: number
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
  color = 'claw',
}: {
  data: Array<{ [key: string]: unknown }>
  dataKey: string
  color?: string
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
  const colorClass = color === 'claw' ? 'bg-claw-500/80' : 'bg-blue-500/80'

  return (
    <div className="flex h-24 items-end gap-0.5">
      {values.slice(-30).map((value, i) => (
        <div
          key={i}
          className={`flex-1 ${colorClass} rounded-t`}
          style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '2px' : '0' }}
        />
      ))}
    </div>
  )
}

function formatNumber(value: number | undefined | null): string {
  const v = value ?? 0
  if (v >= 1000000) {
    return `${(v / 1000000).toFixed(2)}M`
  } else if (v >= 1000) {
    return `${(v / 1000).toFixed(1)}K`
  }
  return v.toLocaleString()
}

export default function AdminAnalyticsPage() {
  const { isAuthenticated } = useAuth()
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      if (!isAuthenticated) return

      try {
        const response = await fetch(`${API_URL}/admin/metrics/analytics`, {
          credentials: 'include',
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
  }, [isAuthenticated])

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

  const frameworks = Object.entries(metrics?.by_framework || {})

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-muted-foreground">
          Usage analytics, capacity planning, and GuardianClaw adoption.
        </p>
      </div>

      {/* Capacity Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Requests (30d)"
          value={formatNumber(metrics?.usage.total_requests_30d || 0)}
          subtitle={`${metrics?.usage.block_rate_percent?.toFixed(2) || 0}% blocked`}
          icon={Activity}
          loading={loading}
        />
        <MetricCard
          title="Avg Daily Requests"
          value={formatNumber(metrics?.capacity.avg_daily_requests || 0)}
          subtitle={`Peak: ${formatNumber(metrics?.capacity.peak_daily_requests || 0)}`}
          icon={BarChart3}
          loading={loading}
        />
        <MetricCard
          title="Growth Rate"
          value={`${metrics?.capacity.growth_rate_percent?.toFixed(1) || 0}%`}
          subtitle="Week over week"
          icon={TrendingUp}
          trend={
            (metrics?.capacity.growth_rate_percent || 0) > 0
              ? 'up'
              : (metrics?.capacity.growth_rate_percent || 0) < 0
                ? 'down'
                : 'neutral'
          }
          loading={loading}
        />
        <MetricCard
          title="GuardianClaw Adoption"
          value={`${metrics?.claw_stats.adoption_percent?.toFixed(0) || 0}%`}
          subtitle={`${metrics?.claw_stats.agents_with_claw || 0}/${metrics?.claw_stats.total_agents || 0} agents`}
          icon={Shield}
          loading={loading}
        />
      </div>

      {/* Capacity Note */}
      {!loading && metrics?.capacity?.note && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Gauge className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground text-sm">{metrics.capacity.note}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Daily Requests (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <SimpleChart data={metrics?.daily || []} dataKey="requests" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Blocked Requests (30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <SimpleChart data={metrics?.daily || []} dataKey="blocked" color="blue" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Agents & Framework Distribution */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Top Agents by Usage
            </CardTitle>
            <CardDescription>Most active agents in the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : metrics?.top_agents && metrics.top_agents.length > 0 ? (
              <div className="space-y-3">
                {metrics.top_agents.slice(0, 5).map((agent, i) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground w-4 text-sm">{i + 1}</span>
                      <div>
                        <p className="font-medium">{agent.name}</p>
                        <p className="text-muted-foreground text-xs">
                          {agent.framework || 'No framework'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{formatNumber(agent.requests)}</p>
                      <p className="text-muted-foreground text-xs">{agent.blocked} blocked</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No agent usage data</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Usage by Framework
            </CardTitle>
            <CardDescription>Request distribution by agent framework</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : frameworks.length > 0 ? (
              <div className="space-y-3">
                {frameworks.map(([framework, data]) => {
                  const totalRequests = metrics?.usage?.total_requests_30d || 1
                  const requests = data?.requests ?? 0
                  const count = data?.count ?? 0
                  const percent = (requests / totalRequests) * 100
                  return (
                    <div
                      key={framework}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {framework || 'Unknown'}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                          {count} agent{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatNumber(requests)}</p>
                        <p className="text-muted-foreground text-xs">
                          {percent.toFixed(1)}% of total
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-muted-foreground py-8 text-center">
                <Layers className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p>No framework data</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* GuardianClaw Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            GuardianClaw Statistics
          </CardTitle>
          <CardDescription>Safety gate performance and adoption</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-muted-foreground mb-1 text-sm">Total Agents</p>
                <p className="text-2xl font-bold">{metrics?.claw_stats.total_agents || 0}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-muted-foreground mb-1 text-sm">With GuardianClaw</p>
                <p className="text-2xl font-bold text-green-500">
                  {metrics?.claw_stats.agents_with_claw || 0}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-muted-foreground mb-1 text-sm">Adoption Rate</p>
                <p className="text-2xl font-bold">
                  {metrics?.claw_stats.adoption_percent?.toFixed(0) || 0}%
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-muted-foreground mb-1 text-sm">Avg Blocks/Agent</p>
                <p className="text-2xl font-bold">
                  {metrics?.claw_stats.blocks_per_agent_avg?.toFixed(1) || 0}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
