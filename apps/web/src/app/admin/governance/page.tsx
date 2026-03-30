'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MetricCard } from '@/components/admin/metric-card'
import { Pagination } from '@/components/admin/pagination'
import { ProposalsTable, STATUS_OPTIONS, TYPE_OPTIONS } from '@/components/admin/governance'
import { useGovernanceStats, useProposalsList } from '@/hooks/use-admin-api'
import {
  Vote,
  FileText,
  Users,
  MessageSquare,
  EyeOff,
  X,
  Search,
  AlertTriangle,
  Loader2,
  PauseCircle,
  PlayCircle,
} from 'lucide-react'

const ITEMS_PER_PAGE = 20

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export default function AdminGovernancePage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<string>('')
  const [type, setType] = useState<string>('')
  const [hidden, setHidden] = useState<string>('')
  const [isPaused, setIsPaused] = useState(false)
  const [pauseLoading, setPauseLoading] = useState(false)

  // Check current pause status
  useEffect(() => {
    fetch('/api/governance/admin/pause')
      .then((r) => r.json())
      .then((data) => setIsPaused(data.paused))
      .catch(() => {})
  }, [])

  const togglePause = useCallback(async () => {
    setPauseLoading(true)
    try {
      const res = await fetch('/api/governance/admin/pause', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !isPaused }),
      })
      const data = await res.json()
      setIsPaused(data.paused)
    } catch {
      // Ignore
    } finally {
      setPauseLoading(false)
    }
  }, [isPaused])

  const { data: statsData, isLoading: statsLoading } = useGovernanceStats()
  const { data: proposalsData, isLoading: proposalsLoading } = useProposalsList({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    search: search || undefined,
    status: status || undefined,
    type: type || undefined,
    hidden: hidden ? hidden === 'true' : undefined,
    order_by: 'created_at',
    order_dir: 'desc',
  })

  const stats = statsData?.stats
  const proposals = proposalsData?.proposals || []
  const total = proposalsData?.pagination.total || 0

  const hasFilters = search || status || type || hidden

  const clearFilters = () => {
    setSearch('')
    setStatus('')
    setType('')
    setHidden('')
    setPage(0)
  }

  return (
    <div className="space-y-6">
      {/* Pause Banner */}
      {isPaused && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-400">Governance is Paused</p>
            <p className="text-muted-foreground text-sm">
              All write operations (voting, proposals, comments) are blocked.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Governance</h2>
          <p className="text-muted-foreground">Monitor and moderate proposals and votes</p>
        </div>
        <Button
          variant={isPaused ? 'default' : 'destructive'}
          onClick={togglePause}
          disabled={pauseLoading}
        >
          {pauseLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isPaused ? (
            <PlayCircle className="mr-2 h-4 w-4" />
          ) : (
            <PauseCircle className="mr-2 h-4 w-4" />
          )}
          {isPaused ? 'Resume Governance' : 'Emergency Pause'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Total Proposals"
          value={stats ? formatNumber(stats.total_proposals) : '-'}
          subtitle={`${stats?.proposals_7d || 0} this week`}
          icon={FileText}
          loading={statsLoading}
        />
        <MetricCard
          title="Active Proposals"
          value={stats ? formatNumber(stats.active_proposals) : '-'}
          subtitle="Discussion or voting"
          icon={Vote}
          variant="success"
          loading={statsLoading}
        />
        <MetricCard
          title="Unique Voters"
          value={stats ? formatNumber(stats.unique_voters) : '-'}
          subtitle={`${stats?.votes_7d || 0} votes this week`}
          icon={Users}
          loading={statsLoading}
        />
        <MetricCard
          title="Total Comments"
          value={stats ? formatNumber(stats.total_comments) : '-'}
          subtitle="Community engagement"
          icon={MessageSquare}
          loading={statsLoading}
        />
        <MetricCard
          title="Hidden Proposals"
          value={stats?.hidden_proposals || 0}
          subtitle="Moderated content"
          icon={EyeOff}
          variant={stats && stats.hidden_proposals > 0 ? 'warning' : 'default'}
          loading={statsLoading}
        />
      </div>

      {/* Status Breakdown */}
      {stats && Object.keys(stats.by_status).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proposals by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(stats.by_status).map(([statusKey, count]) => (
                <div key={statusKey} className="flex items-center gap-2">
                  <span className="text-sm capitalize">{statusKey.replace('_', ' ')}</span>
                  <span className="text-lg font-bold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">All Proposals</CardTitle>
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
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search proposals..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
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
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={type || 'all'}
              onValueChange={(v) => {
                setType(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={hidden || 'all'}
              onValueChange={(v) => {
                setHidden(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Hidden Only</SelectItem>
                <SelectItem value="false">Visible Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ProposalsTable
            proposals={proposals}
            isLoading={proposalsLoading}
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
