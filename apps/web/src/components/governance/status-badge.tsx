'use client'

/**
 * Status badge component for proposal status display
 */

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ProposalStatus } from '@/lib/api'
import { getStatusLabel, getStatusColor, getStatusTextColor } from '@/lib/governance'

interface StatusBadgeProps {
  status: ProposalStatus
  size?: 'sm' | 'md' | 'lg'
  animated?: boolean
  className?: string
}

export function StatusBadge({ status, size = 'md', animated = true, className }: StatusBadgeProps) {
  const label = getStatusLabel(status)
  const bgColor = getStatusColor(status)
  const textColor = getStatusTextColor(status)

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  const isActive = status === 'voting' || status === 'discussion'

  const Wrapper = animated ? motion.span : 'span'
  const motionProps = animated
    ? {
        initial: { opacity: 0, scale: 0.9 },
        animate: { opacity: 1, scale: 1 },
        transition: { duration: 0.2 },
      }
    : {}

  return (
    <Wrapper
      {...motionProps}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        bgColor,
        textColor,
        'bg-opacity-20',
        sizeClasses[size],
        className
      )}
    >
      {isActive && (
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              bgColor
            )}
          />
          <span className={cn('relative inline-flex h-2 w-2 rounded-full', bgColor)} />
        </span>
      )}
      {label}
    </Wrapper>
  )
}

export default StatusBadge
