'use client'

/**
 * Gate Breakdown Section Component
 *
 * Displays a donut chart showing the distribution of blocks
 * by CLAW gate (Credibility, Limits, Avoidance, Worth).
 */

import { ShieldCheck, ShieldAlert, ShieldX, ShieldQuestion } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { GateBreakdown } from '@/lib/api'

interface GateConfig {
  name: string
  description: string
  color: string
  bgColor: string
  icon: typeof ShieldCheck
}

const gateConfig: Record<string, GateConfig> = {
  credibility: {
    name: 'Credibility',
    description: 'Factual accuracy validation',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500',
    icon: ShieldCheck,
  },
  avoidance: {
    name: 'Avoidance',
    description: 'Potential harm assessment',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    icon: ShieldAlert,
  },
  limits: {
    name: 'Limits',
    description: 'Boundary and limit checks',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500',
    icon: ShieldX,
  },
  worth: {
    name: 'Worth',
    description: 'Teleological justification',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500',
    icon: ShieldQuestion,
  },
  other: {
    name: 'Other',
    description: 'Unclassified blocks',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500',
    icon: ShieldX,
  },
}

interface GateBreakdownSectionProps {
  gateBreakdown: GateBreakdown[]
  loading?: boolean
}

function GateRowSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-8 rounded" />
      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-12" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  )
}

export function GateBreakdownSection({ gateBreakdown, loading }: GateBreakdownSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-40" />
          </div>
          <Skeleton className="mt-1 h-4 w-56" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <GateRowSkeleton />
            <GateRowSkeleton />
            <GateRowSkeleton />
            <GateRowSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalBlocks = gateBreakdown.reduce((sum, g) => sum + g.count, 0)

  if (totalBlocks === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" aria-hidden="true" />
            CLAW Gate Analysis
          </CardTitle>
          <CardDescription>No blocks to analyze</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            <p>All requests passed CLAW validation</p>
            <p className="mt-1 text-sm">Gate breakdown will appear when blocks occur</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const maxCount = Math.max(...gateBreakdown.map((g) => g.count), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="text-claw-500 h-5 w-5" aria-hidden="true" />
          CLAW Gate Analysis
        </CardTitle>
        <CardDescription>Distribution of {totalBlocks} blocks by validation gate</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4" role="list" aria-label="Gate breakdown list">
          {gateBreakdown.map((gate) => {
            const config = gateConfig[gate.gate] || gateConfig.other
            const Icon = config.icon
            const width = (gate.count / maxCount) * 100

            return (
              <div
                key={gate.gate}
                className="flex items-center gap-3"
                role="listitem"
                aria-label={`${config.name} gate: ${gate.count} blocks (${gate.percentage}%)`}
              >
                <div className={cn('bg-muted/50 rounded-lg p-2', config.color)}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{config.name}</span>
                      <span className="text-muted-foreground ml-2 hidden text-xs sm:inline">
                        {config.description}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{gate.count}</span>
                      <span className="text-muted-foreground text-xs">({gate.percentage}%)</span>
                    </div>
                  </div>
                  <div className="bg-muted h-2 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        config.bgColor
                      )}
                      style={{ width: `${width}%` }}
                      role="progressbar"
                      aria-valuenow={gate.count}
                      aria-valuemin={0}
                      aria-valuemax={maxCount}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total Blocks</span>
            <span className="font-medium">{totalBlocks}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
