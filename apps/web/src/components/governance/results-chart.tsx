'use client'

/**
 * Voting results chart component
 */

import { motion } from 'framer-motion'
import { CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { calculateVotePercentages, formatVotingPower } from '@/lib/governance'
import { Proposal } from '@/lib/api'

interface ResultsChartProps {
  proposal: Proposal
  showDetails?: boolean
  animated?: boolean
  className?: string
}

export function ResultsChart({
  proposal,
  showDetails = true,
  animated = true,
  className,
}: ResultsChartProps) {
  const { forPercent, againstPercent } = calculateVotePercentages(proposal)
  const totalVotes = proposal.votes_for + proposal.votes_against

  const Wrapper = animated ? motion.div : 'div'

  return (
    <Wrapper
      initial={animated ? { opacity: 0, y: 10 } : undefined}
      animate={animated ? { opacity: 1, y: 0 } : undefined}
      className={cn('space-y-4', className)}
    >
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="bg-muted h-3 w-full overflow-hidden rounded-full">
          <div className="flex h-full">
            {forPercent > 0 && (
              <motion.div
                initial={animated ? { width: 0 } : undefined}
                animate={animated ? { width: `${forPercent}%` } : undefined}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="bg-emerald-500"
                style={{ width: animated ? undefined : `${forPercent}%` }}
              />
            )}
            {againstPercent > 0 && (
              <motion.div
                initial={animated ? { width: 0 } : undefined}
                animate={animated ? { width: `${againstPercent}%` } : undefined}
                transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                className="bg-red-500"
                style={{ width: animated ? undefined : `${againstPercent}%` }}
              />
            )}
          </div>
        </div>

        {/* Vote counts */}
        <div className="flex justify-between text-sm">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            <span className="text-emerald-400">{forPercent.toFixed(1)}% For</span>
          </div>
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-red-400">{againstPercent.toFixed(1)}% Against</span>
          </div>
        </div>
      </div>

      {/* Detailed breakdown */}
      {showDetails && (
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
            <p className="mb-1 text-xs text-emerald-400">For</p>
            <p className="text-lg font-semibold text-emerald-500">
              {formatVotingPower(proposal.votes_for)}
            </p>
          </div>
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <p className="mb-1 text-xs text-red-400">Against</p>
            <p className="text-lg font-semibold text-red-500">
              {formatVotingPower(proposal.votes_against)}
            </p>
          </div>
        </div>
      )}

      {/* Total voters */}
      <div className="border-border flex items-center justify-between border-t pt-2 text-sm">
        <div className="text-muted-foreground">
          <span className="text-foreground font-medium">{proposal.unique_voters || 0}</span> voters
        </div>
        <div className="text-muted-foreground">
          Total:{' '}
          <span className="text-foreground font-medium">{formatVotingPower(totalVotes)}</span>
        </div>
      </div>
    </Wrapper>
  )
}

export default ResultsChart
