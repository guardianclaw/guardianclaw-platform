'use client'

/**
 * Deploy History Dialog Component
 *
 * Displays deployment history with filtering by environment.
 * Allows rollback to previous versions and shows deployment metadata.
 */

import { History, Loader2, RotateCcw, ArrowRightCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { ENV_CONFIG } from './environment-card'
import type { DeploymentHistoryEntry, Environment } from '@/lib/api'

// ============================================
// TYPES
// ============================================

export interface DeployHistoryDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Handler for dialog open state change */
  onOpenChange: (open: boolean) => void
  /** List of deployment history entries */
  history: DeploymentHistoryEntry[]
  /** Whether history is loading */
  loading?: boolean
  /** Current environment filter */
  envFilter: Environment | 'all'
  /** Handler for environment filter change */
  onEnvFilterChange: (env: Environment | 'all') => void
  /** Handler for rollback action */
  onRollback: (entry: DeploymentHistoryEntry) => void
}

// ============================================
// HELPERS
// ============================================

function formatDateTime(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Invalid date'
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface HistoryEntryProps {
  entry: DeploymentHistoryEntry
  onRollback: (entry: DeploymentHistoryEntry) => void
}

function HistoryEntry({ entry, onRollback }: HistoryEntryProps) {
  const envConfig = ENV_CONFIG[entry.environment]

  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        entry.is_active ? 'border-green-500/50 bg-green-500/5' : 'border-border hover:bg-muted/50'
      )}
      role="listitem"
      aria-label={`Version ${entry.version} deployed to ${envConfig.label}${entry.is_active ? ', currently active' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={cn('text-xs', envConfig.color)}
            aria-label={`Environment: ${envConfig.label}`}
          >
            {envConfig.label}
          </Badge>
          <span className="text-sm font-medium" aria-label={`Version ${entry.version}`}>
            v{entry.version}
          </span>
          {entry.is_active && (
            <Badge variant="outline" className="text-xs text-green-600">
              Active
            </Badge>
          )}
          {entry.rollback_from && (
            <Badge variant="outline" className="text-xs">
              <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
              Rollback
            </Badge>
          )}
          {entry.promoted_from && (
            <Badge variant="outline" className="text-xs">
              <ArrowRightCircle className="mr-1 h-3 w-3" aria-hidden="true" />
              Promoted
            </Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label={`Actions for version ${entry.version}`}>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => onRollback(entry)}
              aria-label={`Rollback to version ${entry.version}`}
            >
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Rollback to this version
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="text-muted-foreground text-xs">
        <time dateTime={entry.created_at}>{formatDateTime(entry.created_at)}</time>
        {entry.notes && (
          <span className="text-foreground/70 ml-2">
            {'• '}
            <span aria-label={`Notes: ${entry.notes}`}>{entry.notes}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function DeployHistoryDialog({
  open,
  onOpenChange,
  history,
  loading = false,
  envFilter,
  onEnvFilterChange,
  onRollback,
}: DeployHistoryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" aria-hidden="true" />
              Deployment History
            </DialogTitle>
            <div className="flex-shrink-0">
              <Select
                value={envFilter}
                onValueChange={(v) => onEnvFilterChange(v as Environment | 'all')}
              >
                <SelectTrigger className="w-36" aria-label="Filter by environment">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  <SelectItem value="dev">Development</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="prod">Production</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </DialogHeader>

        <div
          className="h-[400px] overflow-y-auto pr-4"
          role="list"
          aria-label="Deployment history entries"
          aria-busy={loading}
        >
          {loading ? (
            <div
              className="flex h-32 items-center justify-center"
              role="status"
              aria-label="Loading deployment history"
            >
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading deployment history...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center" role="status">
              No deployment history found.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <HistoryEntry key={entry.id} entry={entry} onRollback={onRollback} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
