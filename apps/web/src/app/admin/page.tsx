'use client'

import { useOverviewMetrics } from '@/hooks/use-admin-api'
import { MetricCard, PlanBadge } from '@/components/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, Bot, Activity, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react'

export default function AdminOverviewPage() {
  const { data: metrics, isLoading, error } = useOverviewMetrics()

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
        <h2 className="text-2xl font-bold tracking-tight">Dashboard Overview</h2>
        <p className="text-muted-foreground">Platform health and key metrics at a glance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Users"
          value={(metrics?.users?.total ?? 0).toLocaleString()}
          subtitle={`${metrics?.users?.new_today ?? 0} new today`}
          icon={Users}
          loading={isLoading}
        />
        <MetricCard
          title="Active Users"
          value={(metrics?.users?.active ?? 0).toLocaleString()}
          subtitle="Users with activity today"
          icon={Activity}
          loading={isLoading}
        />
        <MetricCard
          title="Total Agents"
          value={(metrics?.agents?.total ?? 0).toLocaleString()}
          subtitle={`${metrics?.agents?.deployed ?? 0} deployed`}
          icon={Bot}
          loading={isLoading}
        />
        <MetricCard
          title="Active Alerts"
          value={metrics?.alerts?.active ?? 0}
          subtitle={`${metrics?.alerts?.critical ?? 0} critical`}
          icon={AlertTriangle}
          trend={metrics?.alerts?.critical ? 'down' : 'neutral'}
          variant={metrics?.alerts?.critical ? 'danger' : 'default'}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          title="Requests Today"
          value={(metrics?.requests?.today ?? 0).toLocaleString()}
          subtitle={`${metrics?.requests?.blocked_today ?? 0} blocked (${metrics?.requests?.block_rate ?? 0}%)`}
          icon={Activity}
          loading={isLoading}
        />
        <MetricCard
          title="MTD Revenue"
          value={`$${(metrics?.revenue?.mtd_usd ?? 0).toFixed(2)}`}
          subtitle="Month to date"
          icon={DollarSign}
          variant="success"
          loading={isLoading}
        />
        <MetricCard
          title="Estimated MRR"
          value={`$${(metrics?.revenue?.mrr_estimated ?? 0).toFixed(2)}`}
          subtitle="Monthly recurring revenue"
          icon={TrendingUp}
          loading={isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Users by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlanBadge plan="free" />
                  </div>
                  <span className="font-medium">{metrics?.users?.by_plan?.free ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlanBadge plan="starter" />
                  </div>
                  <span className="font-medium">{metrics?.users?.by_plan?.starter ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlanBadge plan="pro" />
                  </div>
                  <span className="font-medium">{metrics?.users?.by_plan?.pro ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Agent Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Deployed</span>
                  <span className="font-medium text-green-500">
                    {metrics?.agents?.deployed ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Draft/Testing</span>
                  <span className="font-medium">
                    {(metrics?.agents?.total ?? 0) - (metrics?.agents?.deployed ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">New Today</span>
                  <span className="font-medium">{metrics?.agents?.new_today ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Alert Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Active</span>
                  <span className="font-medium text-yellow-500">
                    {metrics?.alerts?.active ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Critical</span>
                  <span className="font-medium text-red-500">{metrics?.alerts?.critical ?? 0}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
