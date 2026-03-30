'use client'

import { Database, BookOpen, Edit3, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MemoryStats } from '@/lib/api'

interface MemorySectionProps {
  memory: MemoryStats
  loading?: boolean
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`
  }
  return count.toLocaleString()
}

function MetricBoxSkeleton() {
  return (
    <div className="bg-muted/30 rounded-lg p-4 text-center">
      <Skeleton className="mx-auto mb-2 h-5 w-5 rounded" />
      <Skeleton className="mx-auto mb-1 h-8 w-16" />
      <Skeleton className="mx-auto h-3 w-20" />
    </div>
  )
}

export function MemorySection({ memory, loading }: MemorySectionProps) {
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
          <div className="grid grid-cols-3 gap-4">
            <MetricBoxSkeleton />
            <MetricBoxSkeleton />
            <MetricBoxSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalOperations = memory.reads + memory.writes
  const hasActivity = totalOperations > 0 || memory.shield_blocks > 0

  if (!hasActivity) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="text-muted-foreground h-5 w-5" />
            Memory Operations
          </CardTitle>
          <CardDescription>No memory operations in this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            Memory metrics will appear when your agent uses persistent memory
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-violet-500" />
          Memory Operations
        </CardTitle>
        <CardDescription>Agent memory and shield protection</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Reads */}
          <div className="rounded-lg bg-blue-500/10 p-4 text-center">
            <BookOpen className="mx-auto mb-2 h-5 w-5 text-blue-500" />
            <div className="text-2xl font-bold text-blue-500">{formatCount(memory.reads)}</div>
            <div className="text-muted-foreground text-xs">Reads</div>
          </div>

          {/* Writes */}
          <div className="rounded-lg bg-emerald-500/10 p-4 text-center">
            <Edit3 className="mx-auto mb-2 h-5 w-5 text-emerald-500" />
            <div className="text-2xl font-bold text-emerald-500">{formatCount(memory.writes)}</div>
            <div className="text-muted-foreground text-xs">Writes</div>
          </div>

          {/* Shield Blocks */}
          <div
            className={cn(
              'rounded-lg p-4 text-center',
              memory.shield_blocks > 0 ? 'bg-red-500/10' : 'bg-muted/50'
            )}
          >
            <ShieldAlert
              className={cn(
                'mx-auto mb-2 h-5 w-5',
                memory.shield_blocks > 0 ? 'text-red-500' : 'text-muted-foreground'
              )}
            />
            <div
              className={cn(
                'text-2xl font-bold',
                memory.shield_blocks > 0 ? 'text-red-500' : 'text-muted-foreground'
              )}
            >
              {formatCount(memory.shield_blocks)}
            </div>
            <div className="text-muted-foreground text-xs">Shield Blocks</div>
          </div>
        </div>

        {/* Shield status indicator */}
        {memory.shield_blocks > 0 && (
          <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
            <div className="flex items-center gap-2 text-sm text-red-500">
              <ShieldAlert className="h-4 w-4" />
              <span>
                Memory Shield blocked {memory.shield_blocks} injection{' '}
                {memory.shield_blocks === 1 ? 'attempt' : 'attempts'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
