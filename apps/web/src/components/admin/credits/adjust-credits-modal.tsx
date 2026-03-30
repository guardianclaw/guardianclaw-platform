'use client'

import { useState, useCallback, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Loader2, AlertTriangle, Plus, Minus, DollarSign, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/hooks/use-auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

const ADJUSTMENT_TYPES = [
  {
    value: 'refund',
    label: 'Refund',
    description: 'Refund for service issues or overcharges',
    color: 'bg-blue-500/10 text-blue-500',
  },
  {
    value: 'courtesy',
    label: 'Courtesy',
    description: 'Goodwill credits for customer satisfaction',
    color: 'bg-green-500/10 text-green-500',
  },
  {
    value: 'correction',
    label: 'Correction',
    description: 'Fix billing or system errors',
    color: 'bg-yellow-500/10 text-yellow-500',
  },
  {
    value: 'bonus',
    label: 'Bonus',
    description: 'Promotional or reward credits',
    color: 'bg-purple-500/10 text-purple-500',
  },
  {
    value: 'penalty',
    label: 'Penalty',
    description: 'Deduction for policy violations',
    color: 'bg-red-500/10 text-red-500',
  },
] as const

const REFERENCE_TYPES = [
  { value: 'ticket', label: 'Support Ticket' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'agent_event', label: 'Agent Event' },
  { value: 'other', label: 'Other' },
] as const

interface AdjustCreditsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  walletAddress?: string
  displayName?: string | null
  currentBalance?: number
  onSuccess?: (result: AdjustmentResult) => void
}

interface AdjustmentResult {
  success: boolean
  adjustment: {
    id: string
    wallet_address: string
    amount: number
    type: string
    reason: string
  }
  new_balance: number
  executions_remaining: number
}

interface FormData {
  wallet_address: string
  amount: string
  type: string
  reason: string
  reference_id: string
  reference_type: string
}

interface FormErrors {
  wallet_address?: string
  amount?: string
  type?: string
  reason?: string
}

