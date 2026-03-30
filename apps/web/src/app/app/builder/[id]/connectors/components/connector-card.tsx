'use client'

/**
 * Connector Card Component
 *
 * Displays a single social connector with test and delete actions.
 */

import { useState } from 'react'
import {
  Twitter,
  MessageCircle,
  Send,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  Loader2,
  MoreVertical,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { ToolCredential } from '@/lib/api'

// Platform configuration
const platformConfig: Record<
  string,
  {
    icon: typeof Twitter
    label: string
    color: string
    bgColor: string
    borderColor: string
  }
> = {
  twitter_api: {
    icon: Twitter,
    label: 'Twitter',
    color: 'text-sky-500',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/20',
  },
  discord_bot: {
    icon: MessageCircle,
    label: 'Discord',
    color: 'text-indigo-500',
    bgColor: 'bg-indigo-500/10',
    borderColor: 'border-indigo-500/20',
  },
  telegram_bot: {
    icon: Send,
    label: 'Telegram',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
  },
}

// Format relative time
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return 'Never'

  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export interface ConnectorCardProps {
  credential: ToolCredential
  onTest: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  testing?: boolean
  deleting?: boolean
  testResult?: { success: boolean; message: string } | null
}

export function ConnectorCard({
  credential,
  onTest,
  onDelete,
  testing = false,
  deleting = false,
  testResult,
}: ConnectorCardProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const config = platformConfig[credential.tool_type] || {
    icon: Send,
    label: 'Unknown',
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/20',
  }
  const Icon = config.icon

  const handleDelete = async () => {
    await onDelete(credential.id)
    setDeleteDialogOpen(false)
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center justify-between rounded-lg border p-4',
          config.bgColor,
          config.borderColor
        )}
      >
        <div className="flex items-center gap-4">
          {/* Platform icon */}
          <div className={cn('bg-background/50 rounded-lg p-2')}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>

          {/* Credential info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{credential.name}</span>
              <Badge variant="outline" className="text-xs">
                {config.label}
              </Badge>
              {!credential.is_active && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="text-muted-foreground flex items-center gap-3 text-xs">
              <span className="font-mono">{credential.credential_preview}</span>
              <span>Last used: {formatRelativeTime(credential.last_used_at)}</span>
              {credential.usage_count > 0 && <span>{credential.usage_count} uses</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Test result */}
          {testResult && (
            <div
              className={cn(
                'flex items-center gap-1 rounded px-2 py-1 text-xs',
                testResult.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
              )}
            >
              {testResult.success ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : (
                <XCircle className="h-3 w-3" />
              )}
              <span className="max-w-[150px] truncate">{testResult.message}</span>
            </div>
          )}

          {/* Test button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTest(credential.id)}
            disabled={testing || deleting}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Play className="mr-1 h-4 w-4" />
                Test
              </>
            )}
          </Button>

          {/* More actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={deleting}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connector?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the &quot;{credential.name}&quot; {config.label}{' '}
              connector. Any flow nodes using this connector will stop working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Connector
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
