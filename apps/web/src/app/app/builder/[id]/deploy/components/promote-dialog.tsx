'use client'

/**
 * Promote Dialog Component
 *
 * Dialog for promoting deployments from one environment to another.
 * Supports promoting dev→staging, dev→prod, or staging→prod.
 */

import { ArrowRightCircle, Loader2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ENV_CONFIG } from './environment-card'
import type { Environment } from '@/lib/api'

// ============================================
// TYPES
// ============================================

export interface PromoteDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Handler for dialog open state change */
  onOpenChange: (open: boolean) => void
  /** Source environment being promoted from */
  sourceEnv: Environment | null
  /** Selected target environment */
  targetEnv: 'staging' | 'prod'
  /** Handler for target environment change */
  onTargetEnvChange: (target: 'staging' | 'prod') => void
  /** Optional notes for the promotion */
  notes: string
  /** Handler for notes change */
  onNotesChange: (notes: string) => void
  /** Handler for promote action */
  onPromote: () => void
  /** Whether promotion is in progress */
  promoting?: boolean
}

// ============================================
// COMPONENT
// ============================================

export function PromoteDialog({
  open,
  onOpenChange,
  sourceEnv,
  targetEnv,
  onTargetEnvChange,
  notes,
  onNotesChange,
  onPromote,
  promoting = false,
}: PromoteDialogProps) {
  const sourceLabel = sourceEnv ? ENV_CONFIG[sourceEnv].label : ''
  const targetLabel = ENV_CONFIG[targetEnv].label

  // Determine available target options based on source
  const canPromoteToStaging = sourceEnv === 'dev'
  const canPromoteToProd = sourceEnv === 'dev' || sourceEnv === 'staging'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="promote-dialog-description">
        <DialogHeader>
          <DialogTitle>Promote Deployment</DialogTitle>
          <DialogDescription id="promote-dialog-description">
            Promote the current deployment from {sourceLabel} to another environment. This will copy
            the configuration and create a new deployment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="promote-target" className="text-sm font-medium">
              Target Environment
            </Label>
            <Select
              value={targetEnv}
              onValueChange={(v) => onTargetEnvChange(v as 'staging' | 'prod')}
            >
              <SelectTrigger
                id="promote-target"
                className="mt-2"
                aria-label="Select target environment"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {canPromoteToStaging && <SelectItem value="staging">Staging</SelectItem>}
                {canPromoteToProd && <SelectItem value="prod">Production</SelectItem>}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground mt-1 text-xs">
              {sourceEnv === 'dev'
                ? 'Promote to staging for testing, or directly to production.'
                : 'Promote to production for live deployment.'}
            </p>
          </div>

          <div>
            <Label htmlFor="promote-notes" className="text-sm font-medium">
              Notes
              <span className="text-muted-foreground ml-1 font-normal">(optional)</span>
            </Label>
            <Textarea
              id="promote-notes"
              placeholder="e.g., Passed QA testing, ready for production"
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              className="mt-2"
              rows={2}
              aria-describedby="promote-notes-hint"
            />
            <p id="promote-notes-hint" className="text-muted-foreground mt-1 text-xs">
              Add context about this promotion for your deployment history.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={promoting}>
            Cancel
          </Button>
          <Button
            onClick={onPromote}
            disabled={promoting}
            className="bg-claw-600 hover:bg-claw-700"
            aria-label={
              promoting
                ? `Promoting to ${targetLabel}`
                : `Promote from ${sourceLabel} to ${targetLabel}`
            }
          >
            {promoting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRightCircle className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            {promoting ? 'Promoting...' : 'Promote'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
