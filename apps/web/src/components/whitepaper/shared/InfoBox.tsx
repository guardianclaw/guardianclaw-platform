/**
 * InfoBox Component
 *
 * A styled callout box for displaying informational content, warnings, tips, etc.
 * Supports multiple variants with appropriate icons and colors.
 */

'use client'

import { memo, useState } from 'react'
import { Info, AlertTriangle, CheckCircle, XCircle, Lightbulb, ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { InfoBoxProps, InfoBoxVariant } from './types'
import type { LucideIcon } from 'lucide-react'

/**
 * Variant configuration with icons and styles
 */
const VARIANT_CONFIG: Record<
  InfoBoxVariant,
  {
    icon: LucideIcon
    border: string
    bg: string
    iconColor: string
    titleColor: string
  }
> = {
  info: {
    icon: Info,
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    iconColor: 'text-blue-400',
    titleColor: 'text-blue-300',
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    iconColor: 'text-amber-400',
    titleColor: 'text-amber-300',
  },
  success: {
    icon: CheckCircle,
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    iconColor: 'text-green-400',
    titleColor: 'text-green-300',
  },
  error: {
    icon: XCircle,
    border: 'border-red-500/30',
    bg: 'bg-red-500/5',
    iconColor: 'text-red-400',
    titleColor: 'text-red-300',
  },
  tip: {
    icon: Lightbulb,
    border: 'border-claw-500/30',
    bg: 'bg-claw-500/5',
    iconColor: 'text-claw-400',
    titleColor: 'text-claw-300',
  },
}

/**
 * Default titles for variants if not provided
 */
const DEFAULT_TITLES: Record<InfoBoxVariant, string> = {
  info: 'Note',
  warning: 'Warning',
  success: 'Success',
  error: 'Error',
  tip: 'Tip',
}

/**
 * InfoBox - Styled callout box for whitepaper
 *
 * @example
 * ```tsx
 * <InfoBox variant="warning" title="Important">
 *   This action cannot be undone.
 * </InfoBox>
 *
 * <InfoBox variant="tip" collapsible defaultCollapsed>
 *   Click to expand for more details.
 * </InfoBox>
 * ```
 */
export const InfoBox = memo(function InfoBox({
  title,
  children,
  variant = 'info',
  icon: CustomIcon,
  collapsible = false,
  defaultCollapsed = false,
  className,
}: InfoBoxProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const config = VARIANT_CONFIG[variant]
  const Icon = CustomIcon || config.icon
  const displayTitle = title || DEFAULT_TITLES[variant]

  const toggleCollapse = () => {
    if (collapsible) {
      setIsCollapsed(!isCollapsed)
    }
  }

  return (
    <div
      className={cn('my-6 rounded-xl border', config.border, config.bg, className)}
      role="note"
      aria-label={displayTitle}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3',
          collapsible && 'cursor-pointer rounded-t-xl transition-colors hover:bg-white/5',
          collapsible && isCollapsed && 'rounded-b-xl'
        )}
        onClick={toggleCollapse}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? !isCollapsed : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={
          collapsible
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  toggleCollapse()
                }
              }
            : undefined
        }
      >
        <Icon className={cn('h-5 w-5 flex-shrink-0', config.iconColor)} />

        <span className={cn('flex-grow font-semibold', config.titleColor)}>{displayTitle}</span>

        {collapsible && (
          <motion.div animate={{ rotate: isCollapsed ? 0 : 180 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          </motion.div>
        )}
      </div>

      {/* Content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-4 pb-4 pt-1 text-zinc-400">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
})

InfoBox.displayName = 'InfoBox'

export default InfoBox
