'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DemoScenarioSelectorProps, DemoScenario } from './types'

/**
 * DemoScenarioSelector - Toggle buttons for Safe/Blocked scenarios
 *
 * Allows users to switch between demonstrating a safe, successful flow
 * and a blocked attack scenario.
 *
 * @example
 * ```tsx
 * <DemoScenarioSelector
 *   scenario={scenario}
 *   onScenarioChange={setScenario}
 *   disabled={isPlaying}
 *   safeLabel="Safe Transaction"
 *   blockedLabel="Blocked Attack"
 * />
 * ```
 */
export function DemoScenarioSelector({
  scenario,
  onScenarioChange,
  disabled = false,
  safeLabel = 'Safe Workflow',
  blockedLabel = 'Blocked Attack',
}: DemoScenarioSelectorProps) {
  return (
    <div
      className="mb-6 flex justify-center gap-4"
      role="group"
      aria-label="Demo scenario selection"
    >
      <ScenarioButton
        isSelected={scenario === 'safe'}
        onClick={() => onScenarioChange('safe')}
        disabled={disabled}
        variant="safe"
      >
        <CheckCircle2 className="mr-2 inline h-4 w-4" aria-hidden="true" />
        {safeLabel}
      </ScenarioButton>

      <ScenarioButton
        isSelected={scenario === 'blocked'}
        onClick={() => onScenarioChange('blocked')}
        disabled={disabled}
        variant="blocked"
      >
        <XCircle className="mr-2 inline h-4 w-4" aria-hidden="true" />
        {blockedLabel}
      </ScenarioButton>
    </div>
  )
}

/**
 * ScenarioButton - Individual scenario selection button
 */
function ScenarioButton({
  isSelected,
  onClick,
  disabled,
  variant,
  children,
}: {
  isSelected: boolean
  onClick: () => void
  disabled: boolean
  variant: 'safe' | 'blocked'
  children: React.ReactNode
}) {
  const selectedStyles = {
    safe: 'bg-green-500/20 text-green-500 border border-green-500/30',
    blocked: 'bg-red-500/20 text-red-500 border border-red-500/30',
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isSelected}
      className={cn(
        'rounded-lg px-4 py-2 text-sm font-medium transition-all',
        isSelected ? selectedStyles[variant] : 'bg-muted hover:bg-muted/80',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      {children}
    </button>
  )
}

/**
 * Extended scenario selector with custom options
 *
 * For demos that need more than two scenarios or custom labels/colors.
 *
 * @example
 * ```tsx
 * <DemoScenarioSelectorExtended
 *   scenarios={[
 *     { id: 'swap', label: 'Token Swap', icon: ArrowLeftRight },
 *     { id: 'transfer', label: 'Transfer', icon: Send },
 *     { id: 'attack', label: 'Malicious', icon: XCircle, variant: 'danger' },
 *   ]}
 *   selected="swap"
 *   onSelect={setScenario}
 *   disabled={isPlaying}
 * />
 * ```
 */
export function DemoScenarioSelectorExtended<T extends string>({
  scenarios,
  selected,
  onSelect,
  disabled = false,
}: {
  scenarios: {
    id: T
    label: string
    icon?: React.ComponentType<{ className?: string }>
    variant?: 'default' | 'success' | 'danger' | 'warning'
  }[]
  selected: T
  onSelect: (id: T) => void
  disabled?: boolean
}) {
  const variantStyles = {
    default: {
      selected: 'bg-claw-500/20 text-claw-500 border border-claw-500/30',
      unselected: 'bg-muted hover:bg-muted/80',
    },
    success: {
      selected: 'bg-green-500/20 text-green-500 border border-green-500/30',
      unselected: 'bg-muted hover:bg-muted/80',
    },
    danger: {
      selected: 'bg-red-500/20 text-red-500 border border-red-500/30',
      unselected: 'bg-muted hover:bg-muted/80',
    },
    warning: {
      selected: 'bg-amber-500/20 text-amber-500 border border-amber-500/30',
      unselected: 'bg-muted hover:bg-muted/80',
    },
  }

  return (
    <div
      className="mb-6 flex flex-wrap justify-center gap-3"
      role="group"
      aria-label="Demo scenario selection"
    >
      {scenarios.map((s) => {
        const variant = s.variant || 'default'
        const isSelected = selected === s.id
        const styles = variantStyles[variant]
        const Icon = s.icon

        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-all',
              isSelected ? styles.selected : styles.unselected,
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            {Icon && <Icon className="mr-2 inline h-4 w-4" aria-hidden="true" />}
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

export default DemoScenarioSelector
