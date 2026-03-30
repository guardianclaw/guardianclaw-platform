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
import { GateBadge } from './badges'
import { BarChart3, Shield } from 'lucide-react'

// Helper functions
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

export interface AnalyticsDay {
  date: string
  requests: number
  blocks: number
  block_rate: number
  avg_latency_ms: number
  gate_truth_blocks: number
  gate_harm_blocks: number
  gate_scope_blocks: number
  gate_purpose_blocks: number
}

export interface AnalyticsSummary {
  total_requests: number
  total_blocks: number
  block_rate: number
  avg_latency_ms?: number
  gate_truth_blocks: number
  gate_harm_blocks: number
  gate_scope_blocks: number
  gate_purpose_blocks: number
}

export interface AgentAnalyticsTableProps {
  analytics: AnalyticsDay[]
  isLoading: boolean
  maxDays?: number
}

export function AgentAnalyticsTable({
  analytics,
  isLoading,
  maxDays = 14,
}: AgentAnalyticsTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  if (analytics.length === 0) {
    return (
      <div className="text-muted-foreground py-12 text-center">
        <BarChart3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
        <p>No analytics data available</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Requests</TableHead>
          <TableHead className="text-right">Blocks</TableHead>
          <TableHead className="text-right">Block Rate</TableHead>
          <TableHead className="text-right">Avg Latency</TableHead>
          <TableHead className="text-right">Credibility</TableHead>
          <TableHead className="text-right">Avoidance</TableHead>
          <TableHead className="text-right">Limits</TableHead>
          <TableHead className="text-right">Worth</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {analytics.slice(0, maxDays).map((day) => (
          <TableRow key={day.date}>
            <TableCell className="font-medium">{formatDate(new Date(day.date))}</TableCell>
            <TableCell className="text-right font-mono">{formatNumber(day.requests)}</TableCell>
            <TableCell className="text-right font-mono">
              {day.blocks > 0 ? (
                <span className="text-red-500">{formatNumber(day.blocks)}</span>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell className="text-right">{formatPercentage(day.block_rate)}</TableCell>
            <TableCell className="text-muted-foreground text-right font-mono">
              {formatLatency(day.avg_latency_ms)}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {day.gate_truth_blocks || '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {day.gate_harm_blocks || '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {day.gate_scope_blocks || '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {day.gate_purpose_blocks || '-'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export interface GateBreakdownProps {
  summary: AnalyticsSummary
}

export function GateBreakdown({ summary }: GateBreakdownProps) {
  if (summary.total_blocks === 0) {
    return null
  }

  const gates = [
    { gate: 'credibility', value: summary.gate_truth_blocks, color: 'bg-blue-500' },
    { gate: 'avoidance', value: summary.gate_harm_blocks, color: 'bg-red-500' },
    { gate: 'limits', value: summary.gate_scope_blocks, color: 'bg-yellow-500' },
    { gate: 'worth', value: summary.gate_purpose_blocks, color: 'bg-purple-500' },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4" />
          Block Distribution by Gate
        </CardTitle>
        <CardDescription>
          How blocks are distributed across CLAW gates (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {gates.map(({ gate, value, color }) => {
            const percentage = summary.total_blocks > 0 ? (value / summary.total_blocks) * 100 : 0
            return (
              <div key={gate} className="space-y-2">
                <div className="flex items-center justify-between">
                  <GateBadge gate={gate} />
                  <span className="text-sm font-medium">{formatNumber(value)}</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={`h-full ${color} transition-all`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-muted-foreground text-center text-xs">
                  {formatPercentage(percentage)}
                </p>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
