/**
 * Small formatting helpers shared across the ClawPay dashboard.
 *
 * Co-located in `components/clawpay/` so every UI piece uses the same date /
 * currency rendering, while keeping the global `lib/utils.ts` lean.
 */

const USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

const USD_MICRO_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 6,
})

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

export function formatUsd(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—'
  // Use the high-precision formatter for non-zero sub-dollar amounts so
  // 0.000022 isn't rendered as "$0.00" (a real audit row with x402 micro
  // payments would otherwise be invisible). Exact zero stays on the standard
  // formatter so it reads "$0.00" not "$0".
  if (amount !== 0 && Math.abs(amount) < 1) return USD_MICRO_FORMATTER.format(amount)
  return USD_FORMATTER.format(amount)
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return DATE_FORMATTER.format(date)
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return DATE_SHORT_FORMATTER.format(date)
}

/**
 * "0x1234…cdef" — for displaying addresses without overflowing layout.
 * Falls back to the raw value when it's already short enough.
 */
export function truncateMiddle(value: string | null | undefined, head = 6, tail = 4): string {
  if (!value) return '—'
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const diffMs = Date.now() - date.getTime()
  const seconds = Math.round(diffMs / 1000)
  if (Math.abs(seconds) < 60) return `${seconds}s ago`
  const minutes = Math.round(seconds / 60)
  if (Math.abs(minutes) < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (Math.abs(hours) < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (Math.abs(days) < 30) return `${days}d ago`
  return formatDateShort(value)
}
