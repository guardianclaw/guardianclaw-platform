'use client'

import { TrendingUp, TrendingDown, Shield, CheckCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface OverviewSectionProps {
  summary: {
    total_requests: number
    total_blocked: number
    block_rate: number
    avg_latency_ms: number
  }
  loading?: boolean
}

function OverviewCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-1 h-9 w-20" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-28" />
      </CardContent>
    </Card>
  )
}

export function OverviewSection({ summary, loading }: OverviewSectionProps) {
  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        <OverviewCardSkeleton />
        <OverviewCardSkeleton />
        <OverviewCardSkeleton />
        <OverviewCardSkeleton />
      </div>
    )
  }

  const successRate = (100 - summary.block_rate).toFixed(1)

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total Requests</CardDescription>
          <CardTitle className="text-3xl">{summary.total_requests.toLocaleString()}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center text-sm">
            <TrendingUp className="mr-1 h-4 w-4" />
            Last 7 days
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Blocked Requests</CardDescription>
          <CardTitle className="text-3xl">{summary.total_blocked}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex items-center text-sm">
            <Shield className="mr-1 h-4 w-4" />
            {summary.block_rate}% block rate
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Avg Latency</CardDescription>
          <CardTitle className="text-3xl">{summary.avg_latency_ms}ms</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-sm text-green-500">
            <TrendingDown className="mr-1 h-4 w-4" />
            Response time
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Success Rate</CardDescription>
          <CardTitle className="text-3xl">{successRate}%</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-sm text-green-500">
            <CheckCircle className="mr-1 h-4 w-4" />
            {parseFloat(successRate) >= 95 ? 'Healthy' : 'Monitor'}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
