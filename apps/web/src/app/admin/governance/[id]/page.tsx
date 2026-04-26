'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ProposalStatusBadge,
  ProposalTypeBadge,
  HiddenBadge,
  VoteBreakdownCard,
  HideProposalModal,
} from '@/components/admin/governance'
import { useProposalDetails, useProposalVotes } from '@/hooks/use-admin-api'
import { governanceApi } from '@/lib/api'
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Calendar,
  User,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 16) return wallet
  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`
}

export default function AdminProposalDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const proposalId = params.id as string

  const { data, isLoading, mutate } = useProposalDetails(proposalId)
  const { data: votesData, isLoading: votesLoading } = useProposalVotes(proposalId)

  const [hideModalOpen, setHideModalOpen] = useState(false)
  const [executeModalOpen, setExecuteModalOpen] = useState(false)
  const [executionNotes, setExecutionNotes] = useState('')
  const [executing, setExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)

  const proposal = data?.proposal
  const votes = votesData?.votes || []

  const handleToggleVisibility = async (reason: string) => {
    if (!proposal) return

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/governance/proposals/${proposalId}/visibility`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hidden: !proposal.is_hidden,
          reason: reason || undefined,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update visibility')
    }

    mutate()
  }

  const handleExecute = async () => {
    setExecuting(true)
    setExecuteError(null)
    try {
      await governanceApi.executeProposal(proposalId, {
        execution_notes: executionNotes || undefined,
      })
      setExecuteModalOpen(false)
      setExecutionNotes('')
      mutate()
    } catch (err: any) {
      setExecuteError(err.message || 'Failed to mark as executed')
    } finally {
      setExecuting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!proposal) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
        <h2 className="mb-2 text-xl font-semibold">Proposal Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The proposal you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Button variant="outline" onClick={() => router.push('/admin/governance')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Governance
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/governance')}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Governance
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">
              #{proposal.number} {proposal.title}
            </h2>
            <HiddenBadge hidden={proposal.is_hidden} />
          </div>
          <div className="text-muted-foreground flex items-center gap-4 text-sm">
            <ProposalTypeBadge type={proposal.type} />
            <ProposalStatusBadge status={proposal.status} />
          </div>
        </div>
        <div className="flex gap-2">
          {proposal.status === 'passed' && (
            <Button variant="default" onClick={() => setExecuteModalOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Mark as Executed
            </Button>
          )}
          <Button
            variant={proposal.is_hidden ? 'default' : 'destructive'}
            onClick={() => setHideModalOpen(true)}
          >
            {proposal.is_hidden ? (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Show Proposal
              </>
            ) : (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Proposal
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Proposal Body */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Proposal Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{proposal.body}</pre>
              </div>
            </CardContent>
          </Card>

          {/* Hidden Info */}
          {proposal.is_hidden && proposal.hidden_reason && (
            <Card className="border-red-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base text-red-500">
                  <EyeOff className="h-4 w-4" />
                  Hidden Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Hidden at:</span>
                  <span>{proposal.hidden_at ? formatDate(proposal.hidden_at) : '-'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Reason: </span>
                  <span>{proposal.hidden_reason}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Vote Breakdown */}
          <VoteBreakdownCard
            votesFor={proposal.votes_for}
            votesAgainst={proposal.votes_against}
            votes={votes}
            isLoading={votesLoading}
            quorumRequired={proposal.quorum_required}
            majorityRequired={proposal.majority_required}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Proposal Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Author</p>
                  <p className="font-mono text-sm">
                    {proposal.author_name || truncateWallet(proposal.author_wallet)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Created</p>
                  <p className="text-sm">{formatDate(proposal.created_at)}</p>
                </div>
              </div>
              {proposal.voting_start_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  <div>
                    <p className="text-muted-foreground text-sm">Voting Started</p>
                    <p className="text-sm">{formatDate(proposal.voting_start_at)}</p>
                  </div>
                </div>
              )}
              {proposal.voting_end_at && (
                <div className="flex items-center gap-3">
                  <Calendar className="text-muted-foreground h-4 w-4" />
                  <div>
                    <p className="text-muted-foreground text-sm">Voting Ends</p>
                    <p className="text-sm">{formatDate(proposal.voting_end_at)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3">
                <MessageSquare className="text-muted-foreground h-4 w-4" />
                <div>
                  <p className="text-muted-foreground text-sm">Comments</p>
                  <p className="text-sm">{proposal.comments_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Voting Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voting Requirements</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Quorum Required</span>
                <span className="font-medium">
                  {proposal.quorum_required?.toLocaleString() || '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Majority Required</span>
                <span className="font-medium">
                  {proposal.majority_required ? `${proposal.majority_required}%` : '-'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Votes Cast</span>
                <span className="font-medium">
                  {(proposal.votes_for + proposal.votes_against).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Hide/Show Modal */}
      <HideProposalModal
        open={hideModalOpen}
        onOpenChange={setHideModalOpen}
        proposalTitle={proposal.title}
        isCurrentlyHidden={proposal.is_hidden}
        onConfirm={handleToggleVisibility}
      />

      {/* Execute Modal */}
      <Dialog open={executeModalOpen} onOpenChange={setExecuteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Proposal as Executed</DialogTitle>
            <DialogDescription>
              Confirm that this proposal has been implemented. This action records who executed it
              and when.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-foreground mb-2 block text-sm font-medium">
                Execution Notes (optional)
              </label>
              <Textarea
                placeholder="Link to PR, changelog entry, or brief description of what was done..."
                value={executionNotes}
                onChange={(e) => setExecutionNotes(e.target.value)}
                rows={3}
              />
            </div>
            {executeError && <p className="text-sm text-red-500">{executeError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExecuteModalOpen(false)}
              disabled={executing}
            >
              Cancel
            </Button>
            <Button onClick={handleExecute} disabled={executing}>
              {executing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm Execution
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
