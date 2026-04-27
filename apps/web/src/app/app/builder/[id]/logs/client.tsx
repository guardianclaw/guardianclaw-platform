'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAgent } from '../context'
import { useAuth } from '@/hooks/use-auth'
import {
  executionLogsApi,
  type ExecutionLogEntry,
  type ExecutionLogsQuery,
  type HealthStats,
} from '@/lib/api'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Loader2,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Download,
  Copy,
  Clock,
  Zap,
  Bot,
  Webhook,
  MessageSquare,
  Play,
  Radio,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExecutionLogList } from './components/execution-log-list'
import { ExecutionDetail } from './components/execution-detail'
import { HealthStatusWidget } from './components/health-status'
import { useExecutionStream, type StreamedLogEntry } from './hooks'

const PAGE_SIZE = 20

export function LogsPageClient() {
  const { agent, isDemo } = useAgent()
  const { hasSession } = useAuth()
  const [logs, setLogs] = useState<ExecutionLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [selectedLog, setSelectedLog] = useState<ExecutionLogEntry | null>(null)
  const [health, setHealth] = useState<HealthStats | null>(null)

  // Granular loading states
  const [logsLoading, setLogsLoading] = useState(true)
  const [healthLoading, setHealthLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Error states
  const [logsError, setLogsError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [page, setPage] = useState(0)

  // Real-time streaming - only enabled when on first page with no filters
  const streamEnabled = useMemo(() => {
    return page === 0 && statusFilter === 'all' && sourceFilter === 'all'
  }, [page, statusFilter, sourceFilter])

  // Handle new execution from stream
  const handleNewExecution = useCallback((streamedLog: StreamedLogEntry) => {
    // Convert streamed log to full log entry (with missing fields as defaults)
    const newLog: ExecutionLogEntry = {
      id: streamedLog.id,
      event_source: streamedLog.event_source,
      conversation_id: null,
      status: streamedLog.status,
      input_preview: null,
      output_preview: null,
      latency_ms: streamedLog.latency_ms,
      input_tokens: streamedLog.input_tokens,
      output_tokens: streamedLog.output_tokens,
      blocked_by_layer: streamedLog.blocked_by_layer,
      blocked_gate: streamedLog.blocked_gate,
      blocked_reason: null,
      trace: [],
      tools_executed: 0,
      tools_succeeded: 0,
      social_deliveries: 0,
      social_succeeded: 0,
      model: null,
      request_id: null,
      created_at: streamedLog.created_at,
    }

    // Prepend to logs list (avoiding duplicates)
    setLogs((prevLogs) => {
      if (prevLogs.some((log) => log.id === newLog.id)) {
        return prevLogs
      }
      // Keep list size reasonable, remove oldest if exceeding limit
      const updatedLogs = [newLog, ...prevLogs]
      return updatedLogs.slice(0, PAGE_SIZE * 2)
    })

    // Update total count
    setTotal((prev) => prev + 1)
  }, [])

  // Setup real-time stream
  const {
    status: streamStatus,
    error: streamError,
    logsReceived,
    reconnect: reconnectStream,
  } = useExecutionStream(agent?.id, hasSession, {
    enabled: streamEnabled && !isDemo,
    onNewExecution: handleNewExecution,
  })

  const fetchLogs = useCallback(
    async (isRefresh = false) => {
      if (!agent || isDemo) return

      if (isRefresh) {
        setRefreshing(true)
      } else {
        setLogsLoading(true)
      }
      setLogsError(null)

      try {
        const query: ExecutionLogsQuery = {
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        }

        if (statusFilter !== 'all') {
          query.status = statusFilter as 'success' | 'blocked' | 'error'
        }
        if (sourceFilter !== 'all') {
          query.event_source = sourceFilter as 'invoke' | 'conversation' | 'webhook' | 'test'
        }

        const response = await executionLogsApi.list(agent.id, query)
        setLogs(response.logs)
        setTotal(response.total)
      } catch (err) {
        console.error('Failed to fetch logs:', err)
        setLogsError('Failed to load execution logs')
      } finally {
        setLogsLoading(false)
        setRefreshing(false)
      }
    },
    [agent, isDemo, page, statusFilter, sourceFilter]
  )

  const fetchHealth = useCallback(async () => {
    if (!agent || isDemo) return

    setHealthLoading(true)

    try {
      const healthData = await executionLogsApi.getHealth(agent.id)
      setHealth(healthData)
    } catch (err) {
      console.error('Failed to fetch health:', err)
    } finally {
      setHealthLoading(false)
    }
  }, [agent, isDemo])

  useEffect(() => {
    fetchLogs()
    fetchHealth()
  }, [fetchLogs, fetchHealth])

  const handleRefresh = useCallback(() => {
    fetchLogs(true)
    fetchHealth()
  }, [fetchLogs, fetchHealth])

  const handleExport = async () => {
    if (!agent || exportLoading) return

    setExportLoading(true)

    try {
      const exportData = await executionLogsApi.export(agent.id, 7)
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `execution-logs-${agent.id}-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export logs:', err)
    } finally {
      setExportLoading(false)
    }
  }

  const handleCopyLogId = (logId: string) => {
    navigator.clipboard.writeText(logId)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // Demo mode message
  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Logs Not Available</h2>
          <p className="text-muted-foreground">Sign in to view execution logs for your agents.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header with Health Status */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Execution Logs</h1>
                {/* Live Indicator */}
                {streamEnabled && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant={streamStatus === 'connected' ? 'default' : 'outline'}
                          className={cn(
                            'flex cursor-help items-center gap-1.5',
                            streamStatus === 'connected' && 'bg-green-500 hover:bg-green-600',
                            streamStatus === 'connecting' && 'bg-yellow-500 hover:bg-yellow-600',
                            streamStatus === 'error' && 'bg-red-500 hover:bg-red-600'
                          )}
                        >
                          {streamStatus === 'connected' ? (
                            <>
                              <Radio className="h-3 w-3 animate-pulse" />
                              <span>Live</span>
                            </>
                          ) : streamStatus === 'connecting' ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Connecting</span>
                            </>
                          ) : streamStatus === 'error' ? (
                            <>
                              <WifiOff className="h-3 w-3" />
                              <span>Offline</span>
                            </>
                          ) : (
                            <>
                              <WifiOff className="h-3 w-3" />
                              <span>Disconnected</span>
                            </>
                          )}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        {streamStatus === 'connected' ? (
                          <p>
                            Receiving real-time updates.{' '}
                            {logsReceived > 0 && `${logsReceived} new logs received.`}
                          </p>
                        ) : streamStatus === 'connecting' ? (
                          <p>Establishing connection to real-time stream...</p>
                        ) : streamStatus === 'error' ? (
                          <div className="space-y-1">
                            <p className="font-medium">Connection lost</p>
                            {streamError && (
                              <p className="text-muted-foreground text-xs">{streamError}</p>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-1 h-6 text-xs"
                              onClick={reconnectStream}
                            >
                              Reconnect
                            </Button>
                          </div>
                        ) : (
                          <p>Real-time streaming is disabled when using filters or pagination.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
              <p className="text-muted-foreground">Monitor and debug agent executions</p>
            </div>
            <ErrorBoundary>
              <HealthStatusWidget health={health} loading={healthLoading} />
            </ErrorBoundary>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Status:</span>
                  <Select
                    value={statusFilter}
                    onValueChange={(v) => {
                      setStatusFilter(v)
                      setPage(0)
                    }}
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">Source:</span>
                  <Select
                    value={sourceFilter}
                    onValueChange={(v) => {
                      setSourceFilter(v)
                      setPage(0)
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="invoke">API Invoke</SelectItem>
                      <SelectItem value="conversation">Conversation</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="test">Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1" />

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing || logsLoading}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
                  Refresh
                </Button>

                <Button variant="outline" size="sm" onClick={handleExport} disabled={exportLoading}>
                  {exportLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Logs List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recent Executions</CardTitle>
                      <CardDescription>
                        {total > 0 ? `${total} executions found` : 'No executions yet'}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {logsLoading && logs.length === 0 ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
                    </div>
                  ) : logsError ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <AlertCircle className="text-destructive mb-2 h-8 w-8" />
                      <p className="text-destructive">{logsError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchLogs()}
                        className="mt-4"
                      >
                        Try Again
                      </Button>
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bot className="text-muted-foreground mb-4 h-12 w-12" />
                      <p className="text-muted-foreground">No executions found</p>
                      <p className="text-muted-foreground mt-1 text-sm">
                        Logs will appear here when you test or invoke your agent.
                      </p>
                    </div>
                  ) : (
                    <>
                      <ErrorBoundary>
                        <ExecutionLogList
                          logs={logs}
                          selectedId={selectedLog?.id}
                          onSelect={setSelectedLog}
                          onCopyId={handleCopyLogId}
                        />
                      </ErrorBoundary>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="mt-4 flex items-center justify-between border-t pt-4">
                          <p className="text-muted-foreground text-sm">
                            Page {page + 1} of {totalPages}
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPage((p) => Math.max(0, p - 1))}
                              disabled={page === 0}
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                              disabled={page >= totalPages - 1}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detail Panel */}
            <div className="lg:col-span-1">
              <ErrorBoundary>
                <ExecutionDetail log={selectedLog} onCopyId={handleCopyLogId} />
              </ErrorBoundary>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
