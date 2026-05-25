'use client'

/**
 * Dialog-driven form for creating / editing a ClawPay spending limit.
 *
 * Validation lives client-side (numeric range, required fields) plus
 * server-side via the API's Zod schema — the same constraints as in
 * `clawpay-spending-limits.ts`. We surface server errors verbatim under
 * the relevant field so the user gets actionable feedback.
 */

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import type {
  ClawpayPeriod,
  CreateSpendingLimitInput,
  SpendingLimit,
  UpdateSpendingLimitInput,
} from '@/lib/clawpay-api'

const PERIODS: { value: ClawpayPeriod; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'lifetime', label: 'Lifetime' },
]

interface FormState {
  name: string
  period: ClawpayPeriod
  limit_usd: string
  description: string
}

const EMPTY: FormState = { name: '', period: 'daily', limit_usd: '', description: '' }

function fromExisting(limit: SpendingLimit): FormState {
  return {
    name: limit.name,
    period: limit.period,
    limit_usd: String(limit.limit_usd),
    description: limit.description ?? '',
  }
}

interface ValidationError {
  field?: 'name' | 'period' | 'limit_usd' | 'description'
  message: string
}

function validate(state: FormState): ValidationError | null {
  if (!state.name.trim()) return { field: 'name', message: 'Name is required' }
  if (state.name.length > 100) {
    return { field: 'name', message: 'Name must be 100 characters or fewer' }
  }
  const amount = Number(state.limit_usd)
  if (!state.limit_usd || Number.isNaN(amount)) {
    return { field: 'limit_usd', message: 'Limit must be a positive number' }
  }
  if (amount <= 0) {
    return { field: 'limit_usd', message: 'Limit must be greater than zero' }
  }
  if (amount > 1_000_000) {
    return { field: 'limit_usd', message: 'Per-rule cap is $1,000,000' }
  }
  if (state.description.length > 500) {
    return { field: 'description', message: 'Description must be 500 characters or fewer' }
  }
  return null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: SpendingLimit | null
  onCreate: (input: CreateSpendingLimitInput) => Promise<void>
  onUpdate: (id: string, input: UpdateSpendingLimitInput) => Promise<void>
}

export function SpendingLimitForm({ open, onOpenChange, existing, onCreate, onUpdate }: Props) {
  const [state, setState] = useState<FormState>(EMPTY)
  const [error, setError] = useState<ValidationError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setState(existing ? fromExisting(existing) : EMPTY)
      setError(null)
    }
  }, [open, existing])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate(state)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSubmitting(true)

    const trimmedDesc = state.description.trim()
    const payload: CreateSpendingLimitInput = {
      name: state.name.trim(),
      period: state.period,
      limit_usd: Number(state.limit_usd),
      description: trimmedDesc || undefined,
    }

    try {
      if (existing) {
        await onUpdate(existing.id, payload)
      } else {
        await onCreate(payload)
      }
      onOpenChange(false)
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Failed to save spending limit',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? 'Edit spending limit' : 'New spending limit'}</DialogTitle>
            <DialogDescription>
              Caps the total USD value of payments approved in a rolling window.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="limit-name">Name</Label>
              <Input
                id="limit-name"
                value={state.name}
                onChange={(e) => setState({ ...state, name: e.target.value })}
                placeholder="e.g. Daily USDC cap"
                maxLength={100}
                disabled={submitting}
                aria-invalid={error?.field === 'name'}
              />
              {error?.field === 'name' ? (
                <p className="text-destructive mt-1 text-xs" role="alert">
                  {error.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="limit-period">Window</Label>
                <Select
                  value={state.period}
                  onValueChange={(v) => setState({ ...state, period: v as ClawpayPeriod })}
                  disabled={submitting}
                >
                  <SelectTrigger id="limit-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERIODS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="limit-amount">Limit (USD)</Label>
                <Input
                  id="limit-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1_000_000}
                  step="0.000001"
                  value={state.limit_usd}
                  onChange={(e) => setState({ ...state, limit_usd: e.target.value })}
                  placeholder="500"
                  disabled={submitting}
                  aria-invalid={error?.field === 'limit_usd'}
                />
              </div>
            </div>
            {error?.field === 'limit_usd' ? (
              <p className="text-destructive -mt-2 text-xs" role="alert">
                {error.message}
              </p>
            ) : null}

            <div>
              <Label htmlFor="limit-desc">Description (optional)</Label>
              <Textarea
                id="limit-desc"
                value={state.description}
                onChange={(e) => setState({ ...state, description: e.target.value })}
                placeholder="Why this limit exists"
                rows={3}
                maxLength={500}
                disabled={submitting}
              />
              <p className="text-muted-foreground mt-1 text-xs">{state.description.length}/500</p>
            </div>

            {error && !error.field ? (
              <p className="text-destructive text-sm" role="alert">
                {error.message}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-claw-600 hover:bg-claw-700" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : existing ? (
                'Save changes'
              ) : (
                'Create limit'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
