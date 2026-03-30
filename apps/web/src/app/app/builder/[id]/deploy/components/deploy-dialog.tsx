'use client'

/**
 * Deploy Dialog Component
 *
 * Dialog for deploying to an environment with optional notes.
 */

import { Play, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ENV_CONFIG } from './environment-card'
import type { Environment } from '@/lib/api'

// ============================================
// TYPES
// ============================================

export interface DeployDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Handler for dialog open state change */
  onOpenChange: (open: boolean) => void
  /** Target environment for deployment */
  targetEnv: Environment | null
  /** Optional notes for the deployment */
  notes: string
  /** Handler for notes change */
  onNotesChange: (notes: string) => void
  /** Handler for deploy action */
  onDeploy: () => void
  /** Whether deployment is in progress */
  deploying?: boolean
}

// ============================================
// COMPONENT
// ============================================

export function DeployDialog({
  open,
  onOpenChange,
  targetEnv,
  notes,
  onNotesChange,
  onDeploy,
  deploying = false,
}: DeployDialogProps) {
  const envLabel = targetEnv ? ENV_CONFIG[targetEnv].label : ''
  const envDescription = targetEnv ? ENV_CONFIG[targetEnv].description : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="deploy-dialog-description">
        <DialogHeader>
          <DialogTitle>Deploy to {envLabel}</DialogTitle>
          <DialogDescription id="deploy-dialog-description">
            {envDescription}. Add optional notes for this deployment.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label htmlFor="deploy-notes" className="text-sm font-medium">
            Notes
            <span className="text-muted-foreground ml-1 font-normal">(optional)</span>
          </Label>
          <Textarea
            id="deploy-notes"
            placeholder="e.g., Bug fix for authentication flow"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="mt-2"
            rows={3}
            disabled={deploying}
            aria-describedby="deploy-notes-hint"
          />
          <p id="deploy-notes-hint" className="text-muted-foreground mt-1 text-xs">
            Add context about this deployment for your team and deployment history.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deploying}>
            Cancel
          </Button>
          <Button
            onClick={onDeploy}
            disabled={deploying}
            className="bg-claw-600 hover:bg-claw-700"
            aria-label={deploying ? `Deploying to ${envLabel}` : `Deploy to ${envLabel}`}
          >
            {deploying ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Play className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {deploying ? 'Deploying...' : 'Deploy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
