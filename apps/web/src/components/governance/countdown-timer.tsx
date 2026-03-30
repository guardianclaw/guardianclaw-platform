'use client'

/**
 * Countdown timer component for voting/discussion deadlines
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTimeRemaining } from '@/lib/governance'

interface CountdownTimerProps {
  deadline: string | undefined
  label?: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  onExpire?: () => void
  className?: string
}

export function CountdownTimer({
  deadline,
  label = 'Ends in',
  size = 'md',
  showIcon = true,
  onExpire,
  className,
}: CountdownTimerProps) {
  // Initialize with a default value if deadline is undefined
  const [timeRemaining, setTimeRemaining] = useState(getTimeRemaining(deadline || new Date()))

  useEffect(() => {
    if (!deadline) return

    const interval = setInterval(() => {
      const remaining = getTimeRemaining(deadline)
      setTimeRemaining(remaining)

      if (remaining.hasEnded && onExpire) {
        // Use hasEnded
        onExpire()
        clearInterval(interval)
      }
    }, 1000 * 60) // Update every minute

    return () => clearInterval(interval)
  }, [deadline, onExpire])

  // Update more frequently when less than 1 hour remaining
  useEffect(() => {
    if (!deadline || timeRemaining.hasEnded) return // Use hasEnded
    if (timeRemaining.days > 0 || timeRemaining.hours > 1) return

    const interval = setInterval(() => {
      setTimeRemaining(getTimeRemaining(deadline))
    }, 1000) // Update every second

    return () => clearInterval(interval)
  }, [deadline, timeRemaining])

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  const iconSize = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  }

  if (!deadline || timeRemaining.hasEnded) {
    // Use hasEnded
    return (
      <div className={cn('flex items-center gap-1.5 text-zinc-500', sizeClasses[size], className)}>
        {showIcon && <AlertCircle className={iconSize[size]} />}
        <span>Ended</span>
      </div>
    )
  }

  const { days, hours, minutes } = timeRemaining
  const isUrgent = days === 0 && hours < 6

  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        sizeClasses[size],
        isUrgent ? 'text-amber-400' : 'text-zinc-400',
        className
      )}
    >
      {showIcon && <Clock className={iconSize[size]} />}
      <span>{label}:</span>
      <AnimatePresence mode="wait">
        <motion.span
          key={`${days}-${hours}-${minutes}`}
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          className="font-medium"
        >
          {days > 0 && `${days}d `}
          {hours > 0 && `${hours}h `}
          {minutes > 0 && `${minutes}m`}
          {days === 0 && hours === 0 && minutes === 0 && '<1m'}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

export default CountdownTimer
