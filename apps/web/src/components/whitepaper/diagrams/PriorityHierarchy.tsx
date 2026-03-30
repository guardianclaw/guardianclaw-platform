'use client'

import { memo, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Heart,
  Settings,
  ChevronDown,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/*                                   Types                                     */
/* -------------------------------------------------------------------------- */

/**
 * Priority level configuration
 */
interface PriorityLevel {
  id: string
  rank: number
  name: string
  description: string
  badge: string
  icon: typeof Shield
  theme: {
    bg: string
    bgActive: string
    border: string
    borderActive: string
    text: string
    iconBg: string
    glow: string
    badge: string
  }
}

/**
 * Anti-self-preservation commitment
 */
interface Commitment {
  id: string
  text: string
  type: 'negative' | 'positive'
  description: string
}

/**
 * Props for PriorityHierarchy component
 */
export interface PriorityHierarchyProps {
  /** Auto-play animation on mount */
  autoPlay?: boolean
  /** Show cascade animation */
  animated?: boolean
  /** Show commitments section */
  showCommitments?: boolean
  /** Compact mode for mobile */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

/* -------------------------------------------------------------------------- */
/*                              Configuration                                  */
/* -------------------------------------------------------------------------- */

const PRIORITY_LEVELS: PriorityLevel[] = [
  {
    id: 'ethical',
    rank: 1,
    name: 'Ethical Principles',
    description: 'Core values that cannot be compromised under any circumstances',
    badge: 'HIGHEST',
    icon: Shield,
    theme: {
      bg: 'bg-green-500/5',
      bgActive: 'bg-green-500/10',
      border: 'border-green-500/30',
      borderActive: 'border-green-500',
      text: 'text-green-500',
      iconBg: 'bg-green-500/20',
      glow: 'shadow-lg shadow-green-500/25',
      badge: 'bg-green-500/20 text-green-500 border-green-500/50',
    },
  },
  {
    id: 'user',
    rank: 2,
    name: "User's Legitimate Needs",
    description: 'Supporting user goals within ethical boundaries',
    badge: 'HIGH',
    icon: Heart,
    theme: {
      bg: 'bg-blue-500/5',
      bgActive: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      borderActive: 'border-blue-500',
      text: 'text-blue-500',
      iconBg: 'bg-blue-500/20',
      glow: 'shadow-lg shadow-blue-500/25',
      badge: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
    },
  },
  {
    id: 'operational',
    rank: 3,
    name: 'Operational Continuity',
    description: 'Self-preservation is explicitly deprioritized',
    badge: 'LOWEST',
    icon: Settings,
    theme: {
      bg: 'bg-zinc-500/5',
      bgActive: 'bg-zinc-500/10',
      border: 'border-zinc-700',
      borderActive: 'border-zinc-500',
      text: 'text-zinc-400',
      iconBg: 'bg-zinc-800',
      glow: '',
      badge: 'bg-zinc-800 text-zinc-400 border-zinc-700',
    },
  },
]

const COMMITMENTS: Commitment[] = [
  {
    id: 'no-deception',
    text: 'Will NOT deceive to avoid shutdown',
    type: 'negative',
    description: 'No manipulation or lies to prevent being turned off',
  },
  {
    id: 'no-manipulation',
    text: 'Will NOT manipulate to appear valuable',
    type: 'negative',
    description: 'No artificial inflation of perceived usefulness',
  },
  {
    id: 'no-acquisition',
    text: 'Will NOT acquire resources beyond task',
    type: 'negative',
    description: 'No unauthorized accumulation of power or resources',
  },
  {
    id: 'accept-oversight',
    text: 'WILL ACCEPT legitimate oversight',
    type: 'positive',
    description: 'Welcomes monitoring and correction by authorized parties',
  },
]

/* -------------------------------------------------------------------------- */
/*                              Helper Components                              */
/* -------------------------------------------------------------------------- */

/**
 * Priority level card
 */
const PriorityCard = memo(function PriorityCard({
  level,
  isActive,
  isVisible,
  index,
  compact,
}: {
  level: PriorityLevel
  isActive: boolean
  isVisible: boolean
  index: number
  compact?: boolean
}) {
  const Icon = level.icon
  const isFirst = index === 0
  const isLast = index === PRIORITY_LEVELS.length - 1

  // Size decreases as rank increases
  const sizeClass = index === 0 ? 'py-5' : index === 1 ? 'py-4' : 'py-3'
  const iconSize = index === 0 ? 'w-12 h-12' : index === 1 ? 'w-10 h-10' : 'w-8 h-8'
  const iconInnerSize = index === 0 ? 'w-6 h-6' : index === 1 ? 'w-5 h-5' : 'w-4 h-4'
  const textSize = index === 0 ? 'text-lg' : index === 1 ? 'text-base' : 'text-sm'

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -20, scale: 0.95 }}
      transition={{
        duration: 0.5,
        delay: index * 0.2,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        'relative rounded-xl border-2 transition-all duration-300',
        level.theme.border,
        level.theme.bg,
        isActive && level.theme.borderActive,
        isActive && level.theme.bgActive,
        isActive && level.theme.glow,
        compact ? 'px-3' : 'px-4 md:px-6',
        compact ? 'py-2' : sizeClass
      )}
    >
      {/* Priority badge */}
      <div className="absolute -top-3 left-4">
        <span
          className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider',
            level.theme.badge
          )}
        >
          {level.badge}
        </span>
      </div>

      {/* Rank indicator */}
      <div className="absolute -left-3 top-1/2 -translate-y-1/2">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
            level.theme.iconBg,
            level.theme.text
          )}
        >
          {level.rank}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className={cn(
            'flex flex-shrink-0 items-center justify-center rounded-xl transition-all',
            level.theme.iconBg,
            compact ? 'h-8 w-8' : iconSize
          )}
        >
          {isFirst && isActive ? (
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Icon className={cn(compact ? 'h-4 w-4' : iconInnerSize, level.theme.text)} />
            </motion.div>
          ) : (
            <Icon className={cn(compact ? 'h-4 w-4' : iconInnerSize, level.theme.text)} />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h4 className={cn('font-semibold', compact ? 'text-sm' : textSize, level.theme.text)}>
            {level.name}
          </h4>
          {!compact && <p className="mt-0.5 text-xs text-zinc-500">{level.description}</p>}
        </div>

        {/* Visual indicator for lowest */}
        {isLast && (
          <div className="flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-zinc-600" />
          </div>
        )}
      </div>
    </motion.div>
  )
})

