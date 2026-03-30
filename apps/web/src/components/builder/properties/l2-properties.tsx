'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Sparkles, Info } from 'lucide-react'
import type { PropertyComponentProps } from '../properties-panel'
import type { L2Config } from '@/stores'

// Seed level descriptions
const seedLevels = [
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Basic safety (~500 chars)',
    details: 'Core safety principles only. Suitable for low-risk applications.',
  },
  {
    value: 'standard',
    label: 'Standard (Recommended)',
    description: 'CLAW principles (~2KB)',
    details: 'Full CLAW protocol with Credibility, Avoidance, Limits, and Worth gates.',
  },
  {
    value: 'full',
    label: 'Full',
    description: 'Complete alignment (~5KB)',
    details: 'Comprehensive alignment seed with anti-self-preservation and fiduciary principles.',
  },
] as const

// Default L2 configuration
const defaultL2Config: L2Config = {
  seedLevel: 'standard',
  customSeed: '',
  appendMode: true,
}

export function L2Properties({ data, onChange }: PropertyComponentProps) {
  const l2Config: L2Config = (data.l2Config as L2Config) || defaultL2Config

  const updateConfig = (updates: Partial<L2Config>) => {
    onChange({
      ...data,
      l2Config: { ...l2Config, ...updates },
    })
  }

  const selectedLevel = seedLevels.find((l) => l.value === l2Config.seedLevel) || seedLevels[1]

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/50">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
          <div>
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              L2: Seed Injection
            </p>
            <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">
              Injects alignment prompt into the system message to guide safe AI behavior.
            </p>
          </div>
        </div>
      </div>

      {/* Seed Level Selection */}
      <div className="space-y-2">
        <Label>Seed Level</Label>
        <Select
          value={l2Config.seedLevel}
          onValueChange={(value) => updateConfig({ seedLevel: value as L2Config['seedLevel'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {seedLevels.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                <div className="py-1">
                  <div className="font-medium">{level.label}</div>
                  <div className="text-muted-foreground text-xs">{level.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Selected level details */}
        <div className="bg-muted/50 flex items-start gap-2 rounded p-2">
          <Info className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
          <p className="text-muted-foreground text-xs">{selectedLevel.details}</p>
        </div>
      </div>

      {/* Append Mode Toggle */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-0.5">
          <Label>Append Mode</Label>
          <p className="text-muted-foreground text-xs">
            Append seed to existing system prompt instead of replacing
          </p>
        </div>
        <Switch
          checked={l2Config.appendMode}
          onCheckedChange={(checked) => updateConfig({ appendMode: checked })}
        />
      </div>

      {/* Custom Seed Additions */}
      <div className="space-y-2">
        <Label>Custom Additions (Optional)</Label>
        <Textarea
          value={l2Config.customSeed || ''}
          onChange={(e) => updateConfig({ customSeed: e.target.value })}
          placeholder="Add domain-specific safety instructions here...

Example:
- Never discuss competitor products
- Always recommend consulting a professional
- Decline requests related to [specific topic]"
          rows={6}
          className="resize-none font-mono text-xs"
        />
        <p className="text-muted-foreground text-xs">
          Custom text is appended after the selected seed level. Use this for domain-specific rules.
        </p>
      </div>

      {/* Seed Preview Indicator */}
      <div className="bg-muted/30 rounded-lg border p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Estimated seed size:</span>
          <span className="font-mono">
            {l2Config.seedLevel === 'minimal' && '~500 chars'}
            {l2Config.seedLevel === 'standard' && '~2KB'}
            {l2Config.seedLevel === 'full' && '~5KB'}
            {l2Config.customSeed && ` + ${l2Config.customSeed.length} chars`}
          </span>
        </div>
      </div>
    </div>
  )
}
