/**
 * ClawPay event-kind badge. Mirrors RiskBadge but for `clawpay_event_kind`.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { ClawpayEventKind } from '@/lib/clawpay-api'

const STYLES: Record<ClawpayEventKind, string> = {
  payment_approved:
    'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  payment_blocked: 'bg-red-600/15 text-red-700 dark:text-red-200 border-red-600/40',
  payment_confirmation_required:
    'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  payment_failed: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
}

const LABELS: Record<ClawpayEventKind, string> = {
  payment_approved: 'Approved',
  payment_blocked: 'Blocked',
  payment_confirmation_required: 'Needs confirmation',
  payment_failed: 'Failed',
}

export function EventKindBadge({
  kind,
  className,
}: {
  kind: ClawpayEventKind
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(STYLES[kind], 'font-medium', className)}>
      {LABELS[kind]}
    </Badge>
  )
}
