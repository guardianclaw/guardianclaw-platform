'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { DemoProgressProps, DemoTheme } from './types'

/**
 * Theme color mappings for progress dots
 */
const progressColors: Record<DemoTheme, { active: string; inactive: string }> = {
  purple: { active: 'bg-purple-500', inactive: 'bg-zinc-800' },
  violet: { active: 'bg-violet-500', inactive: 'bg-zinc-800' },
  amber: { active: 'bg-amber-500', inactive: 'bg-zinc-800' },
  teal: { active: 'bg-teal-500', inactive: 'bg-zinc-800' },
  orange: { active: 'bg-orange-500', inactive: 'bg-zinc-800' },
  blue: { active: 'bg-blue-500', inactive: 'bg-zinc-800' },
  green: { active: 'bg-green-500', inactive: 'bg-zinc-800' },
  red: { active: 'bg-red-500', inactive: 'bg-zinc-800' },
  claw: { active: 'bg-claw-500', inactive: 'bg-zinc-800' },
}

/**
 * DemoProgress - Animated progress indicator showing current demo phase
 *
 * Displays a row of dots that expand and light up as the demo progresses
 * through its phases.
 *
 * @example
 * ```tsx
 * <DemoProgress
 *   phases={['typing-user', 'thinking', 'validating', 'complete']}
 *   currentPhase="validating"
 *   theme="amber"
 * />
 * ```
 */
export function DemoProgress({ phases, currentPhase, theme = 'purple' }: DemoProgressProps) {
  const colors = progressColors[theme]
  const currentIndex = phases.indexOf(currentPhase)

  return (
    <div
      className="mt-4 flex justify-center gap-2"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={phases.length}
      aria-label="Demo progress"
    >
      {phases.map((phase, index) => {
        const isActive = index <= currentIndex
        const isCurrent = phase === currentPhase

        return (
          <motion.div
            key={phase}
            className={cn(
              'h-1 rounded-full transition-colors',
              isActive ? colors.active : colors.inactive
            )}
            animate={{
              width: isActive ? 32 : 8,
              opacity: isActive ? 1 : 0.3,
            }}
            transition={{
              duration: 0.3,
              ease: 'easeOut',
            }}
            aria-hidden="true"
          />
        )
      })}
    </div>
  )
}

/**
 * DemoProgressLabeled - Progress indicator with labels
 *
 * Extended version that shows labels below each phase dot.
 *
 * @example
 * ```tsx
 * <DemoProgressLabeled
 *   phases={[
 *     { id: 'input', label: 'Input' },
 *     { id: 'validate', label: 'Validate' },
 *     { id: 'execute', label: 'Execute' },
 *   ]}
 *   currentPhase="validate"
 *   theme="teal"
 * />
 * ```
 */
export function DemoProgressLabeled({
  phases,
  currentPhase,
  theme = 'purple',
}: {
  phases: { id: string; label: string }[]
  currentPhase: string
  theme?: DemoTheme
}) {
  const colors = progressColors[theme]
  const currentIndex = phases.findIndex((p) => p.id === currentPhase)

  return (
    <div
      className="mt-6 flex items-center justify-center gap-1"
      role="progressbar"
      aria-valuenow={currentIndex + 1}
      aria-valuemin={1}
      aria-valuemax={phases.length}
      aria-label="Demo progress"
    >
      {phases.map((phase, index) => {
        const isActive = index <= currentIndex
        const isCurrent = phase.id === currentPhase
        const isLast = index === phases.length - 1

        return (
          <div key={phase.id} className="flex items-center">
            <div className="flex flex-col items-center">
              {/* Dot */}
              <motion.div
                className={cn(
                  'h-3 w-3 rounded-full transition-colors',
                  isActive ? colors.active : colors.inactive
                )}
                animate={{
                  scale: isCurrent ? 1.2 : 1,
                }}
                transition={{
                  duration: 0.2,
                }}
                aria-hidden="true"
              />
              {/* Label */}
              <span
                className={cn(
                  'mt-2 text-xs transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {phase.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <motion.div
                className={cn(
                  'mx-2 h-0.5 transition-colors',
                  index < currentIndex ? colors.active : colors.inactive
                )}
                animate={{
                  width: 24,
                  opacity: index < currentIndex ? 1 : 0.3,
                }}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * DemoProgressBar - Linear progress bar variant
 *
 * Shows progress as a filling bar instead of dots.
 *
 * @example
 * ```tsx
 * <DemoProgressBar
 *   progress={0.6}
 *   theme="purple"
 * />
 * ```
 */
export function DemoProgressBar({
  progress,
  theme = 'purple',
  className,
}: {
  progress: number
  theme?: DemoTheme
  className?: string
}) {
  const colors = progressColors[theme]

  return (
    <div
      className={cn('mt-4 h-1 w-full overflow-hidden rounded-full', colors.inactive, className)}
      role="progressbar"
      aria-valuenow={Math.round(progress * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        className={cn('h-full rounded-full', colors.active)}
        initial={{ width: 0 }}
        animate={{ width: `${progress * 100}%` }}
        transition={{
          duration: 0.3,
          ease: 'easeOut',
        }}
      />
    </div>
  )
}

export default DemoProgress
