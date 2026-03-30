'use client'

import { AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { RecentBlockV2 } from '@/lib/api'

interface LayerBadgeConfig {
  label: string
  className: string
}

const layerBadgeConfig: Record<string, LayerBadgeConfig> = {
  L1_input: {
    label: 'L1',
    className: 'bg-red-500/20 text-red-500',
  },
  L3_output: {
    label: 'L3',
    className: 'bg-yellow-500/20 text-yellow-500',
  },
  L4_observer: {
    label: 'L4',
    className: 'bg-blue-500/20 text-blue-500',
  },
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
}

function getLayerName(layer: string): string {
  switch (layer) {
    case 'L1_input':
      return 'L1 Input'
    case 'L3_output':
      return 'L3 Output'
    case 'L4_observer':
      return 'L4 Observer'
    default:
      return layer
  }
}

function BlockRowSkeleton() {
  return (
    <div className="bg-muted/50 flex items-center justify-between rounded-lg p-3">
      <div className="flex items-center gap-4">
        <Skeleton className="h-8 w-8 rounded-full" />
        <div>
          <Skeleton className="mb-1 h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>
      <Skeleton className="h-5 w-8 rounded" />
    </div>
  )
}

interface RecentActivitySectionProps {
  recentBlocks: RecentBlockV2[]
  loading?: boolean
}

export function RecentActivitySection({ recentBlocks, loading }: RecentActivitySectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-28" />
          </div>
          <Skeleton className="mt-1 h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <BlockRowSkeleton />
            <BlockRowSkeleton />
            <BlockRowSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (recentBlocks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Recent Blocks
          </CardTitle>
          <CardDescription>Last blocked requests by GuardianClaw</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">No blocked requests yet</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Recent Blocks
        </CardTitle>
        <CardDescription>Last blocked requests by GuardianClaw</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentBlocks.map((block) => {
            const badgeConfig = layerBadgeConfig[block.layer] || {
              label: block.layer,
              className: 'bg-gray-500/20 text-gray-500',
            }

            return (
              <div
                key={block.id}
                className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Blocked by {getLayerName(block.layer)}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatTimeAgo(block.created_at)}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className={cn(badgeConfig.className)}>
                  {badgeConfig.label}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
