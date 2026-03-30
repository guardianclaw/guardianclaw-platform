'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { FlowParticleProps, DemoTheme } from './types'

/**
 * Color mappings for flow particles
 */
const particleColors: Record<DemoTheme, string> = {
  purple: 'bg-purple-500',
  violet: 'bg-violet-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  red: 'bg-red-500',
  claw: 'bg-claw-500',
}

/**
 * Direction-based animation configurations
 */
const directionAnimations = {
  down: {
    initial: { top: 0, left: '50%', x: '-50%', opacity: 0 },
    animate: { top: '100%', opacity: [0, 1, 1, 0] },
  },
  up: {
    initial: { bottom: 0, left: '50%', x: '-50%', opacity: 0 },
    animate: { bottom: '100%', opacity: [0, 1, 1, 0] },
  },
  left: {
    initial: { right: 0, top: '50%', y: '-50%', opacity: 0 },
    animate: { right: '100%', opacity: [0, 1, 1, 0] },
  },
  right: {
    initial: { left: 0, top: '50%', y: '-50%', opacity: 0 },
    animate: { left: '100%', opacity: [0, 1, 1, 0] },
  },
}

/**
 * FlowParticle - Animated particle showing data flow direction
 *
 * Creates a small animated circle that moves in the specified direction,
 * simulating data or request flow through a pipeline.
 *
 * @example
 * ```tsx
 * <div className="relative h-8">
 *   <div className="w-0.5 h-full bg-zinc-800 relative">
 *     <FlowParticle active={isProcessing} color="amber" direction="down" />
 *   </div>
 * </div>
 * ```
 */
export function FlowParticle({
  active,
  color = 'amber',
  direction = 'down',
  duration = 0.8,
}: FlowParticleProps) {
  if (!active) return null

  const animation = directionAnimations[direction]
  const colorClass = particleColors[color]

  return (
    <motion.div
      className={cn('absolute h-2 w-2 rounded-full', colorClass)}
      initial={animation.initial}
      animate={animation.animate}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'linear',
      }}
      aria-hidden="true"
    />
  )
}

/**
 * FlowLine - Connection line with optional particle animation
 *
 * A container for vertical or horizontal flow lines with particles.
 *
 * @example
 * ```tsx
 * <FlowLine
 *   active={isValidating}
 *   color="green"
 *   orientation="vertical"
 *   height={32}
 * />
 * ```
 */
export function FlowLine({
  active = false,
  color = 'amber',
  orientation = 'vertical',
  height = 32,
  width = 2,
  particleDuration = 0.8,
  className,
}: {
  active?: boolean
  color?: DemoTheme
  orientation?: 'vertical' | 'horizontal'
  height?: number
  width?: number
  particleDuration?: number
  className?: string
}) {
  const isVertical = orientation === 'vertical'

  return (
    <div
      className={cn('flex items-center justify-center', isVertical ? 'py-1' : 'px-1', className)}
    >
      <div
        className="relative bg-zinc-800"
        style={{
          height: isVertical ? height : width,
          width: isVertical ? width : height,
        }}
      >
        <FlowParticle
          active={active}
          color={color}
          direction={isVertical ? 'down' : 'right'}
          duration={particleDuration}
        />
      </div>
    </div>
  )
}

/**
 * FlowConnector - Connector between pipeline steps
 *
 * Simple vertical line used between steps in a pipeline visualization.
 *
 * @example
 * ```tsx
 * <FlowConnector />
 * ```
 */
export function FlowConnector({ className, height = 24 }: { className?: string; height?: number }) {
  return (
    <div className={cn('flex items-center justify-center py-1', className)}>
      <div className="w-0.5 bg-zinc-800" style={{ height }} />
    </div>
  )
}

export default FlowParticle
