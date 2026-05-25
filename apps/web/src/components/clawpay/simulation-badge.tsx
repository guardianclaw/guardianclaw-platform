/**
 * Badge that renders a SimulationStatus with severity-aware tone.
 *
 * Mirrors RiskBadge / EventKindBadge / ProviderBadge — same Radix Badge
 * primitive, same outline variant, color picked from the same Tailwind
 * tone vocabulary the dashboard already uses.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { ClawpaySimulationStatus } from '@/lib/clawpay-api'

const STYLES: Record<ClawpaySimulationStatus, string> = {
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  unsupported: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
  error: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/30',
  would_fail: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  suspicious_balance_change: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  suspicious_ownership_change: 'bg-red-600/15 text-red-700 dark:text-red-200 border-red-600/40',
}

const LABELS: Record<ClawpaySimulationStatus, string> = {
  ok: 'Simulation OK',
  unsupported: 'Sim. unsupported',
  error: 'Sim. error',
  would_fail: 'Would fail',
  suspicious_balance_change: 'Balance discrepancy',
  suspicious_ownership_change: 'Ownership reassigned',
}

export function SimulationBadge({
  status,
  className,
}: {
  status: ClawpaySimulationStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(STYLES[status], 'font-medium', className)}>
      {LABELS[status]}
    </Badge>
  )
}
