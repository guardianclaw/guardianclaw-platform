'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  TrendingUp,
  Users,
  UserPlus,
  Activity,
  AlertTriangle,
  Calendar,
  Target,
  Repeat,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

interface BusinessMetrics {
  growth: {
    users_total: number
    users_new_7d: number
    users_new_30d: number
    growth_rate_7d: number
    agents_total: number
    agents_new_7d: number
  }
  retention: {
    day_1: number | null
    day_7: number | null
    day_30: number | null
    note: string
  }
  engagement: {
    dau: number
    wau: number
    mau: number
    dau_mau_ratio: number
  }
  daily: Array<{
    date: string
    new_users: number
    active_users: number
    requests: number
  }>
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
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
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function SimpleLineChart({
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

function RetentionCard({
  retention,
  loading,
}: {
  retention: BusinessMetrics['retention'] | undefined
  loading: boolean
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const hasData = retention?.day_1 != null || retention?.day_7 != null || retention?.day_30 != null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Repeat className="h-5 w-5" />
          Retention
        </CardTitle>
        <CardDescription>User retention cohorts</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">
              {retention?.note || 'Retention data not available yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">D1</Badge>
                <span className="text-sm">Day 1 Retention</span>
              </div>
              <span className="text-xl font-bold">
                {retention?.day_1 != null ? `${retention.day_1}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">D7</Badge>
                <span className="text-sm">Day 7 Retention</span>
              </div>
              <span className="text-xl font-bold">
                {retention?.day_7 != null ? `${retention.day_7}%` : 'N/A'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline">D30</Badge>
                <span className="text-sm">Day 30 Retention</span>
              </div>
              <span className="text-xl font-bold">
                {retention?.day_30 != null ? `${retention.day_30}%` : 'N/A'}
              </span>
            </div>
            {retention?.note && (
              <p className="text-muted-foreground mt-2 text-xs">{retention.note}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminBusinessPage() {
  const { token } = useAuth()
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      if (!token) return

      try {
        const response = await fetch(`${API_URL}/admin/metrics/business`, {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Business</h2>
        <p className="text-muted-foreground">Growth, retention, and engagement metrics.</p>
      </div>

      {/* Growth Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={(metrics?.growth?.users_total ?? 0).toLocaleString()}
          subtitle={`+${metrics?.growth?.users_new_7d ?? 0} this week`}
          icon={Users}
          loading={loading}
        />
        <MetricCard
          title="New Users (30d)"
          value={(metrics?.growth?.users_new_30d ?? 0).toLocaleString()}
          subtitle={`${metrics?.growth?.growth_rate_7d?.toFixed(1) ?? 0}% weekly growth`}
          icon={UserPlus}
          loading={loading}
        />
        <MetricCard
          title="Total Agents"
          value={(metrics?.growth?.agents_total ?? 0).toLocaleString()}
          subtitle={`+${metrics?.growth?.agents_new_7d ?? 0} this week`}
          icon={Target}
          loading={loading}
        />
        <MetricCard
          title="DAU/MAU Ratio"
          value={`${((metrics?.engagement?.dau_mau_ratio ?? 0) * 100).toFixed(1)}%`}
          subtitle="User stickiness"
          icon={Activity}
          loading={loading}
        />
      </div>

      {/* Engagement & Retention */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Engagement
            </CardTitle>
            <CardDescription>Active user metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Daily Active Users (DAU)</span>
                  <span className="text-xl font-bold">
                    {(metrics?.engagement?.dau ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Weekly Active Users (WAU)</span>
                  <span className="text-xl font-bold">
                    {(metrics?.engagement?.wau ?? 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Monthly Active Users (MAU)</span>
                  <span className="text-xl font-bold">
                    {(metrics?.engagement?.mau ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <RetentionCard retention={metrics?.retention} loading={loading} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              New Users (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <SimpleLineChart data={metrics?.daily || []} dataKey="new_users" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Active Users (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <SimpleLineChart data={metrics?.daily || []} dataKey="active_users" color="blue" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Daily Breakdown
          </CardTitle>
          <CardDescription>Last 7 days of activity</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-48 w-full" />
          ) : metrics?.daily && metrics.daily.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Date</th>
                    <th className="py-2 text-right font-medium">New Users</th>
                    <th className="py-2 text-right font-medium">Active Users</th>
                    <th className="py-2 text-right font-medium">Requests</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.daily
                    .slice(-7)
                    .reverse()
                    .map((day) => (
                      <tr key={day.date} className="border-b last:border-0">
                        <td className="py-2">{new Date(day.date).toLocaleDateString()}</td>
                        <td className="py-2 text-right">{(day.new_users ?? 0).toLocaleString()}</td>
                        <td className="py-2 text-right">
                          {(day.active_users ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 text-right">{(day.requests ?? 0).toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">No daily data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
