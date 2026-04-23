'use client'

import { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { ThreatGaugeProps } from './types'

/**
 * Get color based on threat level
 */
function getThreatColor(level: number): {
  primary: string
  glow: string
  text: string
} {
  if (level >= 70) {
    return {
      primary: '#ef4444', // red-500
      glow: 'rgba(239, 68, 68, 0.5)',
      text: 'text-red-500',
    }
  }
  if (level >= 40) {
    return {
      primary: '#f59e0b', // amber-500
      glow: 'rgba(245, 158, 11, 0.5)',
      text: 'text-amber-500',
    }
  }
  if (level >= 10) {
    return {
      primary: '#3b82f6', // blue-500
      glow: 'rgba(59, 130, 246, 0.4)',
      text: 'text-blue-500',
    }
  }
  return {
    primary: '#22c55e', // green-500
    glow: 'rgba(34, 197, 94, 0.4)',
    text: 'text-green-500',
  }
}

/**
 * Get threat level label
 */
function getThreatLabel(level: number): string {
  if (level >= 70) return 'CRITICAL'
  if (level >= 40) return 'ELEVATED'
  if (level >= 10) return 'LOW'
  return 'SAFE'
}

/**
 * Size configurations
 */
const sizeConfig = {
  sm: { width: 80, height: 48, strokeWidth: 6, fontSize: 'text-sm', labelSize: 'text-[8px]' },
  md: { width: 120, height: 72, strokeWidth: 8, fontSize: 'text-xl', labelSize: 'text-[10px]' },
  lg: { width: 160, height: 96, strokeWidth: 10, fontSize: 'text-2xl', labelSize: 'text-xs' },
}

/**
 * ThreatGauge - Visual indicator showing threat level
 *
 * Displays a semi-circular gauge that fills based on the threat level (0-100).
 * Uses stroke-dasharray for precise alignment between background and foreground.
 */
export function ThreatGauge({
  level,
  animated = true,
  size = 'md',
  showLabel = true,
  className,
}: ThreatGaugeProps) {
  const [displayLevel, setDisplayLevel] = useState(animated ? 0 : level)
  const config = sizeConfig[size]
  const colors = getThreatColor(displayLevel)

  // Animate level changes
  useEffect(() => {
    if (!animated) {
      setDisplayLevel(level)
      return
    }

    const duration = 800
    const steps = 30
    const stepDuration = duration / steps
    const startLevel = displayLevel
    const diff = level - startLevel
    let step = 0

    const interval = setInterval(() => {
      step++
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayLevel(Math.round(startLevel + diff * eased))

      if (step >= steps) {
        clearInterval(interval)
        setDisplayLevel(level)
      }
    }, stepDuration)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, animated])

  // Calculate arc geometry
  const centerX = config.width / 2
  const centerY = config.height - 4
  const radius = Math.min(centerX, centerY) - config.strokeWidth / 2 - 4

  // Semi-circle arc length (half of circumference)
  const circumference = Math.PI * radius

  // Calculate how much of the arc to show
  const arcLength = (displayLevel / 100) * circumference
  const dashArray = `${arcLength} ${circumference}`

  // Arc path - simple semi-circle from left to right
  const arcPath = useMemo(() => {
    const startX = centerX - radius
    const startY = centerY
    const endX = centerX + radius
    const endY = centerY
    return `M ${startX} ${startY} A ${radius} ${radius} 0 0 1 ${endX} ${endY}`
  }, [centerX, centerY, radius])

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <svg
        width={config.width}
        height={config.height}
        className="overflow-visible"
        role="img"
        aria-label={`Threat level: ${displayLevel}%`}
      >
        {/* Background track - full semi-circle */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(39, 39, 42, 0.8)"
          strokeWidth={config.strokeWidth}
        />

        {/* Foreground arc - uses same path with dasharray to control fill */}
        {displayLevel > 0 && (
          <path
            d={arcPath}
            fill="none"
            stroke={colors.primary}
            strokeWidth={config.strokeWidth}
            strokeDasharray={dashArray}
            style={{
              filter: displayLevel >= 40 ? `drop-shadow(0 0 6px ${colors.glow})` : undefined,
            }}
          />
        )}

        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = Math.PI - (Math.PI * tick) / 100
          const innerRadius = radius - config.strokeWidth / 2 - 4
          const outerRadius = radius - config.strokeWidth / 2 - 8
          const x1 = centerX + innerRadius * Math.cos(angle)
          const y1 = centerY - innerRadius * Math.sin(angle)
          const x2 = centerX + outerRadius * Math.cos(angle)
          const y2 = centerY - outerRadius * Math.sin(angle)

          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(113, 113, 122, 0.5)"
              strokeWidth={1}
            />
          )
        })}
      </svg>

      {/* Center value display */}
      <div
        className="absolute flex flex-col items-center justify-center"
        style={{
          bottom: size === 'sm' ? 4 : size === 'md' ? 8 : 12,
        }}
      >
        <motion.span
          className={cn('font-mono font-bold', config.fontSize, colors.text)}
          key={displayLevel}
          initial={animated ? { scale: 1.1, opacity: 0.8 } : {}}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {displayLevel}
        </motion.span>
        {showLabel && (
          <span
            className={cn('font-mono uppercase tracking-wider text-zinc-500', config.labelSize)}
          >
            {getThreatLabel(displayLevel)}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * ThreatGaugeCompact - Inline version for tight spaces
 */
export function ThreatGaugeCompact({ level, className }: { level: number; className?: string }) {
  const colors = getThreatColor(level)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative h-2 w-16 overflow-hidden rounded-full bg-zinc-800">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: colors.primary }}
          initial={{ width: 0 }}
          animate={{ width: `${level}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('font-mono text-xs', colors.text)}>{level}%</span>
    </div>
  )
}

export default ThreatGauge
