'use client'

import { Wrench, CheckCircle, Clock, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ToolStats } from '@/lib/api'

interface ToolsSectionProps {
  tools: ToolStats[]
  loading?: boolean
}

interface ToolConfig {
  name: string
  icon: typeof Wrench
  color: string
}

const toolConfig: Record<string, ToolConfig> = {
  web_search: { name: 'Web Search', icon: Zap, color: 'text-blue-500' },
  api_request: { name: 'API Request', icon: Zap, color: 'text-purple-500' },
  code_execution: { name: 'Code Execution', icon: Zap, color: 'text-orange-500' },
  file_operation: { name: 'File Operation', icon: Zap, color: 'text-green-500' },
  database_query: { name: 'Database Query', icon: Zap, color: 'text-cyan-500' },
}

function formatLatency(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${Math.round(ms)}ms`
}

function ToolRowSkeleton() {
  return (
    <div className="bg-muted/30 flex items-center justify-between rounded-lg p-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded" />
        <div>
          <Skeleton className="mb-1 h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  )
}

function SummaryBoxSkeleton() {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <Skeleton className="mx-auto mb-1 h-8 w-16" />
      <Skeleton className="mx-auto h-3 w-20" />
    </div>
  )
}

export function ToolsSection({ tools, loading }: ToolsSectionProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="mt-1 h-4 w-44" />
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid grid-cols-3 gap-4">
            <SummaryBoxSkeleton />
            <SummaryBoxSkeleton />
            <SummaryBoxSkeleton />
          </div>
          <div className="space-y-3">
            <ToolRowSkeleton />
            <ToolRowSkeleton />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (tools.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="text-muted-foreground h-5 w-5" />
            Tool Usage
          </CardTitle>
          <CardDescription>No tool calls in this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground py-8 text-center">
            Tool usage metrics will appear when your agent uses tools
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalCalls = tools.reduce((sum, t) => sum + t.total_calls, 0)
  const totalSuccess = tools.reduce((sum, t) => sum + t.success_count, 0)
  const avgLatency =
    totalCalls > 0
      ? tools.reduce((sum, t) => sum + t.avg_latency_ms * t.total_calls, 0) / totalCalls
      : 0
  const successRate = totalCalls > 0 ? ((totalSuccess / totalCalls) * 100).toFixed(1) : '0'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-purple-500" />
          Tool Usage
        </CardTitle>
        <CardDescription>Agent tool execution metrics</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{totalCalls.toLocaleString()}</div>
            <div className="text-muted-foreground text-xs">Total Calls</div>
          </div>
          <div className="rounded-lg bg-green-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-green-500">{successRate}%</div>
            <div className="text-muted-foreground text-xs">Success Rate</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{formatLatency(avgLatency)}</div>
            <div className="text-muted-foreground text-xs">Avg Latency</div>
          </div>
        </div>

        {/* Per tool */}
        <div className="space-y-3">
          {tools.map((tool) => {
            const config = toolConfig[tool.tool_type] || {
              name: tool.tool_type,
              icon: Wrench,
              color: 'text-gray-500',
            }
            const Icon = config.icon
            const toolSuccessRate =
              tool.total_calls > 0
                ? ((tool.success_count / tool.total_calls) * 100).toFixed(0)
                : '0'

            return (
              <div
                key={tool.tool_type}
                className="bg-muted/30 flex items-center justify-between rounded-lg p-3"
              >
                <div className="flex items-center gap-3">
                  <div className={cn('bg-muted/50 rounded-md p-2', config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-medium">{config.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {tool.total_calls.toLocaleString()} calls
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1 text-green-500">
                    <CheckCircle className="h-4 w-4" />
                    {toolSuccessRate}%
                  </span>
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {formatLatency(tool.avg_latency_ms)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
