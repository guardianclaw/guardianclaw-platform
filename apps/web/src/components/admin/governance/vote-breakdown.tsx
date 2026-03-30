'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { VoteSummary } from '@/hooks/use-admin-api'
import { ThumbsUp, ThumbsDown, Vote } from 'lucide-react'

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

interface VoteDistributionProps {
  votesFor: number
  votesAgainst: number
}

export function VoteDistribution({ votesFor, votesAgainst }: VoteDistributionProps) {
  const total = votesFor + votesAgainst

  if (total === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Vote className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No votes yet</p>
      </div>
    )
  }

  const forPercent = (votesFor / total) * 100
  const againstPercent = (votesAgainst / total) * 100

  return (
    <div className="space-y-4">
      <div className="bg-muted flex h-4 overflow-hidden rounded-full">
        {forPercent > 0 && (
          <div className="bg-green-500 transition-all" style={{ width: `${forPercent}%` }} />
        )}
        {againstPercent > 0 && (
          <div className="bg-red-500 transition-all" style={{ width: `${againstPercent}%` }} />
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-center">
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 text-green-500">
            <ThumbsUp className="h-4 w-4" />
            <span className="font-bold">{formatNumber(votesFor)}</span>
          </div>
          <p className="text-muted-foreground text-xs">{forPercent.toFixed(1)}% For</p>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2 text-red-500">
            <ThumbsDown className="h-4 w-4" />
            <span className="font-bold">{formatNumber(votesAgainst)}</span>
          </div>
          <p className="text-muted-foreground text-xs">{againstPercent.toFixed(1)}% Against</p>
        </div>
      </div>
    </div>
  )
}

interface VoteDirectionBadgeProps {
  direction: string
}

function VoteDirectionBadge({ direction }: VoteDirectionBadgeProps) {
  switch (direction) {
    case 'for':
      return (
        <Badge variant="outline" className="border-green-500/20 bg-green-500/10 text-green-500">
          <ThumbsUp className="mr-1 h-3 w-3" />
          For
        </Badge>
      )
    case 'against':
      return (
        <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-500">
          <ThumbsDown className="mr-1 h-3 w-3" />
          Against
        </Badge>
      )
    default:
      return <Badge variant="outline">{direction}</Badge>
  }
}

interface VotesTableProps {
  votes: VoteSummary[]
  isLoading: boolean
}

export function VotesTable({ votes, isLoading }: VotesTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (votes.length === 0) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        <Vote className="mx-auto mb-2 h-8 w-8 opacity-50" />
        <p>No votes recorded</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Voter</TableHead>
          <TableHead>Vote</TableHead>
          <TableHead className="text-right">Voting Power</TableHead>
          <TableHead>Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {votes.map((vote) => (
          <TableRow key={vote.wallet_address}>
            <TableCell className="font-mono text-sm">
              {vote.display_name || truncateWallet(vote.wallet_address)}
            </TableCell>
            <TableCell>
              <VoteDirectionBadge direction={vote.vote_direction} />
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatNumber(vote.voting_power)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDate(vote.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface VoteBreakdownCardProps {
  votesFor: number
  votesAgainst: number
  votes: VoteSummary[]
  isLoading: boolean
  quorumRequired?: number
  majorityRequired?: number
}

export function VoteBreakdownCard({
  votesFor,
  votesAgainst,
  votes,
  isLoading,
  quorumRequired,
  majorityRequired,
}: VoteBreakdownCardProps) {
  const total = votesFor + votesAgainst

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Vote className="h-4 w-4" />
          Vote Breakdown
        </CardTitle>
        <CardDescription>
          {total > 0 ? (
            <>
              Total: {formatNumber(total)} votes
              {quorumRequired && ` • Quorum: ${formatNumber(quorumRequired)}`}
              {majorityRequired && ` • Majority: ${majorityRequired}%`}
            </>
          ) : (
            'No votes cast yet'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <VoteDistribution votesFor={votesFor} votesAgainst={votesAgainst} />
        {votes.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-medium">Recent Votes</h4>
            <VotesTable votes={votes.slice(0, 10)} isLoading={isLoading} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
