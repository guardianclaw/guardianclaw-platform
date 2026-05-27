'use client'

/**
 * ClawPay audit log.
 *
 * Paginated, filterable table of validation decisions. Filters: event_kind,
 * risk_level, time window (last 24h / 7d / 30d / custom open-ended). Each
 * row opens a detail dialog with the gates breakdown and drainer hits.
 *
 * CSV export downloads the current filter (up to 10k rows). The download is
 * triggered client-side from a Blob so the user sees a normal "Save as" dialog.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { AuditEventDetail } from '@/components/clawpay/audit-event-detail'
import { EmptyState } from '@/components/clawpay/empty-state'
import { EventKindBadge } from '@/components/clawpay/event-kind-badge'
import { ProviderBadge } from '@/components/clawpay/provider-badge'
import { RiskBadge } from '@/components/clawpay/risk-badge'
import { formatDateTime, formatUsd, truncateMiddle } from '@/components/clawpay/format'

import {
  ApiError,
  clawpayAuditApi,
  type AuditEvent,
  type AuditEventsQuery,
  type ClawpayEventKind,
  type ClawpayProvider,
  type ClawpayRiskLevel,
} from '@/lib/clawpay-api'

import { toast } from 'sonner'

const PAGE_SIZE = 25

type EventKindFilter = ClawpayEventKind | 'all'
type RiskFilter = ClawpayRiskLevel | 'all'
type ProviderFilter = ClawpayProvider | 'all'
type WindowFilter = '24h' | '7d' | '30d' | 'all'

const WINDOWS: { value: WindowFilter; label: string; hours: number | null }[] = [
  { value: '24h', label: 'Last 24 hours', hours: 24 },
  { value: '7d', label: 'Last 7 days', hours: 24 * 7 },
  { value: '30d', label: 'Last 30 days', hours: 24 * 30 },
  { value: 'all', label: 'All time', hours: null },
]

function windowToFilter(value: WindowFilter): { occurred_after?: string } {
  const win = WINDOWS.find((w) => w.value === value)
  if (!win || win.hours === null) return {}
  return {
    occurred_after: new Date(Date.now() - win.hours * 3600 * 1000).toISOString(),
  }
}

export default function ClawpayAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [windowFilter, setWindowFilter] = useState<WindowFilter>('7d')
  const [kindFilter, setKindFilter] = useState<EventKindFilter>('all')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all')
  const [page, setPage] = useState(0)
  const [detail, setDetail] = useState<AuditEvent | null>(null)
  const [exportLoading, setExportLoading] = useState(false)

  const filterQuery = useMemo<AuditEventsQuery>(() => {
    const q: AuditEventsQuery = { ...windowToFilter(windowFilter) }
    if (kindFilter !== 'all') q.event_kind = kindFilter
    if (riskFilter !== 'all') q.risk_level = riskFilter
    if (providerFilter !== 'all') q.provider = providerFilter
    return q
  }, [windowFilter, kindFilter, riskFilter, providerFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await clawpayAuditApi.list({
        ...filterQuery,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      setEvents(result.events)
      setTotal(result.pagination.total)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit events')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filterQuery, page])

  useEffect(() => {
    void load()
  }, [load])

  // Reset to first page whenever filters change.
  useEffect(() => {
    setPage(0)
  }, [windowFilter, kindFilter, riskFilter, providerFilter])

  const handleExport = async () => {
    setExportLoading(true)
    try {
      const { blob, filename } = await clawpayAuditApi.exportCsv({ ...filterQuery, limit: 10_000 })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Audit log exported')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  const lastPage = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Audit</h2>
          <p className="text-muted-foreground text-sm">
            Every CLAW decision, with the drainer intel and gates that produced it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void load()} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={handleExport}
            variant="outline"
            size="sm"
            disabled={exportLoading || loading}
          >
            {exportLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Filter className="text-muted-foreground h-4 w-4" aria-hidden />
          <Select value={windowFilter} onValueChange={(v) => setWindowFilter(v as WindowFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as EventKindFilter)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All outcomes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All outcomes</SelectItem>
              <SelectItem value="payment_approved">Approved</SelectItem>
              <SelectItem value="payment_blocked">Blocked</SelectItem>
              <SelectItem value="payment_confirmation_required">Needs confirmation</SelectItem>
              <SelectItem value="payment_failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Any risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any risk</SelectItem>
              <SelectItem value="safe">Safe</SelectItem>
              <SelectItem value="caution">Caution</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={providerFilter}
            onValueChange={(v) => setProviderFilter(v as ProviderFilter)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Any provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any provider</SelectItem>
              <SelectItem value="x402">x402 (Coinbase)</SelectItem>
              <SelectItem value="stripe">Stripe</SelectItem>
            </SelectContent>
          </Select>

          <span className="text-muted-foreground ml-auto text-xs">
            {total.toLocaleString('en-US')} event{total === 1 ? '' : 's'} matching filters
          </span>
        </CardContent>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <AlertCircle className="text-destructive mb-2 h-8 w-8" aria-hidden />
            <p className="text-destructive">{error}</p>
            <Button onClick={() => void load()} variant="outline" className="mt-3">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-16" role="status">
          <Loader2 className="text-claw-500 h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="No events for this filter"
          description="Try widening the time window or removing filters."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-44">When</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="sr-only w-8">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow
                    key={event.id}
                    onClick={() => setDetail(event)}
                    className="cursor-pointer"
                  >
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTime(event.occurred_at)}
                    </TableCell>
                    <TableCell>
                      <ProviderBadge provider={event.provider} />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EventKindBadge kind={event.event_kind} />
                        <RiskBadge level={event.risk_level} />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {event.endpoint || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.pay_to ? truncateMiddle(event.pay_to) : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {event.network ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(event.amount_usd)}
                    </TableCell>
                    <TableCell aria-hidden>
                      <Search className="text-muted-foreground h-4 w-4" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex items-center justify-end gap-3">
          <span className="text-muted-foreground text-xs">
            Page {page + 1} of {lastPage + 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
            disabled={page >= lastPage || loading}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <AuditEventDetail event={detail} onOpenChange={(open) => !open && setDetail(null)} />
    </div>
  )
}
