'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import type { ComplianceStats } from '@/hooks/use-admin-api'
import { FileText, Clock, CheckCircle, XCircle, Trash2, Timer } from 'lucide-react'

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

interface StatsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  loading?: boolean
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
  variant = 'default',
}: StatsCardProps) {
  const variantStyles = {
    default: 'text-muted-foreground',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    danger: 'text-red-500',
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <div className={`bg-muted rounded-lg p-2.5 ${variantStyles[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface ComplianceStatsCardsProps {
  stats: ComplianceStats | undefined
  isLoading: boolean
}

export function ComplianceStatsCards({ stats, isLoading }: ComplianceStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <StatsCard
        title="Total Requests"
        value={stats ? formatNumber(stats.total_requests) : '-'}
        subtitle={`${stats?.requests_7d || 0} this week`}
        icon={FileText}
        loading={isLoading}
      />
      <StatsCard
        title="Pending"
        value={stats?.pending_requests || 0}
        subtitle="Awaiting action"
        icon={Clock}
        loading={isLoading}
        variant={stats && stats.pending_requests > 0 ? 'warning' : 'default'}
      />
      <StatsCard
        title="In Progress"
        value={stats?.in_progress_requests || 0}
        subtitle="Being processed"
        icon={Timer}
        loading={isLoading}
      />
      <StatsCard
        title="Completed"
        value={stats?.completed_requests || 0}
        subtitle="Successfully processed"
        icon={CheckCircle}
        loading={isLoading}
        variant="success"
      />
      <StatsCard
        title="Rejected"
        value={stats?.rejected_requests || 0}
        subtitle="Could not process"
        icon={XCircle}
        loading={isLoading}
        variant={stats && stats.rejected_requests > 0 ? 'danger' : 'default'}
      />
      <StatsCard
        title="Total Deletions"
        value={stats ? formatNumber(stats.total_deletions) : '-'}
        subtitle={`${stats?.deletions_7d || 0} this week`}
        icon={Trash2}
        loading={isLoading}
      />
    </div>
  )
}

interface RequestTypeBreakdownProps {
  byType: Record<string, number>
  isLoading: boolean
}

export function RequestTypeBreakdown({ byType, isLoading }: RequestTypeBreakdownProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const total = Object.values(byType).reduce((sum, count) => sum + count, 0)

  if (total === 0) {
    return null
  }

  const typeLabels: Record<string, string> = {
    export: 'Data Export',
    deletion: 'Data Deletion',
    access: 'Data Access',
    rectification: 'Data Rectification',
  }

  const typeColors: Record<string, string> = {
    export: 'bg-blue-500',
    deletion: 'bg-red-500',
    access: 'bg-green-500',
    rectification: 'bg-yellow-500',
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Requests by Type</CardTitle>
        <CardDescription>Distribution of GDPR request types</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(byType).map(([type, count]) => {
          const percentage = total > 0 ? (count / total) * 100 : 0
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{typeLabels[type] || type}</span>
                <span className="font-medium">{count}</span>
              </div>
              <div className="bg-muted h-2 overflow-hidden rounded-full">
                <div
                  className={`h-full ${typeColors[type] || 'bg-gray-500'} transition-all`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
