'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FrameworkBadge, AgentStatusBadge } from './badges'
import { Bot, ChevronRight } from 'lucide-react'
import type { AgentListItem } from '@/hooks/use-admin-api'

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export interface AgentsTableProps {
  agents: AgentListItem[]
  isLoading: boolean
  emptyMessage?: string
  showFiltersHint?: boolean
}

export function AgentsTable({
  agents,
  isLoading,
  emptyMessage = 'No agents found',
  showFiltersHint = false,
}: AgentsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (agents.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>{emptyMessage}</p>
        {showFiltersHint && <p className="mt-2 text-sm">Try adjusting your filters</p>}
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Agent</TableHead>
          <TableHead>Framework</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Requests (30d)</TableHead>
          <TableHead className="text-right">Blocks</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {agents.map((agent) => (
          <TableRow key={agent.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                  <Bot className="text-muted-foreground h-5 w-5" />
                </div>
                <div>
                  <Link href={`/admin/agents/${agent.id}`} className="font-medium hover:underline">
                    {agent.name}
                  </Link>
                  {agent.description && (
                    <p className="text-muted-foreground max-w-[200px] truncate text-xs">
                      {agent.description}
                    </p>
                  )}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <FrameworkBadge framework={agent.framework} />
            </TableCell>
            <TableCell>
              <AgentStatusBadge status={agent.status} isSuspended={agent.is_suspended} />
            </TableCell>
            <TableCell>
              <Link
                href={`/admin/support/${agent.wallet_address}`}
                className="font-mono text-sm hover:underline"
              >
                {agent.owner_name || `${agent.wallet_address.slice(0, 8)}...`}
              </Link>
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatNumber(agent.total_requests)}
            </TableCell>
            <TableCell className="text-right">
              {agent.total_blocks > 0 ? (
                <span className="font-medium text-red-500">{formatNumber(agent.total_blocks)}</span>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell>
              <Link href={`/admin/agents/${agent.id}`}>
                <Button variant="ghost" size="sm">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
