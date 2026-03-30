'use client'

import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProposalStatusBadge, ProposalTypeBadge, HiddenBadge } from './badges'
import type { ProposalListItem } from '@/hooks/use-admin-api'
import { FileText, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react'

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

export interface ProposalsTableProps {
  proposals: ProposalListItem[]
  isLoading: boolean
  emptyMessage?: string
  showFiltersHint?: boolean
}

export function ProposalsTable({
  proposals,
  isLoading,
  emptyMessage = 'No proposals found',
  showFiltersHint = false,
}: ProposalsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (proposals.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>{emptyMessage}</p>
        {showFiltersHint && <p className="mt-2 text-sm">Try adjusting your filters</p>}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[60px]">#</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Author</TableHead>
          <TableHead className="text-right">Votes</TableHead>
          <TableHead className="text-right">Comments</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {proposals.map((proposal) => (
          <TableRow key={proposal.id}>
            <TableCell className="font-mono text-sm">{proposal.number}</TableCell>
            <TableCell>
              <Link
                href={`/admin/governance/${proposal.id}`}
                className="flex items-center gap-2 font-medium hover:underline"
              >
                {proposal.title}
                <HiddenBadge hidden={proposal.is_hidden} />
              </Link>
            </TableCell>
            <TableCell>
              <ProposalTypeBadge type={proposal.type} />
            </TableCell>
            <TableCell>
              <ProposalStatusBadge status={proposal.status} />
            </TableCell>
            <TableCell>
              <span className="text-muted-foreground font-mono text-sm">
                {proposal.author_name || truncateWallet(proposal.author_wallet)}
              </span>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-3">
                <span className="flex items-center gap-1 text-green-500">
                  <ThumbsUp className="h-3 w-3" />
                  {formatNumber(proposal.votes_for)}
                </span>
                <span className="flex items-center gap-1 text-red-500">
                  <ThumbsDown className="h-3 w-3" />
                  {formatNumber(proposal.votes_against)}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <span className="text-muted-foreground flex items-center justify-end gap-1">
                <MessageSquare className="h-3 w-3" />
                {proposal.comments_count}
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDate(proposal.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
