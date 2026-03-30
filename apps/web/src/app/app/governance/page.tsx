'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Plus, Vote, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { governanceApi, Proposal } from '@/lib/api'
import { ProposalCard } from '@/components/governance'

const STATUS_FILTERS = [
  { value: null, label: 'All' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'voting', label: 'Voting' },
  { value: 'passed', label: 'Passed' },
  { value: 'rejected', label: 'Rejected' },
]

export default function GovernancePage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [pagination, setPagination] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  // Check pause status
  useEffect(() => {
    fetch('/api/governance/admin/pause')
      .then((r) => r.json())
      .then((data) => setIsPaused(data.paused))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const fetchProposals = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await governanceApi.listProposals({
          ...(statusFilter ? { status: statusFilter } : {}),
          page: page,
          limit: 10,
        })
        setProposals(data.proposals)
        setPagination(data.pagination)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchProposals()
  }, [statusFilter, page])

  return (
    <div className="container mx-auto min-h-screen px-4 py-12">
      {isPaused && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-medium text-amber-400">Governance Paused</p>
            <p className="text-muted-foreground text-sm">
              Voting and proposal creation are temporarily paused. You can still browse existing
              proposals.
            </p>
          </div>
        </div>
      )}

      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="mb-2 flex items-center gap-3 text-4xl font-bold">
            <Vote className="h-10 w-10 text-emerald-500" />
            Governance
          </h1>
          <p className="text-zinc-400">
            Shape the future of GuardianClaw through decentralized governance
          </p>
        </div>
        <Link href="/app/governance/create" passHref>
          <Button className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            New Proposal
          </Button>
        </Link>
      </div>

      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
        {STATUS_FILTERS.map(({ value, label }) => (
          <button
            key={label}
            onClick={() => {
              setStatusFilter(value)
              setPage(1)
            }}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === value
                ? 'bg-claw-600 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-400">{error}</div>
      ) : proposals.length === 0 ? (
        <div className="py-12 text-center">
          <Image
            src="/favicon.svg"
            alt="No proposals"
            width={80}
            height={107}
            className="mx-auto mb-4 opacity-30"
          />
          <p className="text-zinc-400">No proposals found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="mt-8 flex justify-center gap-2">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-zinc-400">
            Page {page} of {pagination.pages}
          </span>
          <Button
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