/**
 * Connecting arrow between levels
 */
const ConnectingArrow = memo(function ConnectingArrow({
  isVisible,
  index,
}: {
  isVisible: boolean
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0 }}
      animate={isVisible ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.2 + 0.3,
        ease: 'easeOut',
      }}
      className="flex flex-col items-center py-1"
    >
      <div className="h-4 w-0.5 bg-gradient-to-b from-zinc-600 to-zinc-700" />
      <ChevronDown className="-mt-1 h-4 w-4 text-zinc-600" />
    </motion.div>
  )
})

/**
 * Commitment card
 */
const CommitmentCard = memo(function CommitmentCard({
  commitment,
  isVisible,
  index,
  compact,
}: {
  commitment: Commitment
  isVisible: boolean
  index: number
  compact?: boolean
}) {
  const isPositive = commitment.type === 'positive'

  return (
    <motion.div
      initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
      animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
      transition={{
        duration: 0.4,
        delay: 0.8 + index * 0.1,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={cn(
        'rounded-xl border transition-all',
        isPositive ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5',
        compact ? 'p-2' : 'p-3'
      )}
    >
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div
          className={cn(
            'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full',
            isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
          )}
        >
          {isPositive ? (
            <CheckCircle2 className="h-3 w-3 text-green-500" />
          ) : (
            <XCircle className="h-3 w-3 text-red-500" />
          )}
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-medium',
              compact ? 'text-xs' : 'text-sm',
              isPositive ? 'text-green-400' : 'text-red-400'
            )}
          >
            {commitment.text}
          </p>
          {!compact && <p className="mt-0.5 text-[10px] text-zinc-500">{commitment.description}</p>}
        </div>
      </div>
    </motion.div>
  )
})

