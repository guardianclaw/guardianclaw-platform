'use client'

/**
 * Voting section component for casting votes on proposals
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle, Loader2, Wallet } from 'lucide-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { useVoting } from '@/hooks/use-governance'
import { formatVotingPower } from '@/lib/governance'
import { Proposal, VoteChoice } from '@/lib/api'

interface VotingSectionProps {
  proposal: Proposal
  onVoted?: () => void
  className?: string
}

export function VotingSection({ proposal, onVoted, className }: VotingSectionProps) {
  const { isAuthenticated, connected, login } = useAuth()
  const { setVisible } = useWalletModal()
  const { votingPower, userVote, canVote, loading, checkingVote, error, vote } = useVoting(
    proposal.id
  )
  const [selectedChoice, setSelectedChoice] = useState<VoteChoice | null>(null)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleVote = async () => {
    if (!selectedChoice) return

    setSubmitting(true)
    try {
      await vote(selectedChoice, comment || undefined)
      onVoted?.()
    } catch (err) {
      console.error('Vote failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleConnect = async () => {
    if (!connected) {
      setVisible(true)
    } else if (!isAuthenticated) {
      await login()
    }
  }

  // Already voted
  if (userVote) {
    return (
      <div className={cn('bg-card/50 border-border rounded-lg border p-6', className)}>
        <h3 className="text-foreground mb-4 text-lg font-medium">Your Vote</h3>
        <div
          className={cn(
            'flex items-center gap-3 rounded-lg border p-4',
            userVote === 'for' && 'border-emerald-500/20 bg-emerald-500/10',
            userVote === 'against' && 'border-red-500/20 bg-red-500/10'
          )}
        >
          {userVote === 'for' && <CheckCircle className="h-6 w-6 text-emerald-500" />}
          {userVote === 'against' && <XCircle className="h-6 w-6 text-red-500" />}
          <div>
            <p className="text-foreground font-medium capitalize">{userVote}</p>
            <p className="text-muted-foreground text-sm">
              {formatVotingPower(votingPower || 0)} voting power
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (checkingVote) {
    return (
      <div className={cn('bg-card/50 border-border rounded-lg border p-6', className)}>
        <div className="text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking voting status...</span>
        </div>
      </div>
    )
  }

  // Not connected
  if (!connected || !isAuthenticated) {
    return (
      <div className={cn('bg-card/50 border-border rounded-lg border p-6', className)}>
        <h3 className="text-foreground mb-4 text-lg font-medium">Cast Your Vote</h3>
        <p className="text-muted-foreground mb-4">Connect your wallet to vote on this proposal.</p>
        <button
          onClick={handleConnect}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-white transition-colors hover:bg-emerald-700"
        >
          <Wallet className="h-5 w-5" />
          {connected ? 'Sign In' : 'Connect Wallet'}
        </button>
      </div>
    )
  }

  // Can't vote (not enough tokens)
  if (!canVote && votingPower) {
    return (
      <div className={cn('bg-card/50 border-border rounded-lg border p-6', className)}>
        <h3 className="text-foreground mb-4 text-lg font-medium">Cast Your Vote</h3>
        <p className="text-muted-foreground mb-2">
          You need at least 1,000,000 $GCLAW tokens to vote (1M = 1 vote).
        </p>
        <p className="text-muted-foreground text-sm">
          Your balance: {formatVotingPower(votingPower)} tokens
        </p>
      </div>
    )
  }

  // Voting is not active
  if (proposal.status !== 'voting') {
    return (
      <div className={cn('bg-card/50 border-border rounded-lg border p-6', className)}>
        <h3 className="text-foreground mb-4 text-lg font-medium">Voting</h3>
        <p className="text-muted-foreground">
          {proposal.status === 'discussion' && 'Voting will begin after the discussion period.'}
          {proposal.status === 'passed' && 'This proposal has passed.'}
          {proposal.status === 'rejected' && 'This proposal was rejected.'}
          {proposal.status === 'no_quorum' && 'This proposal did not reach quorum.'}
          {proposal.status === 'executed' && 'This proposal has been executed.'}
          {proposal.status === 'cancelled' && 'This proposal was cancelled.'}
          {proposal.status === 'draft' && 'This proposal is still a draft.'}
        </p>
      </div>
    )
  }

  // Can vote
  return (
    <div className={cn('bg-card/50 border-border rounded-lg border p-6', className)}>
      <h3 className="text-foreground mb-4 text-lg font-medium">Cast Your Vote</h3>

      {votingPower !== null && (
        <p className="text-muted-foreground mb-4 text-sm">
          Your voting power:{' '}
          <span className="font-medium text-emerald-500">{formatVotingPower(votingPower)}</span>{' '}
          tokens
        </p>
      )}

      {/* Vote choices */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedChoice('for')}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
            selectedChoice === 'for'
              ? 'border-emerald-500 bg-emerald-500/20'
              : 'bg-muted/50 border-border hover:border-border/80'
          )}
        >
          <CheckCircle
            className={cn(
              'h-8 w-8',
              selectedChoice === 'for' ? 'text-emerald-500' : 'text-muted-foreground'
            )}
          />
          <span
            className={
              selectedChoice === 'for' ? 'font-medium text-emerald-500' : 'text-muted-foreground'
            }
          >
            For
          </span>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setSelectedChoice('against')}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors',
            selectedChoice === 'against'
              ? 'border-red-500 bg-red-500/20'
              : 'bg-muted/50 border-border hover:border-border/80'
          )}
        >
          <XCircle
            className={cn(
              'h-8 w-8',
              selectedChoice === 'against' ? 'text-red-500' : 'text-muted-foreground'
            )}
          />
          <span
            className={
              selectedChoice === 'against' ? 'font-medium text-red-500' : 'text-muted-foreground'
            }
          >
            Against
          </span>
        </motion.button>
      </div>

      {/* Optional comment */}
      <div className="mb-4">
        <label className="text-muted-foreground mb-2 block text-sm">Comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your reasoning..."
          className="bg-muted/50 border-border text-foreground placeholder-muted-foreground w-full resize-none rounded-lg border p-3 focus:border-emerald-500 focus:outline-none"
          rows={3}
          maxLength={1000}
        />
      </div>

      {/* Submit button */}
      <button
        onClick={handleVote}
        disabled={!selectedChoice || submitting || loading}
        className="disabled:bg-muted flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed"
      >
        {submitting || loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Signing...
          </>
        ) : (
          'Submit Vote'
        )}
      </button>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  )
}

export default VotingSection
