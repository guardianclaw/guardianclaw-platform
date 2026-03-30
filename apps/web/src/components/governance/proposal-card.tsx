'use client'

/**
 * Proposal card component for governance list
 */

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Users, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatSipNumber,
  getTypeLabel,
  getTypeColor,
  formatWalletAddress,
  calculateVotePercentages,
} from '@/lib/governance'
import { Proposal } from '@/lib/api'
import { StatusBadge } from './status-badge'
import { CountdownTimer } from './countdown-timer'

interface ProposalCardProps {
  proposal: Proposal
  index?: number
  className?: string
}

export function ProposalCard({ proposal, index = 0, className }: ProposalCardProps) {
  const { forPercent, againstPercent } = calculateVotePercentages(proposal)
  const hasVotes = proposal.votes_for > 0 || proposal.votes_against > 0

  const deadline =
    proposal.status === 'voting'
      ? proposal.voting_end_at
      : proposal.status === 'discussion'
        ? proposal.discussion_end_at
        : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link
        href={`/app/governance/${proposal.id}`}
        className={cn(
          'bg-card/50 border-border hover:border-border/80 hover:bg-card/70 group block rounded-lg border p-5 transition-all',
          className
        )}
      >
        {/* Header */}
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-sm">
                {formatSipNumber(proposal.number)}
              </span>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-xs',
                  getTypeColor(proposal.type)
                )}
              >
                {getTypeLabel(proposal.type)}
              </span>
            </div>
            <h3 className="text-foreground line-clamp-2 text-lg font-semibold transition-colors group-hover:text-emerald-400">
              {proposal.title}
            </h3>
          </div>
          <StatusBadge status={proposal.status} />
        </div>

        {/* Meta info */}
        <div className="text-muted-foreground mb-4 flex items-center gap-4 text-sm">
          <span>by {formatWalletAddress(proposal.author_wallet)}</span>
          {deadline && (
            <CountdownTimer
              deadline={deadline}
              label={proposal.status === 'voting' ? 'Vote ends' : 'Discussion ends'}
              size="sm"
            />
          )}
        </div>

        {/* Vote bar (if voting or has votes) */}
        {(proposal.status === 'voting' || hasVotes) && (
          <div className="mb-4">
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div className="flex h-full">
                {forPercent > 0 && (
                  <div className="bg-emerald-500" style={{ width: `${forPercent}%` }} />
                )}
                {againstPercent > 0 && (
                  <div className="bg-red-500" style={{ width: `${againstPercent}%` }} />
                )}
              </div>
            </div>
            <div className="mt-1.5 flex justify-between text-xs">
              <span className="text-emerald-400">{forPercent}% For</span>
              <span className="text-red-400">{againstPercent}% Against</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="border-border flex items-center justify-between border-t pt-3">
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <Users className="h-4 w-4" />
            <span>{proposal.unique_voters} voters</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-emerald-500 transition-colors group-hover:text-emerald-400">
            View details
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

export default ProposalCard
