'use client'

/**
 * Rollback Dialog Component
 *
 * Confirmation dialog for rolling back to a previous deployment version.
 * Shows version info and accepts optional notes.
 */

import { RotateCcw, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { ENV_CONFIG } from './environment-card'
import type { DeploymentHistoryEntry } from '@/lib/api'

// ============================================
// TYPES
// ============================================

export interface RollbackDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Handler for dialog open state change */
  onOpenChange: (open: boolean) => void
  /** The deployment entry to rollback to */
  entry: DeploymentHistoryEntry | null
  /** Optional notes for the rollback */
  notes: string
  /** Handler for notes change */
  onNotesChange: (notes: string) => void
  /** Handler for rollback action */
  onRollback: () => void
  /** Whether rollback is in progress */
  rollingBack?: boolean
}

// ============================================
// COMPONENT
// ============================================

export function RollbackDialog({
  open,
  onOpenChange,
  entry,
  notes,
  onNotesChange,
  onRollback,
  rollingBack = false,
}: RollbackDialogProps) {
  const version = entry?.version ?? 0
  const envLabel = entry ? ENV_CONFIG[entry.environment].label : ''

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-500" aria-hidden="true" />
            Rollback to v{version}?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                This will create a new deployment in <strong>{envLabel}</strong> using the
                configuration from <strong>version {version}</strong>.
              </p>
              <div
                className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3"
                role="alert"
              >
                <AlertTriangle
                  className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500"
                  aria-hidden="true"
                />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  The current active deployment will be stopped and replaced with this version.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <Label htmlFor="rollback-notes" className="text-sm font-medium">
            Notes
            <span className="text-muted-foreground ml-1 font-normal">(optional)</span>
          </Label>
          <Textarea
            id="rollback-notes"
            placeholder="e.g., Reverting due to bug in v3"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="mt-2"
            rows={2}
            disabled={rollingBack}
            aria-describedby="rollback-notes-hint"
          />
          <p id="rollback-notes-hint" className="text-muted-foreground mt-1 text-xs">
            Document why you are rolling back for your deployment history.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onRollback}
            disabled={rollingBack}
            className="bg-claw-600 hover:bg-claw-700"
            aria-label={
              rollingBack
                ? `Rolling back to version ${version}`
                : `Confirm rollback to version ${version}`
            }
          >
            {rollingBack ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {rollingBack ? 'Rolling back...' : 'Rollback'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
