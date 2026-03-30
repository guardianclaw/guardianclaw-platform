'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Shield,
  AlertTriangle,
  Ban,
  Lock,
  Key,
  ShieldAlert,
  ShieldCheck,
  Activity,
  AlertCircle,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

interface SecurityMetrics {
  summary: {
    blocked_requests_24h: number
    rate_limit_hits_24h: number
    auth_failures_24h: number
    active_alerts: number
    critical_alerts: number
  }
  claw: {
    blocks_by_gate: {
      credibility: number
      avoidance: number
      limits: number
      worth: number
    }
    total_blocks: number
    block_rate_percent: number
  }
  threats: {
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    top_blocked_ips: Array<{ ip_hash: string; count: number }>
    note: string
  }
  alerts: Array<{
    id: string
    severity: string
    title: string
    created_at: string
  }>
  hourly: Array<{
    hour: string
    blocks: number
    rate_limits: number
    auth_failures: number
  }>
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  loading,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'warning' | 'danger'
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

  const colorClass =
    variant === 'danger' ? 'text-red-500' : variant === 'warning' ? 'text-yellow-500' : ''

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${colorClass || 'text-muted-foreground'}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
        {subtitle && <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>}
      </CardContent>
    </Card>
  )
}

function SimpleChart({
  data,
  dataKey,
  color = 'red',
}: {
  data: Array<{ [key: string]: unknown }>
  dataKey: string
  color?: string
}) {
  if (!data || data.length === 0) {
    return (
      <div className="text-muted-foreground flex h-20 items-center justify-center text-sm">
        No data
      </div>
    )
  }

  const values = data.map((d) => Number(d[dataKey]) || 0)
  const max = Math.max(...values, 1)
  const colorClass =
    color === 'red' ? 'bg-red-500/80' : color === 'yellow' ? 'bg-yellow-500/80' : 'bg-blue-500/80'

  return (
    <div className="flex h-20 items-end gap-0.5">
      {values.slice(-24).map((value, i) => (
        <div
          key={i}
          className={`flex-1 ${colorClass} rounded-t`}
          style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? '2px' : '0' }}
        />
      ))}
    </div>
  )
}

function RiskBadge({ level }: { level: string }) {
  const config: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    low: { variant: 'outline', label: 'Low' },
    medium: { variant: 'secondary', label: 'Medium' },
    high: { variant: 'default', label: 'High' },
    critical: { variant: 'destructive', label: 'Critical' },
  }

  const { variant, label } = config[level] || { variant: 'outline', label: level }

  return <Badge variant={variant}>{label}</Badge>
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<
    string,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline'
      icon: React.ComponentType<{ className?: string }>
    }
  > = {
    info: { variant: 'outline', icon: AlertCircle },
    warning: { variant: 'secondary', icon: AlertTriangle },
    critical: { variant: 'destructive', icon: ShieldAlert },
  }

  const { variant, icon: Icon } = config[severity] || { variant: 'outline', icon: AlertCircle }

  return (
    <Badge variant={variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {severity}
    </Badge>
  )
}

export default function AdminSecurityPage() {
  const { token } = useAuth()
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMetrics() {
      if (!token) return

      try {
        const response = await fetch(`${API_URL}/admin/metrics/security`, {
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
    const interval = setInterval(fetchMetrics, 60000) // Refresh every minute
    return () => clearInterval(interval)
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

  const clawGates = metrics?.claw.blocks_by_gate || {
    credibility: 0,
    avoidance: 0,
    limits: 0,
    worth: 0,
  }
  const totalGuardianClawBlocks = Object.values(clawGates).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Security</h2>
        <p className="text-muted-foreground">
          Security events, threat monitoring, and GuardianClaw gate activity.
        </p>
      </div>

      {/* Risk Level Banner */}
      {!loading && metrics?.threats && (
        <Card
          className={
            metrics.threats.risk_level === 'critical'
              ? 'border-red-500 bg-red-500/5'
              : metrics.threats.risk_level === 'high'
                ? 'border-yellow-500 bg-yellow-500/5'
                : ''
          }
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield
                  className={`h-6 w-6 ${
                    metrics.threats.risk_level === 'critical'
                      ? 'text-red-500'
                      : metrics.threats.risk_level === 'high'
                        ? 'text-yellow-500'
                        : 'text-green-500'
                  }`}
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Current Threat Level</span>
                    <RiskBadge level={metrics.threats.risk_level} />
                  </div>
                  <p className="text-muted-foreground text-sm">{metrics.threats.note}</p>
                </div>
              </div>
              {(metrics.summary?.critical_alerts ?? 0) > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {metrics.summary?.critical_alerts} Critical Alert
                  {(metrics.summary?.critical_alerts ?? 0) > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Blocked Requests (24h)"
          value={(metrics?.summary?.blocked_requests_24h ?? 0).toLocaleString()}
          subtitle={`${metrics?.claw?.block_rate_percent?.toFixed(2) ?? 0}% of total`}
          icon={Ban}
          variant={(metrics?.summary?.blocked_requests_24h ?? 0) > 100 ? 'warning' : 'default'}
          loading={loading}
        />
        <MetricCard
          title="Rate Limit Hits (24h)"
          value={(metrics?.summary?.rate_limit_hits_24h ?? 0).toLocaleString()}
          subtitle="API throttle events"
          icon={Lock}
          loading={loading}
        />
        <MetricCard
          title="Auth Failures (24h)"
          value={(metrics?.summary?.auth_failures_24h ?? 0).toLocaleString()}
          subtitle="Failed authentication attempts"
          icon={Key}
          variant={(metrics?.summary?.auth_failures_24h ?? 0) > 50 ? 'danger' : 'default'}
          loading={loading}
        />
        <MetricCard
          title="Active Alerts"
          value={metrics?.summary?.active_alerts ?? 0}
          subtitle={`${metrics?.summary?.critical_alerts ?? 0} critical`}
          icon={AlertTriangle}
          variant={(metrics?.summary?.critical_alerts ?? 0) > 0 ? 'danger' : 'default'}
          loading={loading}
        />
      </div>

      {/* GuardianClaw Gate Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            GuardianClaw Gate Activity (24h)
          </CardTitle>
          <CardDescription>Blocks by CLAW gate</CardDescription>
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
              {(['credibility', 'avoidance', 'limits', 'worth'] as const).map((gate) => {
                const count = clawGates[gate] ?? 0
                const percent =
                  totalGuardianClawBlocks > 0 ? (count / totalGuardianClawBlocks) * 100 : 0
                return (
                  <div key={gate} className="bg-muted/50 rounded-lg p-4 text-center">
                    <p className="text-muted-foreground mb-1 text-sm capitalize">{gate} Gate</p>
                    <p className="text-2xl font-bold">{count.toLocaleString()}</p>
                    <p className="text-muted-foreground text-xs">{percent.toFixed(1)}% of blocks</p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5" />
              Blocked Requests (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <SimpleChart data={metrics?.hourly || []} dataKey="blocks" color="red" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Auth Failures (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <SimpleChart data={metrics?.hourly || []} dataKey="auth_failures" color="yellow" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Alerts
          </CardTitle>
          <CardDescription>Recent security alerts requiring attention</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : metrics?.alerts && metrics.alerts.length > 0 ? (
            <div className="space-y-3">
              {metrics.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <SeverityBadge severity={alert.severity} />
                    <span className="font-medium">{alert.title}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {new Date(alert.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <ShieldCheck className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No active alerts</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
