'use client'

/**
 * Proposal list component with filters
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Filter, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useProposals } from '@/hooks/use-governance'
import { ProposalStatus, ProposalType } from '@/lib/api'
import { getStatusLabel, getTypeLabel } from '@/lib/governance'
import { ProposalCard } from './proposal-card'

interface ProposalListProps {
  initialStatus?: ProposalStatus
  initialType?: ProposalType
  className?: string
}

const STATUS_OPTIONS: { value: ProposalStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'voting', label: 'Voting' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'passed', label: 'Passed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Draft' },
]

const TYPE_OPTIONS: { value: ProposalType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'feature', label: 'Feature' },
  { value: 'governance', label: 'Governance' },
  { value: 'seed', label: 'Seed Change' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'docs', label: 'Documentation' },
  { value: 'meta', label: 'Meta' },
]

export function ProposalList({ initialStatus, initialType, className }: ProposalListProps) {
  const [statusFilter, setStatusFilter] = useState<ProposalStatus | 'all'>(initialStatus || 'all')
  const [typeFilter, setTypeFilter] = useState<ProposalType | 'all'>(initialType || 'all')
  const [search, setSearch] = useState('')

  const { proposals, pagination, loading, error, refetch } = useProposals({
    status: statusFilter === 'all' ? undefined : statusFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
  })

  // Filter by search locally
  const filteredProposals = search
    ? proposals.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.body.toLowerCase().includes(search.toLowerCase())
      )
    : proposals

  const handleStatusChange = (status: ProposalStatus | 'all') => {
    setStatusFilter(status)
    refetch({ status: status === 'all' ? undefined : status, page: 1 })
  }

  const handleTypeChange = (type: ProposalType | 'all') => {
    setTypeFilter(type)
    refetch({ type: type === 'all' ? undefined : type, page: 1 })
  }

  const handlePageChange = (page: number) => {
    refetch({ page })
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search proposals..."
            className="bg-card/50 border-border text-foreground placeholder:text-muted-foreground w-full rounded-lg border py-2 pl-10 pr-4 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <Filter className="text-muted-foreground h-4 w-4" />
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value as ProposalStatus | 'all')}
            className="bg-card/50 border-border text-foreground rounded-lg border px-3 py-2 focus:border-emerald-500 focus:outline-none"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => handleTypeChange(e.target.value as ProposalType | 'all')}
          className="bg-card/50 border-border text-foreground rounded-lg border px-3 py-2 focus:border-emerald-500 focus:outline-none"
        >
          {TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status tabs (quick filter) */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_OPTIONS.slice(0, 5).map((option) => (
          <button
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className={cn(
              'whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
              statusFilter === option.value
                ? 'border border-emerald-500/30 bg-emerald-500/20 text-emerald-400'
                : 'bg-muted/50 text-muted-foreground border-border hover:border-border/80 border'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-red-400">
          <p>Failed to load proposals: {error}</p>
          <button onClick={() => refetch()} className="mt-2 text-sm underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

      {/* Proposals list */}
      {!loading && !error && (
        <>
          {filteredProposals.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No proposals found</p>
              {(statusFilter !== 'all' || typeFilter !== 'all' || search) && (
                <button
                  onClick={() => {
                    setStatusFilter('all')
                    setTypeFilter('all')
                    setSearch('')
                    refetch({ status: undefined, type: undefined, page: 1 })
                  }}
                  className="mt-2 text-sm text-emerald-500 underline hover:no-underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProposals.map((proposal, index) => (
                <ProposalCard key={proposal.id} proposal={proposal} index={index} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-6">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <span className="text-muted-foreground">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="bg-muted text-muted-foreground hover:bg-muted/80 flex items-center gap-1 rounded-lg px-3 py-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ProposalList
