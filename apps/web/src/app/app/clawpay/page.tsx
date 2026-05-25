'use client'

/**
 * ClawPay overview page.
 *
 * High-level summary of payment-validation activity for the caller's wallet.
 * Aggregates the latest audit events into four KPIs (blocked count, blocked
 * value, approved count, approved value), shows a list of recent blocks, and
 * teases the limit/alert config pages.
 *
 * The page is deliberately read-only — no actions live here. Mutations live
 * on the limits/alerts sub-pages so the overview stays cheap to render and
 * safe to keep on for non-admin team members.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/clawpay/empty-state'
import { EventKindBadge } from '@/components/clawpay/event-kind-badge'
import { ProviderBadge } from '@/components/clawpay/provider-badge'
import { RiskBadge } from '@/components/clawpay/risk-badge'
import { StatCard } from '@/components/clawpay/stat-card'
import {
  formatDateTime,
  formatRelative,
  formatUsd,
  truncateMiddle,
} from '@/components/clawpay/format'

import {
  ApiError,
  clawpayAuditApi,
  clawpayAlertsApi,
  type AuditEvent,
  type Alert,
} from '@/lib/clawpay-api'

const WINDOW_DAYS = 7

function aggregate(events: AuditEvent[]): {
  blocked: { count: number; value: number }
  approved: { count: number; value: number }
} {
  let blockedCount = 0
  let blockedValue = 0
  let approvedCount = 0
  let approvedValue = 0
  for (const event of events) {
    const value = event.amount_usd ?? 0
    if (event.event_kind === 'payment_blocked') {
      blockedCount += 1
      blockedValue += value
    } else if (event.event_kind === 'payment_approved') {
      approvedCount += 1
      approvedValue += value
    }
  }
  return {
    blocked: { count: blockedCount, value: blockedValue },
    approved: { count: approvedCount, value: approvedValue },
  }
}

export default function ClawpayOverviewPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const occurredAfter = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const [audit, alertsList] = await Promise.all([
        clawpayAuditApi.list({ occurred_after: occurredAfter, limit: 200 }),
        clawpayAlertsApi.list({ active: true, limit: 50 }),
      ])

      setEvents(audit.events)
      setAlerts(alertsList.alerts)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to load overview data'
      setError(message)
      console.error('ClawPay overview load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const summary = useMemo(() => aggregate(events), [events])
  const recentBlocked = useMemo(
    () => events.filter((e) => e.event_kind === 'payment_blocked').slice(0, 5),
    [events]
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20" role="status">
        <Loader2 className="text-claw-500 h-8 w-8 animate-spin" aria-hidden />
        <p className="text-muted-foreground mt-3 text-sm">Loading overview…</p>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertCircle className="text-destructive mb-3 h-10 w-10" aria-hidden />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => void load()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const hasAnyActivity = events.length > 0
  const totalCount = summary.blocked.count + summary.approved.count

  return (
    <div className="flex flex-col gap-8">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Blocked (7d)"
          value={summary.blocked.count.toLocaleString('en-US')}
          hint={
            totalCount === 0
              ? 'No payments in the last 7 days'
              : `${((summary.blocked.count / Math.max(totalCount, 1)) * 100).toFixed(1)}% of all payments`
          }
          icon={ShieldAlert}
          tone={summary.blocked.count > 0 ? 'critical' : 'neutral'}
        />
        <StatCard
          label="Value blocked (7d)"
          value={formatUsd(summary.blocked.value)}
          hint="USD-equivalent of stopped transactions"
          icon={Shield}
          tone={summary.blocked.value > 0 ? 'critical' : 'neutral'}
        />
        <StatCard
          label="Approved (7d)"
          value={summary.approved.count.toLocaleString('en-US')}
          hint="Cleared all CLAW gates"
          icon={CheckCircle2}
          tone={summary.approved.count > 0 ? 'positive' : 'neutral'}
        />
        <StatCard
          label="Active alerts"
          value={alerts.length.toLocaleString('en-US')}
          hint={
            alerts.length === 0
              ? 'No alert rules configured yet'
              : 'Webhook destinations watching events'
          }
          icon={Bell}
        />
      </div>

      {/* Recent blocked + Alerts side-by-side */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent blocks</CardTitle>
                <CardDescription>Last 5 blocked payments in this window</CardDescription>
              </div>
              <Link href="/app/clawpay/audit">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentBlocked.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm">
                No blocked payments in the last {WINDOW_DAYS} days.
              </p>
            ) : (
              <ul className="divide-border divide-y">
                {recentBlocked.map((event) => (
                  <li key={event.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <ProviderBadge provider={event.provider} />
                        <EventKindBadge kind={event.event_kind} />
                        <RiskBadge level={event.risk_level} />
                      </div>
                      <p className="text-foreground mt-1 truncate text-sm font-medium">
                        {event.endpoint || '(no endpoint)'}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        to {truncateMiddle(event.pay_to)} · {formatRelative(event.occurred_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-foreground text-sm font-semibold tabular-nums">
                        {formatUsd(event.amount_usd)}
                      </p>
                      <p className="text-muted-foreground text-xs">{event.network ?? ''}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Active alerts</CardTitle>
                <CardDescription>Webhook rules currently armed</CardDescription>
              </div>
              <Link href="/app/clawpay/alerts">
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <EmptyState
                icon={Bell}
                title="No alerts yet"
                description="Set up webhook rules to be notified when ClawPay blocks a payment or hits a spending threshold."
                action={
                  <Link href="/app/clawpay/alerts">
                    <Button className="bg-claw-600 hover:bg-claw-700">Configure alerts</Button>
                  </Link>
                }
              />
            ) : (
              <ul className="divide-border divide-y">
                {alerts.slice(0, 5).map((alert) => (
                  <li key={alert.id} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">{alert.name}</p>
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {alert.notification_target}
                      </p>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {alert.last_triggered_at
                        ? `Last: ${formatRelative(alert.last_triggered_at)}`
                        : 'Never fired'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {!hasAnyActivity ? (
        <EmptyState
          icon={Shield}
          title="No ClawPay activity yet"
          description="Once your agents start validating x402 payments through the SDK, decisions will appear here in real time."
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/clawpay">
                <Button variant="outline">View product page</Button>
              </Link>
              <Link href="/app/clawpay/limits">
                <Button className="bg-claw-600 hover:bg-claw-700">Set first limit</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <div className="text-muted-foreground flex items-center justify-end gap-2 text-xs">
          <span>
            Showing the last {WINDOW_DAYS} days. Last refreshed{' '}
            {formatDateTime(new Date().toISOString())}.
          </span>
          <Button onClick={() => void load()} variant="ghost" size="sm">
            <RefreshCw className="mr-1.5 h-3 w-3" />
            Refresh
          </Button>
        </div>
      )}
    </div>
  )
}
