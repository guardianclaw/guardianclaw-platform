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
import { RequestTypeBadge, RequestStatusBadge } from './badges'
import type { GdprRequestListItem } from '@/hooks/use-admin-api'
import { FileText } from 'lucide-react'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 12) return wallet
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`
}

export interface GdprRequestsTableProps {
  requests: GdprRequestListItem[]
  isLoading: boolean
  emptyMessage?: string
  showFiltersHint?: boolean
}

export function GdprRequestsTable({
  requests,
  isLoading,
  emptyMessage = 'No GDPR requests found',
  showFiltersHint = false,
}: GdprRequestsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (requests.length === 0) {
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
          <TableHead>User</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Requested</TableHead>
          <TableHead>Completed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.map((request) => (
          <TableRow key={request.id}>
            <TableCell>
              <Link
                href={`/admin/compliance/requests?id=${request.id}`}
                className="font-mono text-sm hover:underline"
              >
                {request.display_name || truncateWallet(request.wallet_address)}
              </Link>
            </TableCell>
            <TableCell>
              <RequestTypeBadge type={request.request_type} />
            </TableCell>
            <TableCell>
              <RequestStatusBadge status={request.status} />
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDate(request.requested_at)}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {request.completed_at ? formatDate(request.completed_at) : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
