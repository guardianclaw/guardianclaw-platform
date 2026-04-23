'use client'

import { motion } from 'framer-motion'
import { Shield, Eye, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProtectionLevelSelectorProps, ProtectionLevel } from './types'
import { protectionLevelConfig } from './types'

/**
 * Icon mapping for each protection level
 */
const levelIcons: Record<ProtectionLevel, React.ComponentType<{ className?: string }>> = {
  off: ShieldOff,
  watch: Eye,
  guard: ShieldAlert,
  shield: ShieldCheck,
}

/**
 * Level button with animated selection indicator
 */
function LevelButton({
  level,
  isSelected,
  isDisabled,
  onClick,
}: {
  level: ProtectionLevel
  isSelected: boolean
  isDisabled: boolean
  onClick: () => void
}) {
  const config = protectionLevelConfig[level]
  const Icon = levelIcons[level]

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        'relative flex flex-col items-center gap-1 rounded-lg px-3 py-2 transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950',
        isSelected && config.bgColor,
        isSelected && config.borderColor,
        isSelected && 'border',
        !isSelected && 'border border-transparent hover:bg-zinc-800/50',
        isDisabled && 'cursor-not-allowed opacity-50',
        !isDisabled && !isSelected && 'cursor-pointer'
      )}
      aria-pressed={isSelected}
      aria-label={`Set protection level to ${config.name}`}
    >
      {/* Icon */}
      <Icon
        className={cn('h-5 w-5 transition-colors', isSelected ? config.color : 'text-zinc-500')}
      />

      {/* Label */}
      <span
        className={cn(
          'text-xs font-medium transition-colors',
          isSelected ? config.color : 'text-zinc-500'
        )}
      >
        {config.name}
      </span>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          className={cn(
            'absolute -bottom-1 left-1/2 h-1 w-1 rounded-full',
            config.color.replace('text-', 'bg-')
          )}
          layoutId="level-indicator"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </button>
  )
}

/**
 * Detailed info panel showing what the selected level does
 */
function LevelDetails({ level }: { level: ProtectionLevel }) {
  const config = protectionLevelConfig[level]

  return (
    <motion.div
      key={level}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.2 }}
      className={cn('rounded-lg border p-3', config.bgColor, config.borderColor)}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn('rounded-lg p-2', config.bgColor)}>
          <Shield className={cn('h-5 w-5', config.color)} />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn('font-semibold', config.color)}>{config.name}</span>
            <span className="text-xs text-zinc-500">{config.description}</span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Blocking:</span>
              <span
                className={cn(
                  config.blocking === 'None'
                    ? 'text-zinc-500'
                    : config.blocking === 'Critical'
                      ? 'text-amber-400'
                      : 'text-green-400'
                )}
              >
                {config.blocking}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500">Alerting:</span>
              <span
                className={cn(
                  config.alerting === 'None'
                    ? 'text-zinc-500'
                    : config.alerting === 'All threats'
                      ? 'text-blue-400'
                      : 'text-amber-400'
                )}
              >
                {config.alerting}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * ProtectionLevelSelector - Interactive toggle for protection levels
 *
 * Allows users to switch between the four GuardianClaw protection levels:
 * - Off: GuardianClaw disabled
 * - Watch: Monitor only, no blocking
 * - Guard: Block critical threats
 * - Shield: Maximum protection
 *
 * Shows a detailed info panel below explaining what the selected level does.
 */
export function ProtectionLevelSelector({
  level,
  onChange,
  disabled = false,
  className,
}: ProtectionLevelSelectorProps) {
  const levels: ProtectionLevel[] = ['off', 'watch', 'guard', 'shield']

  return (
    <div className={cn('space-y-3', className)}>
      {/* Level buttons */}
      <div className="flex items-center justify-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/50 p-1">
        {levels.map((l) => (
          <LevelButton
            key={l}
            level={l}
            isSelected={l === level}
            isDisabled={disabled}
            onClick={() => !disabled && onChange(l)}
          />
        ))}
      </div>

      {/* Details panel */}
      <LevelDetails level={level} />
    </div>
  )
}

/**
 * ProtectionLevelSelectorCompact - Minimal version for tight spaces
 */
export function ProtectionLevelSelectorCompact({
  level,
  onChange,
  disabled = false,
  className,
}: ProtectionLevelSelectorProps) {
  const levels: ProtectionLevel[] = ['off', 'watch', 'guard', 'shield']

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 rounded-lg border border-zinc-800 bg-zinc-900/50 p-0.5',
        className
      )}
    >
      {levels.map((l) => {
        const config = protectionLevelConfig[l]
        const Icon = levelIcons[l]
        const isSelected = l === level

        return (
          <button
            key={l}
            onClick={() => !disabled && onChange(l)}
            disabled={disabled}
            className={cn(
              'relative rounded-md p-1.5 transition-all',
              isSelected && config.bgColor,
              !isSelected && 'hover:bg-zinc-800/50',
              disabled && 'cursor-not-allowed opacity-50'
            )}
            title={`${config.name}: ${config.description}`}
          >
            <Icon className={cn('h-4 w-4', isSelected ? config.color : 'text-zinc-500')} />
            {isSelected && (
              <motion.div
                className="absolute inset-0 rounded-md border"
                style={{
                  borderColor: config.color.replace('text-', '').replace('-500', '-500/50'),
                }}
                layoutId="compact-indicator"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

export default ProtectionLevelSelector
