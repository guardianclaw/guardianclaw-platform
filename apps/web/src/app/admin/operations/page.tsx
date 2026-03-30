'use client'

import { useOperationsMetrics } from '@/hooks/use-admin-api'
import {
  MetricCard,
  SimpleChart,
  HealthStatusBadge,
  TrendIndicator,
  formatters,
  labelFormatters,
} from '@/components/admin'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, AlertTriangle, Clock, Zap } from 'lucide-react'

export default function AdminOperationsPage() {
  const { data: metrics, isLoading, error } = useOperationsMetrics()

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="text-destructive mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Operations</h2>
        <p className="text-muted-foreground">Real-time system health and performance metrics.</p>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>System Health</span>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <HealthStatusBadge status={metrics?.health.status || 'healthy'} />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-sm">Uptime</p>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <p className="text-2xl font-bold">
                  {metrics?.health.uptime_percent != null
                    ? `${metrics.health.uptime_percent}%`
                    : 'N/A'}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Last Incident</p>
              {isLoading ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <p className="text-lg font-medium">
                  {metrics?.health.last_incident
                    ? new Date(metrics.health.last_incident).toLocaleDateString()
                    : 'None'}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Status Since</p>
              <p className="text-lg font-medium">Just now</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Latency & Throughput */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Latency
            </CardTitle>
            <CardDescription>Response time metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Average</span>
                  <span className="text-2xl font-bold">
                    {metrics?.latency.current_avg_ms || 0}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">P95</span>
                  <span className="text-2xl font-bold">
                    {metrics?.latency.current_p95_ms || 0}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Trend</span>
                  <TrendIndicator trend={metrics?.latency.trend || 'stable'} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Throughput
            </CardTitle>
            <CardDescription>Request volume metrics</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Current RPM</span>
                  <span className="text-2xl font-bold">
                    {metrics?.throughput.requests_per_minute || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground text-sm">Peak RPM Today</span>
                  <span className="text-2xl font-bold">
                    {metrics?.throughput.peak_rpm_today || 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Errors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Errors
          </CardTitle>
          <CardDescription>Error rates and distribution</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-sm">Error Rate</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p
                  className={`text-2xl font-bold ${(metrics?.errors.rate_percent || 0) > 5 ? 'text-red-500' : ''}`}
                >
                  {metrics?.errors.rate_percent || 0}%
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Errors Today</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{metrics?.errors.count_today || 0}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">4xx Errors</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{metrics?.errors.by_type?.['4xx'] || 0}</p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground text-sm">5xx Errors</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold text-red-500">
                  {metrics?.errors.by_type?.['5xx'] || 0}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hourly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Requests (Last 24 Hours)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <SimpleChart
              data={metrics?.hourly || []}
              dataKey="requests"
              labelKey="hour"
              color="claw"
              height={128}
              maxItems={24}
              formatValue={formatters.compact}
              formatLabel={labelFormatters.hour}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
