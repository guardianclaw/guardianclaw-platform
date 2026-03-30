'use client'

import { Play, RotateCcw, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DemoControlsProps, DemoTheme } from './types'

/**
 * Theme-based button color mappings
 */
const buttonStyles: Record<DemoTheme, { bg: string; hover: string; shadow: string }> = {
  purple: {
    bg: 'bg-purple-500',
    hover: 'hover:bg-purple-600',
    shadow: 'shadow-purple-500/25',
  },
  violet: {
    bg: 'bg-violet-500',
    hover: 'hover:bg-violet-600',
    shadow: 'shadow-violet-500/25',
  },
  amber: {
    bg: 'bg-amber-500',
    hover: 'hover:bg-amber-600',
    shadow: 'shadow-amber-500/25',
  },
  teal: {
    bg: 'bg-teal-500',
    hover: 'hover:bg-teal-600',
    shadow: 'shadow-teal-500/25',
  },
  orange: {
    bg: 'bg-orange-500',
    hover: 'hover:bg-orange-600',
    shadow: 'shadow-orange-500/25',
  },
  blue: {
    bg: 'bg-blue-500',
    hover: 'hover:bg-blue-600',
    shadow: 'shadow-blue-500/25',
  },
  green: {
    bg: 'bg-green-500',
    hover: 'hover:bg-green-600',
    shadow: 'shadow-green-500/25',
  },
  red: {
    bg: 'bg-red-500',
    hover: 'hover:bg-red-600',
    shadow: 'shadow-red-500/25',
  },
  claw: {
    bg: 'bg-claw-500',
    hover: 'hover:bg-claw-600',
    shadow: 'shadow-claw-500/25',
  },
}

/**
 * DemoControls - Play and Reset buttons for demo playback
 *
 * Provides controls for starting and resetting the demo animation.
 * The play button is styled according to the theme color.
 *
 * @example
 * ```tsx
 * <DemoControls
 *   onPlay={startDemo}
 *   onReset={resetDemo}
 *   isPlaying={isPlaying}
 *   theme="amber"
 * />
 * ```
 */
export function DemoControls({
  onPlay,
  onReset,
  isPlaying,
  theme = 'purple',
  playLabel = 'Play Demo',
  playingLabel = 'Playing...',
  resetLabel = 'Reset',
}: DemoControlsProps) {
  const styles = buttonStyles[theme]

  return (
    <div className="mt-8 flex justify-center gap-4">
      {/* Play Button */}
      <button
        onClick={onPlay}
        disabled={isPlaying}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl px-8 py-3 font-medium transition-all',
          isPlaying
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : cn(styles.bg, 'text-white', styles.hover, 'shadow-lg', styles.shadow)
        )}
        aria-label={isPlaying ? playingLabel : playLabel}
      >
        <Play className="h-5 w-5" aria-hidden="true" />
        {isPlaying ? playingLabel : playLabel}
      </button>

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="bg-muted hover:bg-muted/80 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-all"
        aria-label={resetLabel}
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {resetLabel}
      </button>
    </div>
  )
}

/**
 * DemoControlsExtended - Controls with additional options
 *
 * Extended version that supports pause functionality and custom actions.
 *
 * @example
 * ```tsx
 * <DemoControlsExtended
 *   onPlay={handlePlay}
 *   onPause={handlePause}
 *   onReset={handleReset}
 *   state="playing"
 *   theme="teal"
 * />
 * ```
 */
export function DemoControlsExtended({
  onPlay,
  onPause,
  onReset,
  state,
  theme = 'purple',
  actions,
}: {
  onPlay: () => void
  onPause?: () => void
  onReset: () => void
  state: 'idle' | 'playing' | 'paused' | 'complete'
  theme?: DemoTheme
  actions?: {
    label: string
    icon: React.ComponentType<{ className?: string }>
    onClick: () => void
    disabled?: boolean
  }[]
}) {
  const styles = buttonStyles[theme]
  const canPlay = state === 'idle' || state === 'paused' || state === 'complete'
  const canPause = state === 'playing' && onPause

  return (
    <div className="mt-8 flex flex-wrap justify-center gap-4">
      {/* Play/Pause Button */}
      {canPause ? (
        <button
          onClick={onPause}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-8 py-3 font-medium transition-all',
            styles.bg,
            'text-white',
            styles.hover,
            'shadow-lg',
            styles.shadow
          )}
          aria-label="Pause demo"
        >
          <Pause className="h-5 w-5" aria-hidden="true" />
          Pause
        </button>
      ) : (
        <button
          onClick={onPlay}
          disabled={state === 'playing'}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl px-8 py-3 font-medium transition-all',
            state === 'playing'
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : cn(styles.bg, 'text-white', styles.hover, 'shadow-lg', styles.shadow)
          )}
          aria-label={state === 'playing' ? 'Playing...' : 'Play demo'}
        >
          <Play className="h-5 w-5" aria-hidden="true" />
          {state === 'playing' ? 'Playing...' : 'Play Demo'}
        </button>
      )}

      {/* Reset Button */}
      <button
        onClick={onReset}
        className="bg-muted hover:bg-muted/80 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-all"
        aria-label="Reset demo"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Reset
      </button>

      {/* Custom Actions */}
      {actions?.map((action, index) => {
        const ActionIcon = action.icon
        return (
          <button
            key={index}
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'bg-muted hover:bg-muted/80 inline-flex items-center gap-2 rounded-xl px-6 py-3 font-medium transition-all',
              action.disabled && 'cursor-not-allowed opacity-50'
            )}
            aria-label={action.label}
          >
            <ActionIcon className="h-4 w-4" aria-hidden="true" />
            {action.label}
          </button>
        )
      })}
    </div>
  )
}

export default DemoControls
