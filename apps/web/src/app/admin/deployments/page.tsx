'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MetricCard } from '@/components/admin/metric-card'
import { Pagination } from '@/components/admin/pagination'
import { DeploymentsTable } from '@/components/admin/deployments'
import { useDeploymentsStats, useDeploymentsList } from '@/hooks/use-admin-api'
import { Rocket, Activity, AlertTriangle, Zap, X, Globe } from 'lucide-react'

const ITEMS_PER_PAGE = 20

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export default function AdminDeploymentsPage() {
  const [page, setPage] = useState(0)
  const [environment, setEnvironment] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [suspended, setSuspended] = useState<string>('')
  const [activeOnly, setActiveOnly] = useState<string>('')

  const { data: statsData, isLoading: statsLoading } = useDeploymentsStats()
  const { data: deploymentsData, isLoading: deploymentsLoading } = useDeploymentsList({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    environment: environment || undefined,
    status: status as 'pending' | 'deployed' | 'stopped' | 'failed' | undefined,
    suspended: suspended ? suspended === 'true' : undefined,
    active_only: activeOnly ? activeOnly === 'true' : undefined,
  })

  const stats = statsData?.stats
  const deployments = deploymentsData?.deployments || []
  const total = deploymentsData?.pagination.total || 0

  const hasFilters = environment || status || suspended || activeOnly

  const clearFilters = () => {
    setEnvironment('')
    setStatus('')
    setSuspended('')
    setActiveOnly('')
    setPage(0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Deployments Management</h2>
          <p className="text-muted-foreground">
            Monitor and manage all deployments on the platform
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Deployments"
          value={stats ? formatNumber(stats.total_deployments) : '-'}
          subtitle={`${stats?.created_7d || 0} new this week`}
          icon={Rocket}
          loading={statsLoading}
        />
        <MetricCard
          title="Active Deployments"
          value={stats ? formatNumber(stats.active_deployments) : '-'}
          subtitle="Running in production"
          icon={Activity}
          variant="success"
          loading={statsLoading}
        />
        <MetricCard
          title="Suspended"
          value={stats?.suspended_deployments || 0}
          subtitle="Requires attention"
          icon={AlertTriangle}
          variant={stats && stats.suspended_deployments > 0 ? 'warning' : 'default'}
          loading={statsLoading}
        />
        <MetricCard
          title="Created (30d)"
          value={stats?.created_30d || 0}
          subtitle="Growth this month"
          icon={Zap}
          loading={statsLoading}
        />
      </div>

      {/* Environment Breakdown */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          {Object.entries(stats.by_environment).map(([env, count]) => (
            <Card key={env}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="text-muted-foreground h-4 w-4" />
                    <span className="capitalize">{env}</span>
                  </div>
                  <span className="text-2xl font-bold">{count}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">All Deployments</CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Select
              value={environment || 'all'}
              onValueChange={(v) => {
                setEnvironment(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={status || 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="deployed">Deployed</SelectItem>
                <SelectItem value="stopped">Stopped</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={suspended || 'all'}
              onValueChange={(v) => {
                setSuspended(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Suspended" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Suspended Only</SelectItem>
                <SelectItem value="false">Active Only</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={activeOnly || 'all'}
              onValueChange={(v) => {
                setActiveOnly(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Active Only" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Active Only</SelectItem>
                <SelectItem value="false">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DeploymentsTable
            deployments={deployments}
            isLoading={deploymentsLoading}
            showFiltersHint={!!hasFilters}
          />

          {/* Pagination */}
          {total > ITEMS_PER_PAGE && (
            <div className="flex justify-center pt-4">
              <Pagination
                page={page}
                limit={ITEMS_PER_PAGE}
                total={total}
                onPageChange={setPage}
                showLimitSelector={false}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
