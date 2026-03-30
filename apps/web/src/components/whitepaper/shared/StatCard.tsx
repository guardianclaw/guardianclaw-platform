/**
 * StatCard Component
 *
 * A styled card component for displaying statistics and metrics.
 * Supports multiple variants, icons, and trend indicators.
 */

'use client'

import { memo } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { StatCardProps, StatCardVariant } from './types'

/**
 * Variant styles configuration
 */
const VARIANT_STYLES: Record<
  StatCardVariant,
  {
    border: string
    bg: string
    valueColor: string
    iconColor: string
  }
> = {
  default: {
    border: 'border-zinc-800',
    bg: 'bg-zinc-900/50',
    valueColor: 'text-white',
    iconColor: 'text-zinc-400',
  },
  success: {
    border: 'border-green-500/20',
    bg: 'bg-green-500/5',
    valueColor: 'text-green-400',
    iconColor: 'text-green-400',
  },
  warning: {
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    valueColor: 'text-amber-400',
    iconColor: 'text-amber-400',
  },
  danger: {
    border: 'border-red-500/20',
    bg: 'bg-red-500/5',
    valueColor: 'text-red-400',
    iconColor: 'text-red-400',
  },
  info: {
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    valueColor: 'text-blue-400',
    iconColor: 'text-blue-400',
  },
}

/**
 * StatCard - Styled statistic display for whitepaper
 *
 * @example
 * ```tsx
 * <StatCard
 *   value="97.6%"
 *   label="Average Safety Rate"
 *   variant="success"
 *   icon={Shield}
 *   trend={{ value: 5.2, direction: 'up' }}
 * />
 * ```
 */
export const StatCard = memo(function StatCard({
  value,
  label,
  icon: Icon,
  variant = 'default',
  trend,
  className,
}: StatCardProps) {
  const styles = VARIANT_STYLES[variant]

  return (
    <div
      className={cn(
        'rounded-xl border p-4 transition-colors duration-150',
        'hover:border-opacity-50',
        styles.border,
        styles.bg,
        className
      )}
    >
      {/* Header with icon */}
      {Icon && (
        <div className="mb-2">
          <Icon className={cn('h-5 w-5', styles.iconColor)} />
        </div>
      )}

      {/* Value */}
      <div className={cn('text-2xl font-bold', styles.valueColor)}>{value}</div>

      {/* Label and trend */}
      <div className="mt-1 flex items-center justify-between">
        <div className="text-sm text-zinc-500">{label}</div>

        {/* Trend indicator */}
        {trend && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend.direction === 'up' ? 'text-green-400' : 'text-red-400'
            )}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>{trend.value}%</span>
          </div>
        )}
      </div>
    </div>
  )
})

StatCard.displayName = 'StatCard'

export default StatCard
