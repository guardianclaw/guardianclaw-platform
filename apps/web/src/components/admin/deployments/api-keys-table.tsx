'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EnvironmentBadge } from './badges'
import { Key } from 'lucide-react'

// Helper functions
function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

export interface ApiKey {
  id: string
  key_prefix: string
  name: string | null
  environment: string
  is_revoked: boolean
  rate_limit: number | null
  requests_24h: number
  requests_total: number
  last_used_at: string | null
}

export interface ApiKeysTableProps {
  keys: ApiKey[]
  isLoading: boolean
}

export function ApiKeysTable({ keys, isLoading }: ApiKeysTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Key className="h-4 w-4" />
          API Keys
        </CardTitle>
        <CardDescription>API keys configured for this deployment</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : keys.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center">
            <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No API keys configured</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Rate Limit</TableHead>
                <TableHead className="text-right">Requests (24h)</TableHead>
                <TableHead className="text-right">Total Requests</TableHead>
                <TableHead>Last Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-mono text-sm">{key.key_prefix}...</TableCell>
                  <TableCell>{key.name || '-'}</TableCell>
                  <TableCell>
                    <EnvironmentBadge environment={key.environment} showIcon={false} />
                  </TableCell>
                  <TableCell className="text-center">
                    {key.is_revoked ? (
                      <Badge variant="destructive" className="text-xs">
                        Revoked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-green-500/10 text-xs text-green-500">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {key.rate_limit !== null ? `${key.rate_limit}/min` : 'Default'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(key.requests_24h)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatNumber(key.requests_total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {key.last_used_at ? formatDistanceToNow(new Date(key.last_used_at)) : 'Never'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
