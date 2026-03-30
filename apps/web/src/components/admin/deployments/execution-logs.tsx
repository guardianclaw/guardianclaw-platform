'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/admin/pagination'
import { FileText, RefreshCw } from 'lucide-react'

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

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return '-'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '-'
  return `$${amount.toFixed(4)}`
}

// Gate badge component
function GateBadge({ gate }: { gate: string | null }) {
  if (!gate) return <span className="text-muted-foreground">-</span>

  const config: Record<string, { color: string; label: string }> = {
    credibility: { color: 'bg-blue-500/10 text-blue-500 border-blue-500/20', label: 'Credibility' },
    avoidance: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Avoidance' },
    limits: { color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', label: 'Limits' },
    worth: { color: 'bg-purple-500/10 text-purple-500 border-purple-500/20', label: 'Worth' },
  }

  const { color, label } = config[gate] || { color: '', label: gate }

  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

export interface ExecutionLog {
  id: string
  created_at: string
  input_preview: string | null
  output_preview: string | null
  claw_blocked: boolean
  blocked_gate: string | null
  execution_time_ms: number | null
  cost_usd: number | null
}

export interface ExecutionLogsProps {
  logs: ExecutionLog[]
  isLoading: boolean
  page: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
  blockedOnly: boolean
  onBlockedOnlyChange: (value: boolean) => void
  onRefresh: () => void
}

export function ExecutionLogs({
  logs,
  isLoading,
  page,
  total,
  pageSize,
  onPageChange,
  blockedOnly,
  onBlockedOnlyChange,
  onRefresh,
}: ExecutionLogsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Execution Logs
            </CardTitle>
            <CardDescription>Recent request executions for this deployment</CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="blocked-only"
                checked={blockedOnly}
                onCheckedChange={onBlockedOnlyChange}
              />
              <Label htmlFor="blocked-only" className="text-sm">
                Blocked only
              </Label>
            </div>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No execution logs available</p>
            {blockedOnly && <p className="mt-2 text-sm">Try disabling the "Blocked only" filter</p>}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Input</TableHead>
                  <TableHead>Output</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Gate</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-sm">
                      {formatDistanceToNow(new Date(log.created_at))}
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <p className="truncate text-sm">{log.input_preview || '-'}</p>
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <p className="truncate text-sm">{log.output_preview || '-'}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      {log.claw_blocked ? (
                        <Badge variant="destructive" className="text-xs">
                          Blocked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-500/10 text-xs text-green-500">
                          Passed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <GateBadge gate={log.blocked_gate} />
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatLatency(log.execution_time_ms)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right font-mono text-sm">
                      {formatCurrency(log.cost_usd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {total > pageSize && (
              <div className="flex justify-center pt-4">
                <Pagination
                  page={page}
                  limit={pageSize}
                  total={total}
                  onPageChange={onPageChange}
                  showLimitSelector={false}
                />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
