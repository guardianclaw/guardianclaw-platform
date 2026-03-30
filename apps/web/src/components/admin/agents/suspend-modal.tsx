'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

export interface SuspendAgentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSuspended: boolean
  agentName: string
  onConfirm: (reason?: string) => Promise<void>
}

export function SuspendAgentModal({
  open,
  onOpenChange,
  isSuspended,
  agentName,
  onConfirm,
}: SuspendAgentModalProps) {
  const [reason, setReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    if (!isSuspended && !reason.trim()) {
      return
    }

    setIsLoading(true)
    try {
      await onConfirm(isSuspended ? undefined : reason.trim())
      setReason('')
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isSuspended ? 'Unsuspend Agent' : 'Suspend Agent'}</DialogTitle>
          <DialogDescription>
            {isSuspended
              ? `This will restore "${agentName}" and allow it to process requests again.`
              : `This will prevent "${agentName}" from processing any requests. All active deployments will be affected.`}
          </DialogDescription>
        </DialogHeader>

        {!isSuspended && (
          <div className="space-y-2">
            <Label htmlFor="reason">Suspension Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Enter the reason for suspension..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-muted-foreground text-xs">
              This reason will be visible to the agent owner.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={isSuspended ? 'default' : 'destructive'}
            onClick={handleConfirm}
            disabled={isLoading || (!isSuspended && !reason.trim())}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSuspended ? 'Unsuspend Agent' : 'Suspend Agent'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
