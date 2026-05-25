'use client'

/**
 * Dialog-driven form for creating / editing a ClawPay alert.
 *
 * The trigger condition is built via a small set of structured options
 * (blocked-count over a window, blocked-value over a window, any drainer hit
 * at a chosen severity). This keeps the UI simple while keeping the storage
 * shape flexible — the JSON in `condition` can grow later without an API
 * breaking change.
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

import type { Alert, AlertCondition, CreateAlertInput, UpdateAlertInput } from '@/lib/clawpay-api'

type ConditionKind = 'blocked_count_above' | 'blocked_value_above' | 'drainer_hit'

interface FormState {
  name: string
  description: string
  notification_target: string
  cooldown_seconds: string
  condition_kind: ConditionKind
  count_threshold: string
  amount_usd: string
  window_minutes: string
  severity_min: 'low' | 'medium' | 'high' | 'critical'
}

const EMPTY: FormState = {
  name: '',
  description: '',
  notification_target: '',
  cooldown_seconds: '60',
  condition_kind: 'blocked_count_above',
  count_threshold: '5',
  amount_usd: '100',
  window_minutes: '60',
  severity_min: 'high',
}

function buildCondition(state: FormState): AlertCondition {
  if (state.condition_kind === 'blocked_count_above') {
    return {
      kind: 'blocked_count_above',
      count: Number(state.count_threshold),
      window_minutes: Number(state.window_minutes),
    }
  }
  if (state.condition_kind === 'blocked_value_above') {
    return {
      kind: 'blocked_value_above',
      amount_usd: Number(state.amount_usd),
      window_minutes: Number(state.window_minutes),
    }
  }
  return {
    kind: 'drainer_hit',
    severity_min: state.severity_min,
  }
}

function fromExisting(alert: Alert): FormState {
  const c = alert.condition
  const base: FormState = { ...EMPTY }
  base.name = alert.name
  base.description = alert.description ?? ''
  base.notification_target = alert.notification_target
  base.cooldown_seconds = String(alert.cooldown_seconds)

  if (c.kind === 'blocked_count_above') {
    base.condition_kind = 'blocked_count_above'
    base.count_threshold = String((c as { count?: number }).count ?? 5)
    base.window_minutes = String((c as { window_minutes?: number }).window_minutes ?? 60)
  } else if (c.kind === 'blocked_value_above') {
    base.condition_kind = 'blocked_value_above'
    base.amount_usd = String((c as { amount_usd?: number }).amount_usd ?? 100)
    base.window_minutes = String((c as { window_minutes?: number }).window_minutes ?? 60)
  } else if (c.kind === 'drainer_hit') {
    base.condition_kind = 'drainer_hit'
    base.severity_min =
      ((c as { severity_min?: string }).severity_min as FormState['severity_min']) ?? 'high'
  }
  return base
}

interface ValidationError {
  field?: keyof FormState
  message: string
}

function validate(state: FormState): ValidationError | null {
  if (!state.name.trim()) return { field: 'name', message: 'Name is required' }
  if (state.name.length > 100) return { field: 'name', message: 'Max 100 characters' }
  if (!/^https?:\/\//i.test(state.notification_target)) {
    return { field: 'notification_target', message: 'Must be an http(s) URL' }
  }
  const cooldown = Number(state.cooldown_seconds)
  if (Number.isNaN(cooldown) || cooldown < 0 || cooldown > 86_400) {
    return { field: 'cooldown_seconds', message: '0–86400 seconds' }
  }
  if (state.condition_kind === 'blocked_count_above') {
    const count = Number(state.count_threshold)
    const win = Number(state.window_minutes)
    if (Number.isNaN(count) || count < 1) {
      return { field: 'count_threshold', message: 'Count must be ≥ 1' }
    }
    if (Number.isNaN(win) || win < 1) {
      return { field: 'window_minutes', message: 'Window must be ≥ 1 minute' }
    }
  }
  if (state.condition_kind === 'blocked_value_above') {
    const amount = Number(state.amount_usd)
    const win = Number(state.window_minutes)
    if (Number.isNaN(amount) || amount <= 0) {
      return { field: 'amount_usd', message: 'Amount must be positive' }
    }
    if (Number.isNaN(win) || win < 1) {
      return { field: 'window_minutes', message: 'Window must be ≥ 1 minute' }
    }
  }
  return null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  existing?: Alert | null
  onCreate: (input: CreateAlertInput) => Promise<void>
  onUpdate: (id: string, input: UpdateAlertInput) => Promise<void>
}

export function AlertForm({ open, onOpenChange, existing, onCreate, onUpdate }: Props) {
  const [state, setState] = useState<FormState>(EMPTY)
  const [error, setError] = useState<ValidationError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setState(existing ? fromExisting(existing) : EMPTY)
      setError(null)
    }
  }, [open, existing])

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate(state)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setSubmitting(true)

    const payload: CreateAlertInput = {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      notification_target: state.notification_target.trim(),
      cooldown_seconds: Number(state.cooldown_seconds),
      condition: buildCondition(state),
    }

    try {
      if (existing) {
        await onUpdate(existing.id, payload)
      } else {
        await onCreate(payload)
      }
      onOpenChange(false)
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Failed to save alert' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? 'Edit alert' : 'New alert'}</DialogTitle>
            <DialogDescription>
              POST a webhook when the chosen condition matches a ClawPay decision.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="alert-name">Name</Label>
              <Input
                id="alert-name"
                value={state.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. High-value blocks"
                maxLength={100}
                disabled={submitting}
                aria-invalid={error?.field === 'name'}
              />
              {error?.field === 'name' ? (
                <p className="text-destructive mt-1 text-xs">{error.message}</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="alert-target">Webhook URL</Label>
              <Input
                id="alert-target"
                type="url"
                value={state.notification_target}
                onChange={(e) => update('notification_target', e.target.value)}
                placeholder="https://hooks.example.com/clawpay"
                maxLength={2048}
                disabled={submitting}
                aria-invalid={error?.field === 'notification_target'}
              />
              {error?.field === 'notification_target' ? (
                <p className="text-destructive mt-1 text-xs">{error.message}</p>
              ) : null}
              <p className="text-muted-foreground mt-1 text-xs">
                Validated against an SSRF guard before saving. Private addresses are rejected.
              </p>
            </div>

            <div>
              <Label htmlFor="alert-condition">Trigger when</Label>
              <Select
                value={state.condition_kind}
                onValueChange={(v) => update('condition_kind', v as ConditionKind)}
                disabled={submitting}
              >
                <SelectTrigger id="alert-condition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blocked_count_above">
                    More than N blocked payments in a window
                  </SelectItem>
                  <SelectItem value="blocked_value_above">
                    Total blocked value above $X in a window
                  </SelectItem>
                  <SelectItem value="drainer_hit">Any drainer-intel hit at severity ≥</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {state.condition_kind === 'blocked_count_above' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="alert-count">Block count (≥)</Label>
                  <Input
                    id="alert-count"
                    type="number"
                    min={1}
                    value={state.count_threshold}
                    onChange={(e) => update('count_threshold', e.target.value)}
                    disabled={submitting}
                    aria-invalid={error?.field === 'count_threshold'}
                  />
                </div>
                <div>
                  <Label htmlFor="alert-window">Window (minutes)</Label>
                  <Input
                    id="alert-window"
                    type="number"
                    min={1}
                    value={state.window_minutes}
                    onChange={(e) => update('window_minutes', e.target.value)}
                    disabled={submitting}
                    aria-invalid={error?.field === 'window_minutes'}
                  />
                </div>
              </div>
            ) : null}

            {state.condition_kind === 'blocked_value_above' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="alert-amount">Amount USD (≥)</Label>
                  <Input
                    id="alert-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={state.amount_usd}
                    onChange={(e) => update('amount_usd', e.target.value)}
                    disabled={submitting}
                    aria-invalid={error?.field === 'amount_usd'}
                  />
                </div>
                <div>
                  <Label htmlFor="alert-window-val">Window (minutes)</Label>
                  <Input
                    id="alert-window-val"
                    type="number"
                    min={1}
                    value={state.window_minutes}
                    onChange={(e) => update('window_minutes', e.target.value)}
                    disabled={submitting}
                    aria-invalid={error?.field === 'window_minutes'}
                  />
                </div>
              </div>
            ) : null}

            {state.condition_kind === 'drainer_hit' ? (
              <div>
                <Label htmlFor="alert-sev">Minimum severity</Label>
                <Select
                  value={state.severity_min}
                  onValueChange={(v) => update('severity_min', v as FormState['severity_min'])}
                  disabled={submitting}
                >
                  <SelectTrigger id="alert-sev">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {error &&
            (error.field === 'count_threshold' ||
              error.field === 'window_minutes' ||
              error.field === 'amount_usd') ? (
              <p className="text-destructive -mt-2 text-xs" role="alert">
                {error.message}
              </p>
            ) : null}

            <div>
              <Label htmlFor="alert-cooldown">Cooldown (seconds)</Label>
              <Input
                id="alert-cooldown"
                type="number"
                min={0}
                max={86_400}
                value={state.cooldown_seconds}
                onChange={(e) => update('cooldown_seconds', e.target.value)}
                disabled={submitting}
                aria-invalid={error?.field === 'cooldown_seconds'}
              />
              <p className="text-muted-foreground mt-1 text-xs">
                Minimum seconds between successive deliveries from this rule.
              </p>
              {error?.field === 'cooldown_seconds' ? (
                <p className="text-destructive mt-1 text-xs">{error.message}</p>
              ) : null}
            </div>

            <div>
              <Label htmlFor="alert-desc">Description (optional)</Label>
              <Textarea
                id="alert-desc"
                value={state.description}
                onChange={(e) => update('description', e.target.value)}
                maxLength={500}
                rows={2}
                disabled={submitting}
                placeholder="Internal note about what this alert watches"
              />
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
                'Create alert'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
