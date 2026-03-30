'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MetricCard } from '@/components/admin/metric-card'
import { Pagination } from '@/components/admin/pagination'
import { AgentsTable, AgentFilters } from '@/components/admin/agents'
import { useAgentsStats, useAgentsList } from '@/hooks/use-admin-api'
import { Bot, Activity, AlertTriangle, Zap } from 'lucide-react'

const ITEMS_PER_PAGE = 20

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export default function AdminAgentsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [framework, setFramework] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [suspended, setSuspended] = useState<string>('')

  const { data: statsData, isLoading: statsLoading } = useAgentsStats()
  const { data: agentsData, isLoading: agentsLoading } = useAgentsList({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    search: search || undefined,
    framework: framework || undefined,
    status: status as 'draft' | 'testing' | 'deployed' | 'archived' | undefined,
    suspended: suspended ? suspended === 'true' : undefined,
    order_by: 'created_at',
    order_dir: 'desc',
  })

  const stats = statsData?.stats
  const agents = agentsData?.agents || []
  const total = agentsData?.pagination.total || 0
  const frameworks = statsData?.frameworks || []

  const hasFilters = search || framework || status || suspended

  const clearFilters = () => {
    setSearch('')
    setFramework('')
    setStatus('')
    setSuspended('')
    setPage(0)
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(0)
  }

  const handleFrameworkChange = (value: string) => {
    setFramework(value)
    setPage(0)
  }

  const handleStatusChange = (value: string) => {
    setStatus(value)
    setPage(0)
  }

  const handleSuspendedChange = (value: string) => {
    setSuspended(value)
    setPage(0)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agents Management</h2>
          <p className="text-muted-foreground">Monitor and manage all agents on the platform</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Agents"
          value={stats ? formatNumber(stats.total_agents) : '-'}
          subtitle={`${stats?.created_7d || 0} new this week`}
          icon={Bot}
          loading={statsLoading}
        />
        <MetricCard
          title="Active Agents"
          value={stats ? formatNumber(stats.active_agents) : '-'}
          subtitle="Deployed and running"
          icon={Activity}
          variant="success"
          loading={statsLoading}
        />
        <MetricCard
          title="Suspended"
          value={stats?.suspended_agents || 0}
          subtitle="Requires attention"
          icon={AlertTriangle}
          variant={stats && stats.suspended_agents > 0 ? 'warning' : 'default'}
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

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">All Agents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <AgentFilters
            search={search}
            onSearchChange={handleSearchChange}
            framework={framework}
            onFrameworkChange={handleFrameworkChange}
            status={status}
            onStatusChange={handleStatusChange}
            suspended={suspended}
            onSuspendedChange={handleSuspendedChange}
            frameworks={frameworks}
            onClear={clearFilters}
            hasFilters={!!hasFilters}
          />

          <AgentsTable agents={agents} isLoading={agentsLoading} showFiltersHint={!!hasFilters} />

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
