'use client'

import { type HealthStats } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { CheckCircle2, AlertCircle, XCircle, HelpCircle, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface HealthStatusWidgetProps {
  health: HealthStats | null
  loading?: boolean
}

const healthConfig = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/20',
    label: 'Healthy',
    description: 'Agent is performing well',
  },
  degraded: {
    icon: AlertCircle,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    label: 'Degraded',
    description: 'Some executions are failing',
  },
  unhealthy: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/20',
    label: 'Unhealthy',
    description: 'High failure rate detected',
  },
  unknown: {
    icon: HelpCircle,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
    label: 'Unknown',
    description: 'No recent executions',
  },
}

function formatTimeAgo(timestamp: string | null): string {
  if (!timestamp) return 'Never'
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  } catch {
    return 'Unknown'
  }
}

export function HealthStatusWidget({ health, loading }: HealthStatusWidgetProps) {
  if (loading) {
    return (
      <div className="bg-card flex items-center gap-3 rounded-lg border p-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    )
  }

  if (!health) {
    return null
  }

  const config = healthConfig[health.status]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex cursor-help items-center gap-3 rounded-lg border p-3 transition-colors',
              config.bgColor,
              config.borderColor
            )}
          >
            <div className={cn('rounded-full p-2', config.bgColor)}>
              <Icon className={cn('h-5 w-5', config.color)} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{config.label}</span>
                {health.stats.total_executions > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {health.stats.success_rate.toFixed(0)}%
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                Last exec: {formatTimeAgo(health.stats.last_execution_at)}
              </p>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium">{config.description}</p>
            <div className="space-y-1 text-xs">
              <p>
                <span className="text-muted-foreground">Last 24h:</span>{' '}
                {health.stats.total_executions} executions
              </p>
              <p>
                <span className="text-muted-foreground">Success:</span>{' '}
                {health.stats.successful_executions} ({health.stats.success_rate.toFixed(1)}%)
              </p>
              <p>
                <span className="text-muted-foreground">Blocked:</span>{' '}
                {health.stats.blocked_executions}
              </p>
              <p>
                <span className="text-muted-foreground">Errors:</span>{' '}
                {health.stats.error_executions}
              </p>
              {health.stats.avg_latency_ms && (
                <p>
                  <span className="text-muted-foreground">Avg latency:</span>{' '}
                  {Math.round(health.stats.avg_latency_ms)}ms
                </p>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for Deploy page
export function HealthStatusBadge({ health, loading }: HealthStatusWidgetProps) {
  if (loading) {
    return <Skeleton className="h-6 w-20" />
  }

  if (!health) {
    return null
  }

  const config = healthConfig[health.status]
  const Icon = config.icon

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn('cursor-help', config.bgColor, config.borderColor, config.color)}
          >
            <Icon className="mr-1 h-3 w-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-medium">{config.description}</p>
            <p>{health.stats.total_executions} executions in last 24h</p>
            {health.stats.success_rate > 0 && (
              <p>Success rate: {health.stats.success_rate.toFixed(1)}%</p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
