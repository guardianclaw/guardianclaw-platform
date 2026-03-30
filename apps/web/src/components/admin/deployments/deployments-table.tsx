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
import { EnvironmentBadge, DeploymentStatusBadge } from './badges'
import { Rocket, ChevronRight, Server } from 'lucide-react'

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export interface DeploymentListItem {
  id: string
  agent_id: string
  agent_name: string
  environment: string
  status: string
  version: number
  is_suspended: boolean
  is_active: boolean
  owner_wallet: string
  owner_name: string | null
  requests_24h: number
  created_at: string
}

export interface DeploymentsTableProps {
  deployments: DeploymentListItem[]
  isLoading: boolean
  emptyMessage?: string
  showFiltersHint?: boolean
}

export function DeploymentsTable({
  deployments,
  isLoading,
  emptyMessage = 'No deployments found',
  showFiltersHint = false,
}: DeploymentsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    )
  }

  if (deployments.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <Rocket className="mx-auto mb-4 h-12 w-12 opacity-50" />
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
          <TableHead>Environment</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Version</TableHead>
          <TableHead>Owner</TableHead>
          <TableHead className="text-right">Requests (24h)</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deployments.map((deployment) => (
          <TableRow key={deployment.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                  <Server className="text-muted-foreground h-5 w-5" />
                </div>
                <div>
                  <Link
                    href={`/admin/deployments/${deployment.id}`}
                    className="font-medium hover:underline"
                  >
                    {deployment.agent_name}
                  </Link>
                  <p className="text-muted-foreground font-mono text-xs">
                    {deployment.id.slice(0, 8)}...
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <EnvironmentBadge environment={deployment.environment} />
            </TableCell>
            <TableCell>
              <DeploymentStatusBadge
                status={deployment.status}
                isSuspended={deployment.is_suspended}
                isActive={deployment.is_active}
              />
            </TableCell>
            <TableCell>
              <span className="font-mono text-sm">v{deployment.version}</span>
            </TableCell>
            <TableCell>
              <Link
                href={`/admin/support/${deployment.owner_wallet}`}
                className="font-mono text-sm hover:underline"
              >
                {deployment.owner_name || `${deployment.owner_wallet.slice(0, 8)}...`}
              </Link>
            </TableCell>
            <TableCell className="text-right font-mono">
              {formatNumber(deployment.requests_24h)}
            </TableCell>
            <TableCell>
              <Link href={`/admin/deployments/${deployment.id}`}>
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
