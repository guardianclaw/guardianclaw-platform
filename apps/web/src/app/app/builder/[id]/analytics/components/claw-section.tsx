'use client'

import { Shield } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { LayerStats } from '@/lib/api'

interface LayerConfig {
  name: string
  color: string
  description: string
}

const layerConfig: Record<string, LayerConfig> = {
  L1_input: {
    name: 'L1 Input Validator',
    color: 'bg-red-500',
    description: 'Pattern-based input filtering',
  },
  L3_output: {
    name: 'L3 Output Validator',
    color: 'bg-yellow-500',
    description: 'Response safety checks',
  },
  L4_observer: {
    name: 'L4 Observer',
    color: 'bg-blue-500',
    description: 'LLM-based semantic analysis',
  },
}

interface GuardianClawSectionProps {
  layers: LayerStats[]
  loading?: boolean
}

function LayerRowSkeleton() {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  )
}

export function GuardianClawSection({ layers, loading }: GuardianClawSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-32" />
          </div>
          <Skeleton className="mt-1 h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <LayerRowSkeleton />
            <LayerRowSkeleton />
            <LayerRowSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalBlocked = layers.reduce((sum, l) => sum + l.blocked_count, 0)

  if (totalBlocked === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-500" />
            GuardianClaw Protection
          </CardTitle>
          <CardDescription>All requests passed validation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">No blocks in this period</div>
        </CardContent>
      </Card>
    )
  }

  const maxBlocked = Math.max(...layers.map((l) => l.blocked_count), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="text-claw-500 h-5 w-5" />
          Blocks by Layer
        </CardTitle>
        <CardDescription>GuardianClaw 4-layer architecture protection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {layers.map((stat) => {
            const config = layerConfig[stat.layer] || {
              name: stat.layer,
              color: 'bg-gray-500',
              description: '',
            }
            const width = (stat.blocked_count / maxBlocked) * 100

            return (
              <div key={stat.layer}>
                <div className="mb-1 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium">{config.name}</span>
                    <span className="text-muted-foreground ml-2 text-xs">{config.description}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">{stat.blocked_count} blocks</span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className={cn('h-full rounded-full transition-all', config.color)}
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
