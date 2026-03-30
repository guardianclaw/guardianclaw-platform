'use client'

/**
 * Proposal detail client component
 */

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Calendar,
  User,
  ExternalLink,
  Clock,
  Loader2,
  AlertCircle,
  MessageSquare,
  Reply,
  CheckCircle,
} from 'lucide-react'
import { useProposal, useComments } from '@/hooks/use-governance'
import { governanceApi, Comment } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { StatusBadge, CountdownTimer, ResultsChart, VotingSection } from '@/components/governance'
import { formatSipNumber, getTypeLabel, getTypeColor, formatWalletAddress } from '@/lib/governance'
import { cn } from '@/lib/utils'

interface ProposalDetailProps {
  proposalId: string
}

export function ProposalDetail({ proposalId }: ProposalDetailProps) {
  const { proposal, loading, error, refetch } = useProposal(proposalId)
  const { comments, loading: commentsLoading } = useComments(proposalId)
  const [finalizing, setFinalizing] = useState(false)
  const [finalizeError, setFinalizeError] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)

  // Group comments for threading (max 2 levels)
  const threadedComments = useMemo(() => {
    const topLevel = comments.filter((c) => !c.parent_comment_id)
    const replies = comments.filter((c) => c.parent_comment_id)
    const replyMap = new Map<string, Comment[]>()
    for (const reply of replies) {
      const parentId = reply.parent_comment_id!
      if (!replyMap.has(parentId)) replyMap.set(parentId, [])
      replyMap.get(parentId)!.push(reply)
    }
    return { topLevel, replyMap }
  }, [comments])

  const canFinalize =
    proposal?.status === 'voting' &&
    proposal.voting_end_at &&
    new Date(proposal.voting_end_at) <= new Date()

  const handleFinalize = useCallback(async () => {
    if (!proposal) return
    setFinalizing(true)
    setFinalizeError(null)
    try {
      await governanceApi.finalizeProposal(proposal.id)
      refetch()
    } catch (err: any) {
      setFinalizeError(err.message || 'Failed to finalize')
    } finally {
      setFinalizing(false)
    }
  }, [proposal, refetch])

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h2 className="text-foreground mb-2 text-lg font-medium">Proposal Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || 'The proposal you are looking for does not exist.'}
          </p>
          <Link
            href="/app/governance"
            className="text-emerald-500 underline hover:text-emerald-400"
          >
            Back to Governance
          </Link>
        </div>
      </div>
    )
  }

  const deadline =
    proposal.status === 'voting'
      ? proposal.voting_end_at
      : proposal.status === 'discussion'
        ? proposal.discussion_end_at
        : undefined

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Back link */}
      <Link
        href="/app/governance"
        className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Governance
      </Link>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="mb-4 flex items-start gap-4">
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
            <h1 className="text-foreground text-2xl font-bold md:text-3xl">{proposal.title}</h1>
          </div>
          <StatusBadge status={proposal.status} size="lg" />
        </div>

        {/* Meta info */}
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            <span>by</span>
            <a
              href={`https://solscan.io/account/${proposal.author_wallet}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400"
            >
              {formatWalletAddress(proposal.author_wallet)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            {new Date(proposal.created_at).toLocaleDateString()}
          </div>
          {deadline && (
            <CountdownTimer
              deadline={deadline}
              label={proposal.status === 'voting' ? 'Vote ends' : 'Discussion ends'}
            />
          )}
          {proposal.snapshot_slot && (
            <a
              href={`https://solscan.io/block/${proposal.snapshot_slot}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground flex items-center gap-1.5"
            >
              <Clock className="h-4 w-4" />
              Snapshot: #{proposal.snapshot_slot.toLocaleString()}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-card/50 border-border rounded-lg border p-6"
          >
            <h2 className="text-foreground mb-4 text-lg font-medium">Description</h2>
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-foreground/90 whitespace-pre-wrap">{proposal.body}</div>
            </div>
          </motion.div>

          {/* Voting results */}
          {(proposal.status === 'voting' ||
            proposal.status === 'passed' ||
            proposal.status === 'rejected' ||
            proposal.status === 'no_quorum') && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-card/50 border-border rounded-lg border p-6"
            >
              <h2 className="text-foreground mb-4 text-lg font-medium">Voting Results</h2>
              <ResultsChart proposal={proposal} />
            </motion.div>
          )}

          {/* Finalize button */}
          {canFinalize && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-400">Voting period has ended</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Results can be finalized to determine the outcome.
                  </p>
                </div>
                <Button
                  onClick={handleFinalize}
                  disabled={finalizing}
                  size="sm"
                  variant="outline"
                  className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                >
                  {finalizing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Finalize Results
                </Button>
              </div>
              {finalizeError && <p className="mt-2 text-xs text-red-400">{finalizeError}</p>}
            </motion.div>
          )}

          {/* Comments */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card/50 border-border rounded-lg border p-6"
          >
            <h2 className="text-foreground mb-4 flex items-center gap-2 text-lg font-medium">
              <MessageSquare className="h-5 w-5" />
              Discussion ({comments.length})
            </h2>

            {commentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : comments.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No comments yet. Be the first to comment!
              </p>
            ) : (
              <div className="space-y-4">
                {threadedComments.topLevel.map((comment) => (
                  <div key={comment.id}>
                    {/* Top-level comment */}
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://solscan.io/account/${comment.author_wallet}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-emerald-500 hover:text-emerald-400"
                          >
                            {formatWalletAddress(comment.author_wallet)}
                          </a>
                          <span className="text-muted-foreground text-xs">
                            {new Date(comment.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setReplyingTo(replyingTo === comment.id ? null : comment.id)
                          }
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
                        >
                          <Reply className="h-3 w-3" />
                          Reply
                        </button>
                      </div>
                      <p className="text-foreground/90 text-sm">{comment.content}</p>
                    </div>

                    {/* Replies (max 2 levels — all nested as flat under parent) */}
                    {threadedComments.replyMap.has(comment.id) && (
                      <div className="border-border ml-6 mt-2 space-y-2 border-l-2 pl-4">
                        {threadedComments.replyMap.get(comment.id)!.map((reply) => (
                          <div key={reply.id} className="bg-muted/30 rounded-lg p-3">
                            <div className="mb-1 flex items-center gap-2">
                              <a
                                href={`https://solscan.io/account/${reply.author_wallet}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-emerald-500 hover:text-emerald-400"
                              >
                                {formatWalletAddress(reply.author_wallet)}
                              </a>
                              <span className="text-muted-foreground text-xs">
                                {new Date(reply.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-foreground/90 text-sm">{reply.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Voting section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <VotingSection proposal={proposal} onVoted={refetch} />
          </motion.div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card/50 border-border rounded-lg border p-6"
          >
            <h3 className="text-foreground mb-4 text-lg font-medium">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="mt-1.5 h-2 w-2 rounded-full bg-emerald-500" />
                <div>
                  <p className="text-foreground text-sm">Created</p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(proposal.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {proposal.discussion_end_at && (
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-blue-500" />
                  <div>
                    <p className="text-foreground text-sm">Discussion period</p>
                    <p className="text-muted-foreground text-xs">
                      Ends {new Date(proposal.discussion_end_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {proposal.voting_start_at && (
                <div className="flex items-start gap-3">
                  <div className="mt-1.5 h-2 w-2 rounded-full bg-purple-500" />
                  <div>
                    <p className="text-foreground text-sm">Voting started</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(proposal.voting_start_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
              {proposal.voting_end_at && proposal.status !== 'voting' && (
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-1.5 h-2 w-2 rounded-full',
                      proposal.status === 'passed'
                        ? 'bg-green-500'
                        : proposal.status === 'rejected'
                          ? 'bg-red-500'
                          : 'bg-zinc-500'
                    )}
                  />
                  <div>
                    <p className="text-foreground text-sm">
                      {proposal.status === 'passed'
                        ? 'Passed'
                        : proposal.status === 'rejected'
                          ? 'Rejected'
                          : 'Voting ended'}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(proposal.voting_end_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default ProposalDetail
