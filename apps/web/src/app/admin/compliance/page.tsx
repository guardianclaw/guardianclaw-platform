'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ComplianceStatsCards,
  RequestTypeBreakdown,
  GdprRequestsTable,
} from '@/components/admin/compliance'
import {
  useComplianceStats,
  useGdprRequestsList,
  useDeletionAuditList,
} from '@/hooks/use-admin-api'
import { FileText, Trash2, ArrowRight, Clock } from 'lucide-react'

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export default function AdminCompliancePage() {
  const { data: statsData, isLoading: statsLoading } = useComplianceStats()
  const { data: requestsData, isLoading: requestsLoading } = useGdprRequestsList({
    limit: 5,
    status: 'pending',
    order_by: 'created_at',
    order_dir: 'desc',
  })
  const { data: deletionsData, isLoading: deletionsLoading } = useDeletionAuditList({
    limit: 5,
    order_by: 'deletion_date',
    order_dir: 'desc',
  })

  const stats = statsData?.stats
  const pendingRequests = requestsData?.requests || []
  const recentDeletions = deletionsData?.deletions || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Compliance</h2>
          <p className="text-muted-foreground">GDPR requests management and deletion audit</p>
        </div>
      </div>

      {/* Stats Cards */}
      <ComplianceStatsCards stats={stats} isLoading={statsLoading} />

      {/* Quick Stats */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Request Type Breakdown */}
        <RequestTypeBreakdown byType={stats?.by_request_type || {}} isLoading={statsLoading} />

        {/* Performance Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Performance Metrics
            </CardTitle>
            <CardDescription>Processing time and efficiency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {statsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                  <span className="text-sm">Avg. Completion Time</span>
                  <span className="font-bold">
                    {stats?.avg_completion_hours
                      ? `${stats.avg_completion_hours.toFixed(1)} hours`
                      : 'N/A'}
                  </span>
                </div>
                <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                  <span className="text-sm">Requests (30 days)</span>
                  <span className="font-bold">{stats?.requests_30d || 0}</span>
                </div>
                <div className="bg-muted flex items-center justify-between rounded-lg p-3">
                  <span className="text-sm">Deletions (30 days)</span>
                  <span className="font-bold">{stats?.deletions_30d || 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Access Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending Requests */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Pending Requests
              </CardTitle>
              <CardDescription>GDPR requests awaiting action</CardDescription>
            </div>
            <Link href="/admin/compliance/requests">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No pending requests</p>
              </div>
            ) : (
              <GdprRequestsTable
                requests={pendingRequests}
                isLoading={false}
                emptyMessage="No pending requests"
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Deletions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Trash2 className="h-4 w-4" />
                Recent Deletions
              </CardTitle>
              <CardDescription>Latest data deletion audit records</CardDescription>
            </div>
            <Link href="/admin/compliance/deletions">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {deletionsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentDeletions.length === 0 ? (
              <div className="text-muted-foreground py-8 text-center">
                <Trash2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p className="text-sm">No deletion records</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentDeletions.map((deletion) => (
                  <div
                    key={deletion.id}
                    className="bg-muted flex items-center justify-between rounded-lg p-3"
                  >
                    <div>
                      <p className="font-mono text-sm">{deletion.wallet_hash.slice(0, 8)}...</p>
                      <p className="text-muted-foreground text-xs">
                        {deletion.data_categories.length} categories
                      </p>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {new Date(deletion.deletion_date).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
