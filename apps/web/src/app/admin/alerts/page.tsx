'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAlerts, useAdminMutation, invalidateAdminCache, Alert } from '@/hooks/use-admin-api'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { SeverityBadge, AlertStatusBadge, Pagination } from '@/components/admin'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  Settings,
  ShieldAlert,
} from 'lucide-react'

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <ShieldAlert className="h-5 w-5 text-red-500" />
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />
    default:
      return <Bell className="h-5 w-5 text-blue-500" />
  }
}

function getTimeSince(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  isUpdating,
  canManage,
}: {
  alert: Alert
  onAcknowledge: () => void
  onResolve: () => void
  isUpdating: boolean
  canManage: boolean
}) {
  const createdAt = new Date(alert.created_at)
  const timeSince = getTimeSince(createdAt)

  return (
    <Card
      className={
        alert.severity === 'critical' && alert.status === 'active'
          ? 'border-red-500 bg-red-500/5'
          : alert.severity === 'warning' && alert.status === 'active'
            ? 'border-yellow-500 bg-yellow-500/5'
            : ''
      }
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <SeverityIcon severity={alert.severity} />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{alert.title}</span>
                <SeverityBadge severity={alert.severity} />
                <AlertStatusBadge status={alert.status} />
              </div>
              <p className="text-muted-foreground text-sm">{alert.message}</p>
              <div className="text-muted-foreground flex items-center gap-4 text-xs">
                <span>Value: {(alert.metric_value ?? 0).toFixed(2)}</span>
                <span>Threshold: {(alert.threshold_value ?? 0).toFixed(2)}</span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {timeSince}
                </span>
              </div>
              {alert.acknowledged_at && (
                <p className="text-muted-foreground text-xs">
                  Acknowledged {new Date(alert.acknowledged_at).toLocaleString()}
                </p>
              )}
              {alert.resolved_at && (
                <p className="text-muted-foreground text-xs">
                  Resolved {new Date(alert.resolved_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          {canManage && alert.status !== 'resolved' && (
            <div className="flex flex-shrink-0 gap-2">
              {alert.status === 'active' && (
                <Button variant="outline" size="sm" onClick={onAcknowledge} disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Clock className="mr-1 h-4 w-4" />
                      Acknowledge
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={onResolve}
                disabled={isUpdating}
                className="bg-green-600 hover:bg-green-700"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="mr-1 h-4 w-4" />
                    Resolve
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminAlertsPage() {
  const { hasPermission } = useAdminAuth()
  const { mutateAsync } = useAdminMutation()

  const [filter, setFilter] = useState<'active' | 'acknowledged' | 'resolved' | undefined>('active')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, isLoading, error, mutate } = useAlerts(filter, page, limit)

  const canManageAlerts = hasPermission('manage_alerts')
  const alerts = data?.alerts || []
  const total = data?.total || 0

  const activeCount = filter === 'active' ? total : 0
  const criticalCount = alerts.filter(
    (a) => a.severity === 'critical' && a.status === 'active'
  ).length

  const handleUpdateStatus = async (alertId: string, status: 'acknowledged' | 'resolved') => {
    setActionError(null)
    setUpdatingId(alertId)

    try {
      await mutateAsync(`/admin/alerts/${alertId}`, {
        method: 'PATCH',
        data: { status },
      })

      invalidateAdminCache('/admin/alerts')
      mutate()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setUpdatingId(null)
    }
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    setPage(1) // Reset to first page when changing limit
  }

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter === 'all' ? undefined : (newFilter as typeof filter))
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Alerts</h2>
          <p className="text-muted-foreground">Monitor and manage system alerts.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/alerts/rules">
              <Settings className="mr-2 h-4 w-4" />
              Manage Rules
            </Link>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Active Alerts</p>
                <p className="text-2xl font-bold">{filter === 'active' ? total : '-'}</p>
              </div>
              <Bell
                className={`h-8 w-8 ${activeCount > 0 ? 'text-yellow-500' : 'text-muted-foreground'}`}
              />
            </div>
          </CardContent>
        </Card>
        <Card className={criticalCount > 0 ? 'border-red-500' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Critical</p>
                <p className={`text-2xl font-bold ${criticalCount > 0 ? 'text-red-500' : ''}`}>
                  {criticalCount}
                </p>
              </div>
              <ShieldAlert
                className={`h-8 w-8 ${criticalCount > 0 ? 'text-red-500' : 'text-muted-foreground'}`}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Showing</p>
                <p className="text-2xl font-bold">
                  {alerts.length} of {total}
                </p>
              </div>
              <Bell className="text-muted-foreground h-8 w-8" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error State */}
      {(error || actionError) && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>{error?.message || actionError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={filter || 'all'} onValueChange={handleFilterChange}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Bell className="h-4 w-4" />
            Active
          </TabsTrigger>
          <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>

        <TabsContent value={filter || 'all'} className="mt-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="h-5 w-5" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                <h3 className="mb-1 font-medium">No alerts</h3>
                <p className="text-muted-foreground text-sm">
                  {filter === 'active'
                    ? 'All systems operating normally'
                    : `No ${filter || ''} alerts found`}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <AlertCard
                    key={alert.id}
                    alert={alert}
                    onAcknowledge={() => handleUpdateStatus(alert.id, 'acknowledged')}
                    onResolve={() => handleUpdateStatus(alert.id, 'resolved')}
                    isUpdating={updatingId === alert.id}
                    canManage={canManageAlerts}
                  />
                ))}
              </div>

              {/* Pagination */}
              {total > limit && (
                <Pagination
                  page={page}
                  limit={limit}
                  total={total}
                  onPageChange={handlePageChange}
                  onLimitChange={handleLimitChange}
                  showLimitSelector={true}
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
