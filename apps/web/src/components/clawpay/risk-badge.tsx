/**
 * ClawPay risk-level badge.
 *
 * Maps the canonical `clawpay_risk_level` enum to a colored Badge. Centralized
 * so every surface (overview cards, audit table, alert details) uses the same
 * visual vocabulary.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { ClawpayRiskLevel } from '@/lib/clawpay-api'

const STYLES: Record<ClawpayRiskLevel, string> = {
  safe: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  caution: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  high: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30',
  blocked: 'bg-red-600/15 text-red-700 dark:text-red-200 border-red-600/40',
}

const LABELS: Record<ClawpayRiskLevel, string> = {
  safe: 'Safe',
  caution: 'Caution',
  high: 'High',
  critical: 'Critical',
  blocked: 'Blocked',
}

export function RiskBadge({ level, className }: { level: ClawpayRiskLevel; className?: string }) {
  return (
    <Badge variant="outline" className={cn(STYLES[level], 'font-medium', className)}>
      {LABELS[level]}
    </Badge>
  )
}
