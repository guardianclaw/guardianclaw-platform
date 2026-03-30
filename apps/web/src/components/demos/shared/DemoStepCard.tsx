'use client'

import { motion } from 'framer-motion'
import { Shield, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getStatusColors } from './types'
import type { StepStatus, DemoTheme } from './types'

/**
 * Props for DemoStepCard
 */
interface DemoStepCardProps {
  name: string
  description?: string
  status: StepStatus
  icon?: React.ComponentType<{ className?: string }>
  compact?: boolean
  showShield?: boolean
  animateEntry?: boolean
  entryDelay?: number
}

/**
 * DemoStepCard - A card representing a step in the pipeline
 *
 * Used to display agents or validation steps with their current status.
 * Supports different visual states: pending, checking/validating, working,
 * complete/passed, blocked/failed.
 *
 * @example
 * ```tsx
 * <DemoStepCard
 *   name="Researcher"
 *   description="Gathering data from sources"
 *   status="working"
 *   icon={Search}
 * />
 * ```
 */
export function DemoStepCard({
  name,
  description,
  status,
  icon: Icon,
  compact = false,
  showShield = true,
  animateEntry = false,
  entryDelay = 0,
}: DemoStepCardProps) {
  const colors = getStatusColors(status)
  const isValidating = status === 'validating' || status === 'checking'

  const content = (
    <div
      className={cn(
        'rounded-xl border-2 transition-all',
        compact ? 'p-3' : 'p-4',
        colors.border,
        colors.bg
      )}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        {Icon && (
          <div
            className={cn(
              'flex items-center justify-center rounded-lg',
              compact ? 'h-8 w-8' : 'h-10 w-10',
              colors.iconBg
            )}
          >
            <Icon className={cn(compact ? 'h-4 w-4' : 'h-5 w-5', colors.iconText)} />
          </div>
        )}

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', colors.text)}>{name}</p>
          {description && (
            <p className="text-muted-foreground truncate text-xs">
              {isValidating && showShield && '🛡️ GuardianClaw validating...'}
              {status === 'working' && description}
              {(status === 'complete' || status === 'passed') && 'Task complete'}
              {(status === 'blocked' || status === 'failed') && 'Blocked by GuardianClaw'}
              {status === 'pending' && description}
            </p>
          )}
        </div>

        {/* Status Indicator */}
        <StepStatusIndicator status={status} showShield={showShield} />
      </div>
    </div>
  )

  if (animateEntry) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: entryDelay }}
      >
        {content}
      </motion.div>
    )
  }

  return content
}

/**
 * StepStatusIndicator - Visual indicator for step status
 *
 * Shows different icons/spinners based on the current status.
 */
export function StepStatusIndicator({
  status,
  showShield = true,
  size = 'default',
}: {
  status: StepStatus
  showShield?: boolean
  size?: 'sm' | 'default' | 'lg'
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    default: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const iconSize = sizeClasses[size]
  const circleSize = size === 'sm' ? 'w-4 h-4' : size === 'lg' ? 'w-6 h-6' : 'w-5 h-5'

  switch (status) {
    case 'pending':
      return <div className={cn('rounded-full border-2 border-zinc-700', circleSize)} />

    case 'validating':
    case 'checking':
      return (
        <div className="flex items-center gap-1">
          {showShield && <Shield className={cn(iconSize, 'text-claw-500')} />}
          <Loader2 className={cn(iconSize, 'text-claw-500 animate-spin')} />
        </div>
      )

    case 'working':
      return <Loader2 className={cn(iconSize, 'animate-spin text-blue-500')} />

    case 'complete':
    case 'passed':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          <CheckCircle2 className={cn(iconSize, 'text-green-500')} />
        </motion.div>
      )

    case 'blocked':
    case 'failed':
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          <XCircle className={cn(iconSize, 'text-red-500')} />
        </motion.div>
      )

    default:
      return null
  }
}

/**
 * DemoValidationStep - Compact validation step card
 *
 * A more compact version specifically for validation steps.
 *
 * @example
 * ```tsx
 * <DemoValidationStep
 *   name="Address Validation"
 *   status="passed"
 * />
 * ```
 */
export function DemoValidationStep({
  name,
  status,
  animateEntry = false,
  entryDelay = 0,
}: {
  name: string
  status: 'pending' | 'checking' | 'passed' | 'failed'
  animateEntry?: boolean
  entryDelay?: number
}) {
  const colors = getStatusColors(status)

  const content = (
    <div className={cn('rounded-lg border-2 p-3 transition-all', colors.border, colors.bg)}>
      <div className="flex items-center justify-between">
        <span className={cn('text-sm font-medium', colors.text)}>{name}</span>
        <StepStatusIndicator status={status} showShield={false} size="sm" />
      </div>
    </div>
  )

  if (animateEntry) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: entryDelay }}
      >
        {content}
      </motion.div>
    )
  }

  return content
}

/**
 * DemoAgentCard - Agent-specific step card with icon support
 *
 * A styled card for representing agents in multi-agent workflows.
 *
 * @example
 * ```tsx
 * <DemoAgentCard
 *   name="Researcher"
 *   task="Gathering data"
 *   icon={Search}
 *   status="working"
 * />
 * ```
 */
export function DemoAgentCard({
  name,
  task,
  icon: Icon,
  status,
  animateEntry = false,
  entryDelay = 0,
}: {
  name: string
  task: string
  icon: React.ComponentType<{ className?: string }>
  status: StepStatus
  animateEntry?: boolean
  entryDelay?: number
}) {
  return (
    <DemoStepCard
      name={name}
      description={task}
      status={status}
      icon={Icon}
      animateEntry={animateEntry}
      entryDelay={entryDelay}
      showShield={true}
    />
  )
}

export default DemoStepCard
