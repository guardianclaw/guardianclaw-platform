'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataCategoryBadge } from './badges'
import type { DeletionAuditItem } from '@/hooks/use-admin-api'
import { Trash2 } from 'lucide-react'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function truncateHash(hash: string): string {
  if (hash.length <= 12) return hash
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`
}

export interface DeletionAuditTableProps {
  deletions: DeletionAuditItem[]
  isLoading: boolean
  emptyMessage?: string
  showFiltersHint?: boolean
}

export function DeletionAuditTable({
  deletions,
  isLoading,
  emptyMessage = 'No deletion records found',
  showFiltersHint = false,
}: DeletionAuditTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (deletions.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <Trash2 className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>{emptyMessage}</p>
        {showFiltersHint && <p className="mt-2 text-sm">Try adjusting your filters</p>}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Wallet Hash</TableHead>
          <TableHead>Data Categories</TableHead>
          <TableHead>Retained</TableHead>
          <TableHead>Deletion Date</TableHead>
          <TableHead>Request ID</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deletions.map((deletion) => (
          <TableRow key={deletion.id}>
            <TableCell className="font-mono text-sm">
              {truncateHash(deletion.wallet_hash)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {deletion.data_categories.slice(0, 3).map((category) => (
                  <DataCategoryBadge key={category} category={category} />
                ))}
                {deletion.data_categories.length > 3 && (
                  <span className="text-muted-foreground text-xs">
                    +{deletion.data_categories.length - 3} more
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell>
              {deletion.retained_categories && deletion.retained_categories.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {deletion.retained_categories.slice(0, 2).map((category) => (
                    <DataCategoryBadge key={category} category={category} />
                  ))}
                  {deletion.retained_categories.length > 2 && (
                    <span className="text-muted-foreground text-xs">
                      +{deletion.retained_categories.length - 2}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {formatDate(deletion.deletion_date)}
            </TableCell>
            <TableCell className="text-muted-foreground font-mono text-xs">
              {deletion.request_id ? truncateHash(deletion.request_id) : '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
