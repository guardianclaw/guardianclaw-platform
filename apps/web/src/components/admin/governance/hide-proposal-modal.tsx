'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { EyeOff, Eye, Loader2, AlertTriangle } from 'lucide-react'

interface HideProposalModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proposalTitle: string
  isCurrentlyHidden: boolean
  onConfirm: (reason: string) => Promise<void>
}

export function HideProposalModal({
  open,
  onOpenChange,
  proposalTitle,
  isCurrentlyHidden,
  onConfirm,
}: HideProposalModalProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isHiding = !isCurrentlyHidden
  const minReasonLength = 5

  const handleConfirm = async () => {
    if (isHiding && reason.length < minReasonLength) {
      setError(`Reason must be at least ${minReasonLength} characters`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onConfirm(reason)
      setReason('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update proposal visibility')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setReason('')
      setError(null)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isHiding ? (
              <>
                <EyeOff className="h-5 w-5 text-red-500" />
                Hide Proposal
              </>
            ) : (
              <>
                <Eye className="h-5 w-5 text-green-500" />
                Show Proposal
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isHiding
              ? 'This will hide the proposal from public view. Users will not be able to see or vote on it.'
              : 'This will make the proposal visible to the public again.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-lg p-3">
            <p className="text-sm font-medium">{proposalTitle}</p>
          </div>

          {isHiding && (
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for hiding</Label>
              <Textarea
                id="reason"
                placeholder="Explain why this proposal is being hidden..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
              <p className="text-muted-foreground text-xs">
                {reason.length} / {minReasonLength} minimum characters
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant={isHiding ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isSubmitting || (isHiding && reason.length < minReasonLength)}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isHiding ? 'Hiding...' : 'Showing...'}
              </>
            ) : isHiding ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Proposal
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Show Proposal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