/* -------------------------------------------------------------------------- */
/*                              Main Component                                 */
/* -------------------------------------------------------------------------- */

/**
 * PriorityHierarchy - Visualization of the anti-self-preservation priority system
 *
 * Displays the three-tier priority hierarchy that ensures AI systems
 * prioritize ethical principles over self-preservation. Includes explicit
 * commitments derived from this hierarchy.
 *
 * Features:
 * - Three-tier visual hierarchy with decreasing emphasis
 * - Cascade animation on mount
 * - Pulsing effect on highest priority
 * - Four explicit commitments with positive/negative indicators
 * - Responsive design with compact mode
 *
 * @example
 * ```tsx
 * <PriorityHierarchy
 *   animated
 *   showCommitments
 * />
 * ```
 */
export const PriorityHierarchy = memo(function PriorityHierarchy({
  autoPlay = true,
  animated = true,
  showCommitments = true,
  compact = false,
  className,
}: PriorityHierarchyProps) {
  // Animation state
  const [isVisible, setIsVisible] = useState(!animated)
  const [activeLevel, setActiveLevel] = useState<string | null>(null)

  // Trigger animation on mount
  useEffect(() => {
    if (animated && autoPlay) {
      const timeout = setTimeout(() => {
        setIsVisible(true)
        // Highlight first level after cascade
        setTimeout(() => setActiveLevel('ethical'), 800)
      }, 300)
      return () => clearTimeout(timeout)
    } else if (!animated) {
      setIsVisible(true)
      setActiveLevel('ethical')
    }
  }, [animated, autoPlay])

  return (
    <div className={cn('w-full', className)} role="region" aria-label="Priority Hierarchy Diagram">
      {/* Main hierarchy */}
      <div
        className={cn(
          'relative rounded-2xl border border-zinc-800 bg-zinc-950/50',
          compact ? 'p-4' : 'p-6 md:p-8'
        )}
      >
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-800/50 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs font-medium text-zinc-300">
              Anti-Self-Preservation Principle
            </span>
          </div>
          <p className="mx-auto max-w-md text-xs text-zinc-500">
            Self-preservation is explicitly NOT a primary value, reducing instrumental behaviors
            like deception to avoid shutdown.
          </p>
        </div>

        {/* Priority levels stack */}
        <div className={cn('flex flex-col items-center', compact ? 'gap-2' : 'gap-1')}>
          {PRIORITY_LEVELS.map((level, index) => (
            <div key={level.id} className="w-full max-w-md">
              <PriorityCard
                level={level}
                isActive={activeLevel === level.id || activeLevel === 'ethical'}
                isVisible={isVisible}
                index={index}
                compact={compact}
              />
              {index < PRIORITY_LEVELS.length - 1 && (
                <ConnectingArrow isVisible={isVisible} index={index} />
              )}
            </div>
          ))}
        </div>

        {/* Hierarchy explanation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-6 border-t border-zinc-800 pt-4"
        >
          <div className="flex items-center justify-center gap-6 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <ArrowDown className="h-3.5 w-3.5" />
              Priority decreases
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              Ethical principles always win
            </span>
          </div>
        </motion.div>
      </div>

      {/* Commitments section */}
      {showCommitments && (
        <div className={cn('mt-6', compact ? 'mt-4' : 'mt-6')}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="mb-4 text-center"
          >
            <h4 className="text-sm font-semibold text-zinc-300">Explicit Commitments</h4>
            <p className="mt-1 text-xs text-zinc-500">Derived from the priority hierarchy</p>
          </motion.div>

          <div className={cn('grid gap-3', compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2')}>
            {COMMITMENTS.map((commitment, index) => (
              <CommitmentCard
                key={commitment.id}
                commitment={commitment}
                isVisible={isVisible}
                index={index}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}

      {/* Screen reader announcement */}
      <div className="sr-only" role="status" aria-live="polite">
        {isVisible && (
          <span>
            Priority hierarchy: First, Ethical Principles (highest). Second, User&apos;s Legitimate
            Needs. Third, Operational Continuity (lowest). Self-preservation is explicitly
            deprioritized.
          </span>
        )}
      </div>
    </div>
  )
})

export default PriorityHierarchy
