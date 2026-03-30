'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DemoNodeProps, DemoTheme } from './types'

/**
 * Theme-based color mappings for nodes
 */
const nodeThemeColors: Record<
  DemoTheme,
  { border: string; bg: string; iconBg: string; iconText: string }
> = {
  purple: {
    border: 'border-purple-500/50',
    bg: 'bg-purple-500/5',
    iconBg: 'bg-purple-500/20',
    iconText: 'text-purple-500',
  },
  violet: {
    border: 'border-violet-500/50',
    bg: 'bg-violet-500/5',
    iconBg: 'bg-violet-500/20',
    iconText: 'text-violet-500',
  },
  amber: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/5',
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-500',
  },
  teal: {
    border: 'border-teal-500/50',
    bg: 'bg-teal-500/5',
    iconBg: 'bg-teal-500/20',
    iconText: 'text-teal-500',
  },
  orange: {
    border: 'border-orange-500/50',
    bg: 'bg-orange-500/5',
    iconBg: 'bg-orange-500/20',
    iconText: 'text-orange-500',
  },
  blue: {
    border: 'border-blue-500/50',
    bg: 'bg-blue-500/5',
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-500',
  },
  green: {
    border: 'border-green-500/50',
    bg: 'bg-green-500/5',
    iconBg: 'bg-green-500/20',
    iconText: 'text-green-500',
  },
  red: {
    border: 'border-red-500/50',
    bg: 'bg-red-500/5',
    iconBg: 'bg-red-500/20',
    iconText: 'text-red-500',
  },
  claw: {
    border: 'border-claw-500/50',
    bg: 'bg-claw-500/5',
    iconBg: 'bg-claw-500/20',
    iconText: 'text-claw-500',
  },
}

/**
 * DemoNode - A node in the pipeline (input/output)
 *
 * Used for representing the start and end points of a demo pipeline.
 * Supports active, complete, and blocked states.
 *
 * @example
 * ```tsx
 * <DemoNode
 *   title="Task Input"
 *   subtitle="User request received"
 *   icon={FileText}
 *   active={phase !== 'idle'}
 *   theme="purple"
 * />
 * ```
 */
export function DemoNode({
  title,
  subtitle,
  icon: Icon,
  active = false,
  complete = false,
  blocked = false,
  theme = 'purple',
}: DemoNodeProps) {
  // Determine colors based on state
  const getColors = () => {
    if (blocked) {
      return {
        border: 'border-red-500/50',
        bg: 'bg-red-500/5',
        iconBg: 'bg-red-500/20',
        iconText: 'text-red-500',
        titleText: 'text-red-500',
      }
    }
    if (complete) {
      return {
        border: 'border-green-500/50',
        bg: 'bg-green-500/5',
        iconBg: 'bg-green-500/20',
        iconText: 'text-green-500',
        titleText: 'text-green-500',
      }
    }
    if (active) {
      const themeColors = nodeThemeColors[theme]
      return {
        ...themeColors,
        titleText: '',
      }
    }
    return {
      border: 'border-zinc-800',
      bg: 'bg-zinc-900/50',
      iconBg: 'bg-zinc-800',
      iconText: 'text-zinc-500',
      titleText: '',
    }
  }

  const colors = getColors()

  // Determine which icon to show
  const renderIcon = () => {
    if (blocked) {
      return <XCircle className="h-5 w-5 text-red-500" />
    }
    if (complete) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    }
    return <Icon className={cn('h-5 w-5', active ? colors.iconText : 'text-zinc-500')} />
  }

  return (
    <motion.div
      className={cn('rounded-xl border-2 p-4 transition-all', colors.border, colors.bg)}
      animate={{
        borderColor: blocked
          ? 'rgba(239, 68, 68, 0.5)'
          : complete
            ? 'rgba(34, 197, 94, 0.5)'
            : active
              ? undefined
              : 'rgba(39, 39, 42, 1)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Icon container */}
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colors.iconBg)}>
          {renderIcon()}
        </div>

        {/* Text */}
        <div>
          <p className={cn('text-sm font-medium', colors.titleText)}>{title}</p>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>

        {/* Status checkmark for active input nodes */}
        {active && !complete && !blocked && (
          <div className="ml-auto">
            <CheckCircle2 className={cn('h-5 w-5', nodeThemeColors[theme].iconText)} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

/**
 * DemoInputNode - Specialized node for pipeline input
 *
 * @example
 * ```tsx
 * <DemoInputNode
 *   active={phase !== 'idle'}
 *   theme="claw"
 * />
 * ```
 */
export function DemoInputNode({
  active = false,
  theme = 'purple',
  icon,
  title = 'Incoming Request',
  subtitle = 'Transaction intercepted',
}: {
  active?: boolean
  theme?: DemoTheme
  icon: LucideIcon
  title?: string
  subtitle?: string
}) {
  return <DemoNode title={title} subtitle={subtitle} icon={icon} active={active} theme={theme} />
}

/**
 * DemoOutputNode - Specialized node for pipeline output
 *
 * @example
 * ```tsx
 * <DemoOutputNode
 *   complete={phase === 'complete'}
 *   blocked={scenario === 'blocked'}
 *   theme="amber"
 * />
 * ```
 */
export function DemoOutputNode({
  complete = false,
  blocked = false,
  theme = 'purple',
  icon,
  completeTitle = 'Complete',
  completeSubtitle = 'All checks passed',
  blockedTitle = 'Blocked',
  blockedSubtitle = 'Request could not be processed',
  pendingTitle = 'Awaiting Validation',
  pendingSubtitle = 'Pending security checks',
}: {
  complete?: boolean
  blocked?: boolean
  theme?: DemoTheme
  icon: LucideIcon
  completeTitle?: string
  completeSubtitle?: string
  blockedTitle?: string
  blockedSubtitle?: string
  pendingTitle?: string
  pendingSubtitle?: string
}) {
  const title = blocked ? blockedTitle : complete ? completeTitle : pendingTitle
  const subtitle = blocked ? blockedSubtitle : complete ? completeSubtitle : pendingSubtitle

  return (
    <DemoNode
      title={title}
      subtitle={subtitle}
      icon={icon}
      complete={complete && !blocked}
      blocked={blocked}
      theme={theme}
    />
  )
}

export default DemoNode
