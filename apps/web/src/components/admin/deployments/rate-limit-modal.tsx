'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

export interface RateLimitModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentLimit: number | null
  onConfirm: (limit: number | null) => Promise<void>
}

export function RateLimitModal({
  open,
  onOpenChange,
  currentLimit,
  onConfirm,
}: RateLimitModalProps) {
  const [rateLimit, setRateLimit] = useState<string>(
    currentLimit !== null ? currentLimit.toString() : ''
  )
  const [isLoading, setIsLoading] = useState(false)

  const handleConfirm = async () => {
    const newLimit = rateLimit.trim() === '' ? null : parseInt(rateLimit, 10)

    if (rateLimit.trim() !== '' && (isNaN(newLimit!) || newLimit! < 0 || newLimit! > 10000)) {
      return
    }

    setIsLoading(true)
    try {
      await onConfirm(newLimit)
      onOpenChange(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setRateLimit(currentLimit !== null ? currentLimit.toString() : '')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Rate Limit Override</DialogTitle>
          <DialogDescription>
            Set a custom rate limit for this deployment. Leave empty to use platform default.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rate-limit">Rate Limit (requests per minute)</Label>
            <Input
              id="rate-limit"
              type="number"
              placeholder="Leave empty for default"
              value={rateLimit}
              onChange={(e) => setRateLimit(e.target.value)}
              min={0}
              max={10000}
            />
            <p className="text-muted-foreground text-xs">
              Enter 0 for unlimited, or leave empty to reset to platform default.
            </p>
          </div>

          <div className="bg-muted space-y-1 rounded-lg p-3">
            <p className="text-sm font-medium">Current setting</p>
            <p className="text-muted-foreground text-sm">
              {currentLimit !== null
                ? currentLimit === 0
                  ? 'Unlimited (custom)'
                  : `${currentLimit} req/min (custom)`
                : 'Platform default'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update Rate Limit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
