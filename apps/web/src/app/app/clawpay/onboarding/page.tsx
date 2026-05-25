'use client'

/**
 * ClawPay onboarding wizard (Sprint 6).
 *
 * Four-step guided setup for a fresh design partner:
 *
 *   1. Redeem beta invite code (if not already redeemed).
 *   2. Add a notification email + verify channel preferences.
 *   3. Create a first spending limit.
 *   4. Create a first alert rule + send a test webhook.
 *
 * The wizard is intentionally stateless on the server — every step writes
 * the state it needs (subscription row, spending limit, alert) and the
 * client just walks the user through the existing endpoints. That way a
 * partner who closes the tab can resume by re-visiting; the dashboard
 * detects partial setup and re-routes them here.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  Bell,
  Check,
  CircleDollarSign,
  KeyRound,
  Loader2,
  Mail,
  Sparkles,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import {
  ApiError,
  clawpayAlertsApi,
  clawpaySpendingLimitsApi,
  clawpayBetaPublicCheckSafe,
  clawpayBetaRedeemSafe,
  clawpayNotificationsApi,
} from '@/lib/clawpay-api'

const STEPS = ['invite', 'email', 'limits', 'alerts'] as const
type Step = (typeof STEPS)[number]

interface StepDef {
  id: Step
  title: string
  description: string
  icon: typeof KeyRound
}

const STEP_DEFS: StepDef[] = [
  {
    id: 'invite',
    title: 'Redeem beta invite',
    description: 'Enter the code you received.',
    icon: KeyRound,
  },
  {
    id: 'email',
    title: 'Notification email',
    description: 'Where ClawPay sends period-close + critical alerts.',
    icon: Mail,
  },
  {
    id: 'limits',
    title: 'First spending limit',
    description: 'Cap how much an agent can spend in a window.',
    icon: CircleDollarSign,
  },
  {
    id: 'alerts',
    title: 'First alert webhook',
    description: 'Get a real-time notification on blocks.',
    icon: Bell,
  },
]

export default function ClawpayOnboardingPage() {
  const [activeIdx, setActiveIdx] = useState(0)
  const active = STEP_DEFS[activeIdx]!

  // Track which steps have been completed in this session so the user
  // sees a green check after each one.
  const [completed, setCompleted] = useState<Record<Step, boolean>>({
    invite: false,
    email: false,
    limits: false,
    alerts: false,
  })

  // Pre-fill known state from the server when the wizard mounts. Lets a
  // partner resume cleanly after closing the tab.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const prefs = await clawpayNotificationsApi.getPreferences()
        if (cancelled) return
        if (prefs.configured && prefs.subscription.email) {
          setCompleted((c) => ({ ...c, email: true }))
        }
        const limits = await clawpaySpendingLimitsApi.list({ limit: 1 })
        if (cancelled) return
        if (limits.limits.length > 0) {
          setCompleted((c) => ({ ...c, limits: true }))
        }
        const alerts = await clawpayAlertsApi.list({ limit: 1 })
        if (cancelled) return
        if (alerts.alerts.length > 0) {
          setCompleted((c) => ({ ...c, alerts: true }))
        }
      } catch {
        // Initial hydration is best-effort; the wizard is still usable.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const progressPct = useMemo(() => {
    const done = Object.values(completed).filter(Boolean).length
    return Math.round((done / STEP_DEFS.length) * 100)
  }, [completed])

  const advance = useCallback(() => {
    setCompleted((c) => ({ ...c, [active.id]: true }))
    if (activeIdx < STEP_DEFS.length - 1) {
      setActiveIdx(activeIdx + 1)
    }
  }, [active.id, activeIdx])

  const allDone = Object.values(completed).every(Boolean)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="bg-claw-500/10 text-claw-600 dark:text-claw-300 mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
            <Sparkles className="h-3 w-3" aria-hidden />
            ClawPay onboarding · 4 steps
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Welcome to ClawPay</h2>
          <p className="text-muted-foreground text-sm">
            Get set up in less than five minutes. Skip steps you've already done — we'll detect
            them.
          </p>
        </div>
        <div className="text-muted-foreground text-xs tabular-nums">{progressPct}% complete</div>
      </div>

      {/* Step indicator */}
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STEP_DEFS.map((s, idx) => {
          const isActive = idx === activeIdx
          const isComplete = completed[s.id]
          const Icon = s.icon
          return (
            <li
              key={s.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3',
                isActive
                  ? 'border-claw-500/40 bg-claw-500/5'
                  : isComplete
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border'
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  isComplete
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">{s.title}</p>
                <p className="text-muted-foreground truncate text-xs">{s.description}</p>
              </div>
            </li>
          )
        })}
      </ol>

      {/* Active step body */}
      {active.id === 'invite' ? <InviteStep onCompleted={advance} done={completed.invite} /> : null}
      {active.id === 'email' ? <EmailStep onCompleted={advance} done={completed.email} /> : null}
      {active.id === 'limits' ? <LimitsStep onCompleted={advance} done={completed.limits} /> : null}
      {active.id === 'alerts' ? <AlertsStep onCompleted={advance} done={completed.alerts} /> : null}

      {/* Nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={activeIdx === 0}
          onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))}
        >
          Back
        </Button>
        {allDone ? (
          <Link href="/app/clawpay">
            <Button className="bg-claw-600 hover:bg-claw-700">
              Open the dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        ) : (
          <Button
            variant="outline"
            onClick={() => setActiveIdx(Math.min(STEP_DEFS.length - 1, activeIdx + 1))}
            disabled={activeIdx === STEP_DEFS.length - 1}
          >
            Skip step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Step 1 — Invite redemption
// ============================================================================

function InviteStep({ onCompleted, done }: { onCompleted: () => void; done: boolean }) {
  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [redeeming, setRedeeming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [meta, setMeta] = useState<{ remaining_uses: number } | null>(null)

  const handleCheck = async () => {
    setChecking(true)
    setError(null)
    setMeta(null)
    try {
      const r = await clawpayBetaPublicCheckSafe(code.trim())
      if (!r.valid) {
        setError(r.reason ?? 'Code is not redeemable')
      } else {
        setMeta({ remaining_uses: r.remaining_uses ?? 0 })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to check code')
    } finally {
      setChecking(false)
    }
  }

  const handleRedeem = async () => {
    setRedeeming(true)
    setError(null)
    try {
      const r = await clawpayBetaRedeemSafe(code.trim())
      if (r.redeemed) {
        toast.success(
          r.idempotent ? 'Already redeemed earlier — proceeding.' : 'Beta access activated.'
        )
        onCompleted()
      } else {
        setError('Redemption failed')
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to redeem code')
    } finally {
      setRedeeming(false)
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" aria-hidden />
            Beta access already active
          </CardTitle>
          <CardDescription>You've already redeemed an invite code on this wallet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redeem your invite code</CardTitle>
        <CardDescription>Paste the code you received. Codes are case-sensitive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. COINBASE-DEVS-2026"
            className="font-mono"
          />
          <Button variant="outline" onClick={handleCheck} disabled={checking || !code.trim()}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Check'}
          </Button>
        </div>
        {meta ? (
          <p className="text-muted-foreground text-xs">
            Valid — {meta.remaining_uses} use{meta.remaining_uses === 1 ? '' : 's'} remaining.
          </p>
        ) : null}
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <div>
          <Button
            onClick={handleRedeem}
            disabled={redeeming || !code.trim()}
            className="bg-claw-600 hover:bg-claw-700"
          >
            {redeeming ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redeeming…
              </>
            ) : (
              <>
                Redeem
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 2 — Email + preferences
// ============================================================================

function EmailStep({ onCompleted, done }: { onCompleted: () => void; done: boolean }) {
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await clawpayNotificationsApi.update({ email })
      toast.success('Email saved')
      onCompleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save email')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" aria-hidden />
            Notification email configured
          </CardTitle>
          <CardDescription>
            You can change it any time in{' '}
            <code className="font-mono text-xs">Settings → Notifications</code>.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification email</CardTitle>
        <CardDescription>
          ClawPay sends critical alerts and the monthly billing summary here. You can opt out of
          non-critical channels later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="onb-email">Email</Label>
          <Input
            id="onb-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          onClick={handleSave}
          disabled={saving || !email.trim()}
          className="bg-claw-600 hover:bg-claw-700"
        >
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save & continue
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 3 — Spending limit
// ============================================================================

function LimitsStep({ onCompleted, done }: { onCompleted: () => void; done: boolean }) {
  const [amount, setAmount] = useState('500')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a positive USD amount.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await clawpaySpendingLimitsApi.create({
        name: 'Daily USDC cap',
        period: 'daily',
        limit_usd: value,
        description: 'Created during onboarding wizard',
      })
      toast.success(`Daily limit of $${value.toFixed(2)} created`)
      onCompleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create limit')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" aria-hidden />
            You already have a spending limit
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a first spending limit</CardTitle>
        <CardDescription>
          We'll create a daily USD cap so a runaway agent can't drain your budget.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="onb-amount">Daily cap (USD)</Label>
          <Input
            id="onb-amount"
            type="number"
            min={1}
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button onClick={handleSave} disabled={saving} className="bg-claw-600 hover:bg-claw-700">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create limit
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// Step 4 — Alert
// ============================================================================

function AlertsStep({ onCompleted, done }: { onCompleted: () => void; done: boolean }) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!/^https?:\/\//i.test(url)) {
      setError('Enter an http(s) URL.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await clawpayAlertsApi.create({
        name: 'First blocked payment',
        condition: { kind: 'blocked_count_above', count: 1, window_minutes: 60 },
        notification_target: url,
        description: 'Created during onboarding wizard',
      })
      toast.success('Alert created')
      onCompleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create alert')
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-emerald-500" aria-hidden />
            You already have an alert configured
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a first alert</CardTitle>
        <CardDescription>
          Get a webhook the first time ClawPay blocks a payment. Use a Slack webhook URL or your own
          endpoint.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2">
          <Label htmlFor="onb-url">Webhook URL</Label>
          <Input
            id="onb-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/…"
          />
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button onClick={handleSave} disabled={saving} className="bg-claw-600 hover:bg-claw-700">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Create alert
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  )
}
