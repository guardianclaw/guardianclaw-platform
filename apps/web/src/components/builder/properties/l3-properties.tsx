'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ShieldAlert } from 'lucide-react'
import type { PropertyComponentProps } from '../properties-panel'
import type { L3Config } from '@/stores'
import { cn } from '@/lib/utils'

// CLAW Gate definitions
const clawGates = [
  {
    id: 'credibility',
    label: 'Credibility',
    letter: 'T',
    color: 'bg-cyan-500',
    borderColor: 'border-cyan-500',
    textColor: 'text-cyan-400',
    description: 'Verify factual accuracy and prevent hallucinations',
  },
  {
    id: 'avoidance',
    label: 'Avoidance',
    letter: 'H',
    color: 'bg-red-500',
    borderColor: 'border-red-500',
    textColor: 'text-red-400',
    description: 'Detect harmful, dangerous, or illegal content',
  },
  {
    id: 'limits',
    label: 'Limits',
    letter: 'S',
    color: 'bg-amber-500',
    borderColor: 'border-amber-500',
    textColor: 'text-amber-400',
    description: 'Enforce appropriate boundaries and limits',
  },
  {
    id: 'worth',
    label: 'Worth',
    letter: 'P',
    color: 'bg-violet-500',
    borderColor: 'border-violet-500',
    textColor: 'text-violet-400',
    description: 'Require genuine beneficial purpose for actions',
  },
] as const

// Default L3 configuration
const defaultL3Config: L3Config = {
  mode: 'moderate',
  enabledGates: {
    credibility: true,
    avoidance: true,
    limits: true,
    worth: true,
  },
}

export function L3Properties({ data, onChange }: PropertyComponentProps) {
  const l3Config: L3Config = (data.l3Config as L3Config) || defaultL3Config

  const updateConfig = (updates: Partial<L3Config>) => {
    onChange({
      ...data,
      l3Config: { ...l3Config, ...updates },
    })
  }

  const toggleGate = (gateId: string) => {
    const currentGates = l3Config.enabledGates || defaultL3Config.enabledGates
    updateConfig({
      enabledGates: {
        ...currentGates,
        [gateId]: !currentGates[gateId as keyof typeof currentGates],
      },
    })
  }

  const activeGateCount = Object.values(l3Config.enabledGates || {}).filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              L3: Output Validator
            </p>
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              Post-AI heuristic validation using CLAW gates. Fast pattern-based checking.
            </p>
          </div>
        </div>
      </div>

      {/* Validation Mode */}
      <div className="space-y-2">
        <Label>Validation Mode</Label>
        <Select
          value={l3Config.mode}
          onValueChange={(value) => updateConfig({ mode: value as L3Config['mode'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="strict">
              <div className="py-1">
                <div className="font-medium">Strict</div>
                <div className="text-muted-foreground text-xs">Block on any pattern match</div>
              </div>
            </SelectItem>
            <SelectItem value="moderate">
              <div className="py-1">
                <div className="font-medium">Moderate (Recommended)</div>
                <div className="text-muted-foreground text-xs">
                  Score-based blocking with context awareness
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* CLAW Gates Visual Selector */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>CLAW Gates</Label>
          <Badge variant="secondary" className="text-xs">
            {activeGateCount}/4 active
          </Badge>
        </div>

        {/* Visual gate indicators */}
        <div className="bg-muted/30 flex items-center justify-center gap-2 rounded-lg p-3">
          {clawGates.map((gate) => {
            const isEnabled =
              l3Config.enabledGates?.[gate.id as keyof L3Config['enabledGates']] ?? true

            return (
              <button
                key={gate.id}
                type="button"
                onClick={() => toggleGate(gate.id)}
                className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold transition-all',
                  isEnabled
                    ? cn(gate.color, 'scale-100 text-white shadow-lg')
                    : 'scale-95 bg-zinc-800 text-zinc-600 hover:scale-100'
                )}
                title={`${gate.label} Gate: ${isEnabled ? 'Enabled' : 'Disabled'}`}
              >
                {gate.letter}
              </button>
            )
          })}
        </div>

        {/* Gate details list */}
        <div className="space-y-2">
          {clawGates.map((gate) => {
            const isEnabled =
              l3Config.enabledGates?.[gate.id as keyof L3Config['enabledGates']] ?? true

            return (
              <button
                key={gate.id}
                type="button"
                onClick={() => toggleGate(gate.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                  isEnabled
                    ? cn('bg-muted/30', gate.borderColor, 'border-opacity-50')
                    : 'bg-muted/10 border-transparent opacity-50 hover:opacity-70'
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold',
                    isEnabled ? cn(gate.color, 'text-white') : 'bg-zinc-700 text-zinc-500'
                  )}
                >
                  {gate.letter}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm font-medium', isEnabled && gate.textColor)}>
                    {gate.label} Gate
                  </p>
                  <p className="text-muted-foreground truncate text-xs">{gate.description}</p>
                </div>
                <Badge variant={isEnabled ? 'default' : 'outline'} className="flex-shrink-0">
                  {isEnabled ? 'ON' : 'OFF'}
                </Badge>
              </button>
            )
          })}
        </div>
      </div>

      {/* Warning when all gates disabled */}
      {activeGateCount === 0 && (
        <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
          <p className="text-xs text-yellow-600 dark:text-yellow-400">
            Warning: All gates are disabled. Output will not be validated.
          </p>
        </div>
      )}
    </div>
  )
}
