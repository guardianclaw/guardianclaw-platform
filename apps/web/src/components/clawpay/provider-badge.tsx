/**
 * Renders the payment provider that produced an audit row.
 *
 * Kept visually neutral (no positive/negative tone) — the provider is
 * factual context, not a risk signal.
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { ClawpayProvider } from '@/lib/clawpay-api'

const STYLES: Record<ClawpayProvider, string> = {
  x402: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30',
  stripe: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/30',
}

const LABELS: Record<ClawpayProvider, string> = {
  x402: 'x402',
  stripe: 'Stripe',
}

export function ProviderBadge({
  provider,
  className,
}: {
  provider: ClawpayProvider
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn(STYLES[provider], 'font-medium', className)}>
      {LABELS[provider]}
    </Badge>
  )
}