export function AdjustCreditsModal({
  open,
  onOpenChange,
  walletAddress,
  displayName,
  currentBalance,
  onSuccess,
}: AdjustCreditsModalProps) {
  const { token } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<AdjustmentResult | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formErrors, setFormErrors] = useState<FormErrors>({})

  const [formData, setFormData] = useState<FormData>({
    wallet_address: walletAddress || '',
    amount: '',
    type: '',
    reason: '',
    reference_id: '',
    reference_type: '',
  })

  useEffect(() => {
    if (walletAddress) {
      setFormData((prev) => ({ ...prev, wallet_address: walletAddress }))
    }
  }, [walletAddress])

  const amountNum = parseFloat(formData.amount) || 0
  const isDeduction = amountNum < 0

  const resetForm = useCallback(() => {
    setFormData({
      wallet_address: walletAddress || '',
      amount: '',
      type: '',
      reason: '',
      reference_id: '',
      reference_type: '',
    })
    setError(null)
    setSuccess(null)
    setShowConfirm(false)
    setFormErrors({})
  }, [walletAddress])

  const handleClose = useCallback(() => {
    resetForm()
    onOpenChange(false)
  }, [resetForm, onOpenChange])

  const validateForm = (): boolean => {
    const errors: FormErrors = {}

    if (!formData.wallet_address || formData.wallet_address.length < 32) {
      errors.wallet_address = 'Valid wallet address is required'
    }
    if (!formData.amount || amountNum === 0) {
      errors.amount = 'Amount is required and cannot be zero'
    }
    if (!formData.type) {
      errors.type = 'Please select an adjustment type'
    }
    if (!formData.reason || formData.reason.length < 5) {
      errors.reason = 'Reason must be at least 5 characters'
    }
    if (formData.reason.length > 500) {
      errors.reason = 'Reason cannot exceed 500 characters'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const onSubmit = async () => {
    if (!validateForm()) return

    // Show confirmation dialog first
    if (!showConfirm) {
      setShowConfirm(true)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/admin/credits/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          wallet_address: formData.wallet_address,
          amount: amountNum,
          type: formData.type,
          reason: formData.reason,
          reference_id: formData.reference_id || undefined,
          reference_type: formData.reference_type || undefined,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to adjust credits')
      }

      setSuccess(result)
      onSuccess?.(result)

      setTimeout(() => {
        handleClose()
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred')
      setShowConfirm(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    if (showConfirm) {
      setShowConfirm(false)
    } else {
      handleClose()
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(amount)
  }

  const newBalance = currentBalance !== undefined ? currentBalance + amountNum : null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Adjust Credits
          </DialogTitle>
          <DialogDescription>
            {displayName ? (
              <>
                Adjust credit balance for <strong>{displayName}</strong>
              </>
            ) : (
              "Manually adjust a user's credit balance"
            )}
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6">
            <div className="flex items-start gap-3 rounded-lg border border-green-500/50 bg-green-500/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />
              <div className="text-green-500">
                Successfully adjusted credits by{' '}
                <strong>{formatCurrency(success.adjustment.amount)}</strong>. New balance:{' '}
                <strong>{formatCurrency(success.new_balance)}</strong>
              </div>
            </div>
          </div>
        ) : showConfirm ? (
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-500" />
              <span className="text-yellow-500">Please confirm this adjustment</span>
            </div>

            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">User</span>
                <span className="font-mono text-sm">
                  {displayName || formData.wallet_address.slice(0, 12) + '...'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount</span>
                <span className={`font-medium ${isDeduction ? 'text-red-500' : 'text-green-500'}`}>
                  {isDeduction ? '' : '+'}
                  {formatCurrency(amountNum)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <Badge
                  variant="outline"
                  className={ADJUSTMENT_TYPES.find((t) => t.value === formData.type)?.color}
                >
                  {ADJUSTMENT_TYPES.find((t) => t.value === formData.type)?.label}
                </Badge>
              </div>
              {currentBalance !== undefined && newBalance !== null && (
                <>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-muted-foreground">Current Balance</span>
                    <span>{formatCurrency(currentBalance)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">New Balance</span>
                    <span className={`font-medium ${newBalance < 0 ? 'text-red-500' : ''}`}>
                      {formatCurrency(newBalance)}
                    </span>
                  </div>
                </>
              )}
            </div>

            <p className="text-muted-foreground text-sm">
              <strong>Reason:</strong> {formData.reason}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {!walletAddress && (
              <div className="space-y-2">
                <Label htmlFor="wallet_address">Wallet Address</Label>
                <Input
                  id="wallet_address"
                  placeholder="Enter wallet address..."
                  value={formData.wallet_address}
                  onChange={(e) => setFormData({ ...formData, wallet_address: e.target.value })}
                  className="font-mono text-sm"
                />
                {formErrors.wallet_address && (
                  <p className="text-destructive text-sm">{formErrors.wallet_address}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (USD)</Label>
                <div className="relative">
                  <DollarSign className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                  <Input
                    id="amount"
                    type="number"
                    step="0.0001"
                    placeholder="0.00"
                    className="pl-9"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-1 text-xs">
                  {amountNum > 0 && (
                    <>
                      <Plus className="h-3 w-3 text-green-500" />
                      <span className="text-green-500">Credit</span>
                    </>
                  )}
                  {amountNum < 0 && (
                    <>
                      <Minus className="h-3 w-3 text-red-500" />
                      <span className="text-red-500">Deduction</span>
                    </>
                  )}
                </div>
                {formErrors.amount && (
                  <p className="text-destructive text-sm">{formErrors.amount}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ADJUSTMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={type.color + ' text-xs'}>
                            {type.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.type && (
                  <p className="text-muted-foreground text-xs">
                    {ADJUSTMENT_TYPES.find((t) => t.value === formData.type)?.description}
                  </p>
                )}
                {formErrors.type && <p className="text-destructive text-sm">{formErrors.type}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason</Label>
              <Textarea
                id="reason"
                placeholder="Provide a clear reason for this adjustment..."
                className="resize-none"
                rows={3}
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">
                {formData.reason.length}/500 characters (minimum 5)
              </p>
              {formErrors.reason && <p className="text-destructive text-sm">{formErrors.reason}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reference_type">Reference Type (Optional)</Label>
                <Select
                  value={formData.reference_type}
                  onValueChange={(value) => setFormData({ ...formData, reference_type: value })}
                >
                  <SelectTrigger id="reference_type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REFERENCE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference_id">Reference ID (Optional)</Label>
                <Input
                  id="reference_id"
                  placeholder="TICKET-12345"
                  value={formData.reference_id}
                  onChange={(e) => setFormData({ ...formData, reference_id: e.target.value })}
                />
              </div>
            </div>

            {currentBalance !== undefined && newBalance !== null && (
              <div className="bg-muted/50 rounded-lg border p-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Balance</span>
                  <span>{formatCurrency(currentBalance)}</span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">After Adjustment</span>
                  <span
                    className={`font-medium ${newBalance < 0 ? 'text-red-500' : isDeduction ? 'text-yellow-500' : 'text-green-500'}`}
                  >
                    {formatCurrency(newBalance)}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="border-destructive/50 bg-destructive/10 flex items-start gap-3 rounded-lg border p-4">
                <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
                <span className="text-destructive">{error}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
            {showConfirm ? 'Back' : 'Cancel'}
          </Button>
          {!success && (
            <Button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting}
              className={showConfirm ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : showConfirm ? (
                'Confirm Adjustment'
              ) : (
                'Review Adjustment'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
