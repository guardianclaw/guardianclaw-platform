'use client'

import { type ExecutionLogEntry, type ExecutionStepTrace } from '@/lib/api'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Copy,
  Clock,
  Zap,
  FileText,
  ChevronRight,
  AlertCircle,
  SkipForward,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExecutionDetailProps {
  log: ExecutionLogEntry | null
  onCopyId: (id: string) => void
}

const stepStatusConfig = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500',
  },
  skipped: {
    icon: SkipForward,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400',
  },
}

function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    return date.toLocaleString()
  } catch {
    return timestamp
  }
}

function StepItem({ step, isLast }: { step: ExecutionStepTrace; isLast: boolean }) {
  const config = stepStatusConfig[step.status]
  const Icon = config.icon

  return (
    <div className="flex gap-3">
      {/* Timeline */}
      <div className="flex flex-col items-center">
        <div className={cn('h-2 w-2 rounded-full', config.bgColor)} />
        {!isLast && <div className="bg-border h-full w-px" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{step.step_name}</span>
          <Icon className={cn('h-3.5 w-3.5', config.color)} />
        </div>
        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
          <span>{step.step_type}</span>
          <span>-</span>
          <span>{step.duration_ms}ms</span>
        </div>
        {step.error && <p className="mt-1 text-xs text-red-500">{step.error}</p>}
      </div>
    </div>
  )
}

export function ExecutionDetail({ log, onCopyId }: ExecutionDetailProps) {
  if (!log) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Execution Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="text-muted-foreground mb-3 h-10 w-10" />
            <p className="text-muted-foreground">Select an execution to view details</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Execution Details</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCopyId(log.id)}
            title="Copy execution ID"
          >
            <Copy className="mr-2 h-4 w-4" />
            Copy ID
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status & Metadata */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Status</span>
            <Badge
              variant={
                log.status === 'success'
                  ? 'default'
                  : log.status === 'blocked'
                    ? 'secondary'
                    : 'destructive'
              }
            >
              {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Source</span>
            <span className="text-sm">{log.event_source}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Timestamp</span>
            <span className="text-sm">{formatDate(log.created_at)}</span>
          </div>

          {log.latency_ms && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Latency</span>
              <span className="text-sm">{log.latency_ms}ms</span>
            </div>
          )}

          {log.model && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Model</span>
              <span className="font-mono text-sm">{log.model}</span>
            </div>
          )}

          {(log.input_tokens || log.output_tokens) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Tokens</span>
              <span className="text-sm">
                {log.input_tokens || 0} in / {log.output_tokens || 0} out
              </span>
            </div>
          )}
        </div>

        {/* Blocking Info */}
        {log.status === 'blocked' && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3">
            <div className="mb-2 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-600">Blocked by GuardianClaw</span>
            </div>
            <div className="space-y-1 text-sm">
              {log.blocked_by_layer && (
                <p>
                  <span className="text-muted-foreground">Layer:</span>{' '}
                  <span className="font-mono">{log.blocked_by_layer}</span>
                </p>
              )}
              {log.blocked_gate && (
                <p>
                  <span className="text-muted-foreground">Gate:</span>{' '}
                  <span className="font-mono">{log.blocked_gate}</span>
                </p>
              )}
              {log.blocked_reason && (
                <p>
                  <span className="text-muted-foreground">Reason:</span> {log.blocked_reason}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Input Preview */}
        {log.input_preview && (
          <div>
            <p className="mb-2 text-sm font-medium">Input</p>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-muted-foreground break-words text-sm">{log.input_preview}</p>
            </div>
          </div>
        )}

        {/* Output Preview */}
        {log.output_preview && (
          <div>
            <p className="mb-2 text-sm font-medium">Output</p>
            <div className="bg-muted rounded-lg p-3">
              <p className="text-muted-foreground break-words text-sm">{log.output_preview}</p>
            </div>
          </div>
        )}

        {/* Tools & Social */}
        {(log.tools_executed > 0 || log.social_deliveries > 0) && (
          <div className="flex gap-4">
            {log.tools_executed > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Zap className="h-4 w-4 text-blue-500" />
                <span>
                  Tools: {log.tools_succeeded}/{log.tools_executed}
                </span>
              </div>
            )}
            {log.social_deliveries > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <ChevronRight className="h-4 w-4 text-purple-500" />
                <span>
                  Social: {log.social_succeeded}/{log.social_deliveries}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Execution Trace */}
        {log.trace && log.trace.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-medium">Execution Trace</p>
            <div className="space-y-0">
              {log.trace.map((step, index) => (
                <StepItem key={step.step_id} step={step} isLast={index === log.trace.length - 1} />
              ))}
            </div>
          </div>
        )}

        {/* Request ID */}
        {log.request_id && (
          <div className="border-t pt-2">
            <p className="text-muted-foreground text-xs">
              Request ID: <span className="font-mono">{log.request_id}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
