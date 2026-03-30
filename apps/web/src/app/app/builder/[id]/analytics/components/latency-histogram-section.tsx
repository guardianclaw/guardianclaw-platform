'use client'

/**
 * Latency Histogram Section Component
 *
 * Displays latency distribution with P50/P75/P95/P99 percentiles
 * and a histogram showing the distribution of response times.
 */

import { Clock, Zap, AlertTriangle, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { LatencyPercentiles } from '@/lib/api'

interface LatencyHistogramSectionProps {
  latencyPercentiles: LatencyPercentiles
  loading?: boolean
}

function formatLatency(ms: number): string {
  if (ms === 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function getLatencyStatus(p95: number): { status: string; color: string; icon: typeof Zap } {
  if (p95 === 0) return { status: 'No data', color: 'text-muted-foreground', icon: Clock }
  if (p95 < 500) return { status: 'Excellent', color: 'text-green-500', icon: Zap }
  if (p95 < 1000) return { status: 'Good', color: 'text-blue-500', icon: Clock }
  if (p95 < 2500) return { status: 'Acceptable', color: 'text-yellow-500', icon: TrendingUp }
  return { status: 'Slow', color: 'text-red-500', icon: AlertTriangle }
}

function PercentileSkeleton() {
  return (
    <div className="text-center">
      <Skeleton className="mx-auto mb-1 h-3 w-8" />
      <Skeleton className="mx-auto h-6 w-16" />
    </div>
  )
}

function HistogramBarSkeleton() {
  return (
    <div className="flex-1">
      <Skeleton className="h-20 w-full rounded-t" />
      <Skeleton className="mt-1 h-3 w-full" />
    </div>
  )
}

export function LatencyHistogramSection({
  latencyPercentiles,
  loading,
}: LatencyHistogramSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="mt-1 h-4 w-48" />
        </CardHeader>
        <CardContent>
          {/* Percentiles skeleton */}
          <div className="mb-6 grid grid-cols-5 gap-4">
            <PercentileSkeleton />
            <PercentileSkeleton />
            <PercentileSkeleton />
            <PercentileSkeleton />
            <PercentileSkeleton />
          </div>
          {/* Histogram skeleton */}
          <div className="flex h-24 items-end gap-1">
            <HistogramBarSkeleton />
            <HistogramBarSkeleton />
            <HistogramBarSkeleton />
            <HistogramBarSkeleton />
            <HistogramBarSkeleton />
            <HistogramBarSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const { p50, p75, p95, p99, max, distribution } = latencyPercentiles
  const { status, color, icon: StatusIcon } = getLatencyStatus(p95)
  const hasData = distribution.some((d) => d.count > 0)
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

  if (!hasData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="text-muted-foreground h-5 w-5" aria-hidden="true" />
            Latency Distribution
          </CardTitle>
          <CardDescription>No latency data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            <p>Latency metrics will appear after agent executions</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="text-claw-500 h-5 w-5" aria-hidden="true" />
              Latency Distribution
            </CardTitle>
            <CardDescription>Response time percentiles and distribution</CardDescription>
          </div>
          <Badge variant="outline" className={cn('flex items-center gap-1', color)}>
            <StatusIcon className="h-3 w-3" aria-hidden="true" />
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Percentile Cards */}
        <div className="mb-6 grid grid-cols-5 gap-4" role="list" aria-label="Latency percentiles">
          {[
            { label: 'P50', value: p50, description: 'Median' },
            { label: 'P75', value: p75, description: '75th percentile' },
            { label: 'P95', value: p95, description: '95th percentile' },
            { label: 'P99', value: p99, description: '99th percentile' },
            { label: 'Max', value: max, description: 'Maximum' },
          ].map(({ label, value, description }) => (
            <div
              key={label}
              className="bg-muted/30 rounded-lg p-2 text-center"
              role="listitem"
              aria-label={`${description}: ${formatLatency(value)}`}
            >
              <div className="text-muted-foreground mb-1 text-xs">{label}</div>
              <div className="text-lg font-semibold tabular-nums">{formatLatency(value)}</div>
            </div>
          ))}
        </div>

        {/* Histogram */}
        <div className="space-y-2">
          <div className="text-muted-foreground text-xs">Distribution</div>
          <div
            className="flex h-24 items-end gap-1"
            role="img"
            aria-label="Latency distribution histogram"
          >
            {distribution.map((bucket) => {
              const height = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0
              const isHighlighted = bucket.count === maxCount && bucket.count > 0

              return (
                <div key={bucket.bucket} className="flex flex-1 flex-col items-center">
                  <div
                    className={cn(
                      'w-full rounded-t transition-all duration-300',
                      isHighlighted ? 'bg-claw-500' : 'bg-muted-foreground/30',
                      bucket.count > 0 ? 'min-h-[4px]' : ''
                    )}
                    style={{ height: `${Math.max(height, bucket.count > 0 ? 4 : 0)}%` }}
                    title={`${bucket.bucket}: ${bucket.count} requests`}
                  />
                  <div className="text-muted-foreground mt-1 w-full truncate whitespace-nowrap text-center text-[10px]">
                    {bucket.bucket.replace('ms', '').replace('-', '–')}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="text-muted-foreground mt-4 flex items-center justify-between border-t pt-4 text-xs">
          <span>Response time buckets</span>
          <span>{distribution.reduce((sum, d) => sum + d.count, 0)} total requests</span>
        </div>
      </CardContent>
    </Card>
  )
}
