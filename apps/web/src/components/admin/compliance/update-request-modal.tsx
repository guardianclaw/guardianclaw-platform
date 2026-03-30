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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RequestTypeBadge, RequestStatusBadge, STATUS_OPTIONS } from './badges'
import { Loader2, AlertTriangle, FileEdit } from 'lucide-react'

interface UpdateRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requestType: string
  currentStatus: string
  walletAddress: string
  onConfirm: (status: string, notes: string) => Promise<void>
}

export function UpdateRequestModal({
  open,
  onOpenChange,
  requestType,
  currentStatus,
  walletAddress,
  onConfirm,
}: UpdateRequestModalProps) {
  const [status, setStatus] = useState(currentStatus)
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      await onConfirm(status, notes)
      setNotes('')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setNotes('')
      setError(null)
      setStatus(currentStatus)
    }
    onOpenChange(open)
  }

  const truncateWallet = (wallet: string) => {
    if (wallet.length <= 16) return wallet
    return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileEdit className="h-5 w-5" />
            Update GDPR Request
          </DialogTitle>
          <DialogDescription>
            Update the status and add notes for this GDPR request.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted space-y-2 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Type</span>
              <RequestTypeBadge type={requestType} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">User</span>
              <span className="font-mono text-sm">{truncateWallet(walletAddress)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Current Status</span>
              <RequestStatusBadge status={currentStatus} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any notes about this request..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

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
          <Button onClick={handleConfirm} disabled={isSubmitting || status === currentStatus}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
