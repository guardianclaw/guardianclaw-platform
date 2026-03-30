'use client'

import { type ExecutionLogEntry } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Copy,
  Clock,
  Zap,
  Bot,
  Webhook,
  MessageSquare,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ExecutionLogListProps {
  logs: ExecutionLogEntry[]
  selectedId?: string
  onSelect: (log: ExecutionLogEntry) => void
  onCopyId: (id: string) => void
}

const statusConfig = {
  success: {
    icon: CheckCircle2,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    label: 'Success',
  },
  blocked: {
    icon: ShieldAlert,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    label: 'Blocked',
  },
  error: {
    icon: XCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    label: 'Error',
  },
}

const sourceConfig = {
  invoke: { icon: Zap, label: 'API', color: 'text-blue-500' },
  conversation: { icon: MessageSquare, label: 'Chat', color: 'text-purple-500' },
  webhook: { icon: Webhook, label: 'Webhook', color: 'text-orange-500' },
  test: { icon: Play, label: 'Test', color: 'text-gray-500' },
}

function formatTimestamp(timestamp: string): string {
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffSecs < 60) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return timestamp
  }
}

export function ExecutionLogList({ logs, selectedId, onSelect, onCopyId }: ExecutionLogListProps) {
  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const status = statusConfig[log.status]
        const source = sourceConfig[log.event_source]
        const StatusIcon = status.icon
        const SourceIcon = source.icon
        const isSelected = selectedId === log.id

        return (
          <div
            key={log.id}
            onClick={() => onSelect(log)}
            className={cn(
              'group cursor-pointer rounded-lg border p-3 transition-colors',
              'hover:bg-muted/50',
              isSelected && 'bg-muted border-primary'
            )}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className={cn('mt-0.5 rounded-full p-1.5', status.bgColor)}>
                <StatusIcon className={cn('h-4 w-4', status.color)} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {/* Source Badge */}
                  <Badge variant="outline" className="text-xs">
                    <SourceIcon className={cn('mr-1 h-3 w-3', source.color)} />
                    {source.label}
                  </Badge>

                  {/* Blocked Gate */}
                  {log.blocked_by_layer && (
                    <Badge variant="secondary" className="text-xs">
                      {log.blocked_by_layer}
                      {log.blocked_gate && ` - ${log.blocked_gate}`}
                    </Badge>
                  )}

                  {/* Latency */}
                  {log.latency_ms && (
                    <span className="text-muted-foreground flex items-center gap-1 text-xs">
                      <Clock className="h-3 w-3" />
                      {log.latency_ms}ms
                    </span>
                  )}
                </div>

                {/* Preview */}
                <div className="mt-1.5">
                  {log.input_preview && (
                    <p className="text-muted-foreground truncate text-sm">
                      <span className="text-foreground font-medium">Input:</span>{' '}
                      {log.input_preview}
                    </p>
                  )}
                  {log.output_preview && !log.blocked_reason && (
                    <p className="text-muted-foreground truncate text-sm">
                      <span className="text-foreground font-medium">Output:</span>{' '}
                      {log.output_preview}
                    </p>
                  )}
                  {log.blocked_reason && (
                    <p className="truncate text-sm text-amber-600">
                      <span className="font-medium">Blocked:</span> {log.blocked_reason}
                    </p>
                  )}
                </div>

                {/* Footer */}
                <div className="text-muted-foreground mt-2 flex items-center gap-3 text-xs">
                  <span>{formatTimestamp(log.created_at)}</span>
                  {log.model && <span>Model: {log.model}</span>}
                  {log.tools_executed > 0 && (
                    <span>
                      Tools: {log.tools_succeeded}/{log.tools_executed}
                    </span>
                  )}
                </div>
              </div>

              {/* Copy ID Button */}
              <Button
                variant="ghost"
                size="icon"
                className="pointer-events-auto h-7 w-7 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopyId(log.id)
                }}
                title="Copy execution ID"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
