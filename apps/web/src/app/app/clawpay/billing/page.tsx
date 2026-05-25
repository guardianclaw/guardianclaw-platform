'use client'

/**
 * ClawPay Billing — outcome-based billing dashboard.
 *
 * Three sections:
 *   1. Current period card — what the tenant is going to pay this month.
 *   2. Plan + pricing breakdown — subscription fee, fee_bps, free
 *      validations included.
 *   3. History table of closed / invoiced / paid / failed periods.
 *
 * The "Close & invoice now" self-service action is hidden by default —
 * Sprint 5's polished UX is the read-only summary plus the explicit period
 * close action. Stripe invoice creation happens via a separate POST that
 * requires the wallet to have a connected Stripe customer; we point users
 * at a connection flow when missing.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { BillingStatusBadge } from '@/components/clawpay/billing-status-badge'
import { EmptyState } from '@/components/clawpay/empty-state'
import { StatCard } from '@/components/clawpay/stat-card'
import { formatDateShort, formatDateTime, formatUsd } from '@/components/clawpay/format'

import {
  ApiError,
  clawpayBillingApi,
  type BillingAccountResponse,
  type BillingPeriod,
  type ClawpayBillingPlan,
  type CurrentPeriodPreview,
} from '@/lib/clawpay-api'

import { toast } from 'sonner'

const PLAN_LABELS: Record<ClawpayBillingPlan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
}

export default function ClawpayBillingPage() {
  const [account, setAccount] = useState<BillingAccountResponse | null>(null)
  const [preview, setPreview] = useState<CurrentPeriodPreview | null>(null)
  const [periods, setPeriods] = useState<BillingPeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [accountResp, previewResp, periodsResp] = await Promise.all([
        clawpayBillingApi.getAccount(),
        clawpayBillingApi.currentPreview(),
        clawpayBillingApi.listPeriods({ limit: 24 }),
      ])
      setAccount(accountResp)
      setPreview(previewResp)
      setPeriods(periodsResp.periods)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load billing data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleClose = useCallback(async () => {
    setClosing(true)
    try {
      const result = await clawpayBillingApi.closeCurrentPeriod()
      if (result.result.idempotent) {
        toast.info('Period was already closed — refreshed totals.')
      } else {
        toast.success(`Period closed: $${result.result.total_usd.toFixed(2)} total.`)
      }
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to close period')
    } finally {
      setClosing(false)
    }
  }, [load])

  const planConfig = useMemo(() => {
    if (!account) return null
    return account.plan_pricing[account.account.plan]
  }, [account])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status">
        <Loader2 className="text-claw-500 h-6 w-6 animate-spin" aria-hidden />
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-12 text-center">
          <AlertCircle className="text-destructive mb-3 h-8 w-8" aria-hidden />
          <p className="text-destructive">{error}</p>
          <Button onClick={() => void load()} variant="outline" className="mt-3">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!account || !preview) {
    return (
      <EmptyState
        icon={CircleDollarSign}
        title="No billing data yet"
        description="Once a few payment validations land, the current-period preview will appear here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Billing</h2>
          <p className="text-muted-foreground text-sm">
            Outcome-based pricing — we charge {(preview.fee_bps / 100).toFixed(2)}% on payments we
            block, plus your monthly subscription.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => void load()} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => void handleClose()}
            disabled={closing}
            className="bg-claw-600 hover:bg-claw-700"
          >
            {closing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Closing…
              </>
            ) : (
              'Close current period'
            )}
          </Button>
        </div>
      </div>

      {/* Current period KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Blocked this period"
          value={formatUsd(preview.blocked_value_usd)}
          hint={`${preview.blocked_event_count.toLocaleString('en-US')} payment${preview.blocked_event_count === 1 ? '' : 's'}`}
          icon={ShieldAlert}
          tone={preview.blocked_value_usd > 0 ? 'critical' : 'neutral'}
        />
        <StatCard
          label="Outcome fee"
          value={formatUsd(preview.usage_fee_usd)}
          hint={`${(preview.fee_bps / 100).toFixed(2)}% of blocked`}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Subscription"
          value={formatUsd(preview.subscription_fee_usd)}
          hint={`${PLAN_LABELS[preview.plan]} plan`}
        />
        <StatCard
          label="Total (so far)"
          value={formatUsd(preview.total_usd)}
          hint={`Window ${formatDateShort(preview.period_start)} – ${formatDateShort(preview.period_end)}`}
          tone={preview.total_usd > 0 ? 'positive' : 'neutral'}
          icon={CheckCircle2}
        />
      </div>

      {/* Plan + setup */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>
                Pricing tiers are set per wallet. Upgrade via your account manager.
              </CardDescription>
            </div>
            <BillingStatusBadge status={account.account.status === 'active' ? 'open' : 'void'} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-muted-foreground text-xs">Plan</p>
              <p className="text-foreground text-lg font-semibold">
                {PLAN_LABELS[account.account.plan]}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Subscription / month</p>
              <p className="text-foreground text-lg font-semibold">
                {formatUsd(account.account.subscription_fee_usd)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Outcome fee</p>
              <p className="text-foreground text-lg font-semibold">
                {(account.account.fee_bps / 100).toFixed(2)}%
              </p>
            </div>
          </div>

          {planConfig ? (
            <div className="border-border mt-4 flex flex-wrap items-center gap-3 border-t pt-4 text-xs">
              <Info className="text-muted-foreground h-4 w-4" aria-hidden />
              <span className="text-muted-foreground">
                {planConfig.freeValidations.toLocaleString('en-US')} free validations / month
                included.
              </span>
            </div>
          ) : null}

          {!account.account_configured ? (
            <div className="border-claw-500/30 bg-claw-500/5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3">
              <div className="text-sm">
                <p className="text-foreground font-medium">No payment method configured</p>
                <p className="text-muted-foreground text-xs">
                  You're on the Free tier. Connect a Stripe customer to enable invoicing for the
                  paid tiers.
                </p>
              </div>
              <Link href="/clawpay#pricing">
                <Button variant="outline" size="sm">
                  See pricing
                </Button>
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Billing history</CardTitle>
          <CardDescription>
            Closed and invoiced periods. Open periods don't appear here until you close them.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={CircleDollarSign}
                title="No closed periods yet"
                description="Close the current period to see it here. ClawPay automatically aggregates blocked events; nothing else to do."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Blocked</TableHead>
                  <TableHead className="text-right">Usage fee</TableHead>
                  <TableHead className="text-right">Subscription</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">
                      <div>
                        {formatDateShort(p.period_start)} – {formatDateShort(p.period_end)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {p.blocked_event_count.toLocaleString('en-US')} blocked
                        {p.closed_at ? ` · closed ${formatDateTime(p.closed_at)}` : ''}
                      </div>
                    </TableCell>
                    <TableCell>
                      <BillingStatusBadge status={p.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(p.blocked_value_usd)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(p.usage_fee_usd)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(p.subscription_fee_usd)}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums">
                      {formatUsd(p.total_usd)}
                    </TableCell>
                    <TableCell>
                      {p.stripe_invoice_url ? (
                        <a
                          href={p.stripe_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-claw-500 inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          View
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
