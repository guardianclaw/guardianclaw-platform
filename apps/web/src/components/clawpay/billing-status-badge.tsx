/**
 * Severity-aware badge for a billing period's lifecycle status.
 *
 * Color vocabulary mirrors RiskBadge / EventKindBadge so the dashboard
 * stays visually coherent.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { ClawpayBillingPeriodStatus } from '@/lib/clawpay-api'

const STYLES: Record<ClawpayBillingPeriodStatus, string> = {
  open: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  closed: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  invoiced: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
  paid: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  void: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
}

const LABELS: Record<ClawpayBillingPeriodStatus, string> = {
  open: 'Open',
  closed: 'Closed',
  invoiced: 'Invoiced',
  paid: 'Paid',
  failed: 'Failed',
  void: 'Void',
}

export function BillingStatusBadge({
  status,
  className,
}: {
  status: ClawpayBillingPeriodStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(STYLES[status], 'font-medium', className)}>
      {LABELS[status]}
    </Badge>
  )
}
