'use client'

/**
 * Modal showing the recent webhook deliveries for a single alert.
 *
 * Loaded on-demand when the user clicks "Deliveries" so the alert list itself
 * stays cheap to render.
 */

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { formatDateTime } from '@/components/clawpay/format'

import { ApiError, clawpayAlertsApi, type Alert, type AlertDelivery } from '@/lib/clawpay-api'

const STATUS_STYLES: Record<AlertDelivery['status'], string> = {
  delivered: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  pending: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  skipped: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
}

interface Props {
  alert: Alert | null
  onOpenChange: (open: boolean) => void
}

export function AlertDeliveriesModal({ alert, onOpenChange }: Props) {
  const [deliveries, setDeliveries] = useState<AlertDelivery[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const result = await clawpayAlertsApi.listDeliveries(id, { limit: 50 })
      setDeliveries(result.deliveries)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load deliveries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (alert) {
      void load(alert.id)
    } else {
      setDeliveries([])
      setError(null)
    }
  }, [alert, load])

  return (
    <Dialog open={alert !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Webhook deliveries</DialogTitle>
          <DialogDescription>
            {alert ? alert.name : 'Recent attempts'} — last 50 entries.
          </DialogDescription>
        </DialogHeader>

        <div className="my-4">
          {loading ? (
            <div className="flex items-center justify-center py-12" role="status">
              <Loader2 className="text-claw-500 h-6 w-6 animate-spin" aria-hidden />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : deliveries.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No deliveries recorded yet.
            </p>
          ) : (
            <ul className="divide-border max-h-96 divide-y overflow-y-auto">
              {deliveries.map((d) => (
                <li key={d.id} className="flex flex-col gap-1.5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={STATUS_STYLES[d.status]}>
                      {d.status}
                    </Badge>
                    {d.http_status ? (
                      <span className="text-muted-foreground text-xs">HTTP {d.http_status}</span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">attempt {d.attempt}</span>
                    <span className="text-muted-foreground ml-auto text-xs">
                      {formatDateTime(d.created_at)}
                    </span>
                  </div>
                  {d.error ? <p className="text-destructive text-xs">Error: {d.error}</p> : null}
                  {d.response_body_snippet ? (
                    <pre className="bg-muted text-muted-foreground max-h-24 overflow-y-auto rounded px-2 py-1 text-xs">
                      {d.response_body_snippet}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
