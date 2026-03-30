'use client'

import { cn } from '@/lib/utils'
import type { DemoHeaderProps, DemoTheme } from './types'

/**
 * Badge color mappings for each theme
 */
const badgeStyles: Record<DemoTheme, { bg: string; text: string }> = {
  purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
  violet: { bg: 'bg-violet-500/10', text: 'text-violet-500' },
  amber: { bg: 'bg-amber-500/10', text: 'text-amber-500' },
  teal: { bg: 'bg-teal-500/10', text: 'text-teal-500' },
  orange: { bg: 'bg-orange-500/10', text: 'text-orange-500' },
  blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
  green: { bg: 'bg-green-500/10', text: 'text-green-500' },
  red: { bg: 'bg-red-500/10', text: 'text-red-500' },
  claw: { bg: 'bg-claw-500/10', text: 'text-claw-500' },
}

/**
 * DemoHeader - Header section for demo components
 *
 * Displays a themed badge with icon, a title, and a subtitle.
 * Used at the top of each integration demo to identify the integration
 * and describe what the demo shows.
 *
 * @example
 * ```tsx
 * <DemoHeader
 *   icon={Users}
 *   badge="VoltAgent + GuardianClaw"
 *   title="Protected Multi-Agent Workflows"
 *   subtitle="Watch how GuardianClaw validates each agent in your VoltAgent pipeline"
 *   theme="purple"
 * />
 * ```
 */
export function DemoHeader({
  icon: Icon,
  badge,
  title,
  subtitle,
  theme = 'purple',
}: DemoHeaderProps) {
  const styles = badgeStyles[theme]

  return (
    <div className="mb-8 text-center">
      {/* Badge */}
      <div
        className={cn(
          'mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium',
          styles.bg,
          styles.text
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {badge}
      </div>

      {/* Title */}
      <h3 className="mb-2 text-2xl font-bold">{title}</h3>

      {/* Subtitle */}
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  )
}

/**
 * DemoSection - A wrapper that can be used for demo subsections
 *
 * @example
 * ```tsx
 * <DemoSection title="Validation Pipeline" icon={Shield}>
 *   <ValidationSteps ... />
 * </DemoSection>
 * ```
 */
export function DemoSection({
  title,
  icon: Icon,
  theme = 'purple',
  children,
  className,
}: {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  theme?: DemoTheme
  children: React.ReactNode
  className?: string
}) {
  const styles = badgeStyles[theme]

  return (
    <div className={cn('bg-background rounded-2xl border p-6', className)}>
      <div className="mb-6 flex items-center gap-2">
        {Icon && <Icon className={cn('h-5 w-5', styles.text)} />}
        <h4 className="font-semibold">{title}</h4>
      </div>
      {children}
    </div>
  )
}

export default DemoHeader
