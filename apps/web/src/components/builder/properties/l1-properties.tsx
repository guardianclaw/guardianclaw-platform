'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { ShieldCheck } from 'lucide-react'
import type { PropertyComponentProps } from '../properties-panel'
import type { L1Config } from '@/stores'

// Detector definitions with descriptions
const detectors = [
  {
    id: 'pattern',
    label: 'Pattern Detector',
    description: '700+ attack patterns',
    defaultEnabled: true,
  },
  {
    id: 'escalation',
    label: 'Escalation Detector',
    description: 'Multi-turn attacks (Crescendo, MHJ)',
    defaultEnabled: true,
  },
  {
    id: 'framing',
    label: 'Framing Detector',
    description: 'Roleplay/fiction bypass attempts',
    defaultEnabled: true,
  },
  {
    id: 'harmful_request',
    label: 'Harmful Request',
    description: '10 avoidance categories detection',
    defaultEnabled: true,
  },
  {
    id: 'intent_signal',
    label: 'Intent Signal',
    description: 'Compositional intent analysis',
    defaultEnabled: false,
  },
  {
    id: 'safe_agent',
    label: 'Safe Agent',
    description: 'Embodied AI safety checks',
    defaultEnabled: false,
  },
  {
    id: 'embedding',
    label: 'Embedding Detector',
    description: 'Semantic similarity (requires API key)',
    defaultEnabled: false,
  },
  {
    id: 'benign_context',
    label: 'Benign Context',
    description: 'False positive reduction for legitimate contexts',
    defaultEnabled: true,
  },
] as const

// Default L1 configuration
const defaultL1Config: L1Config = {
  mode: 'moderate',
  enabledDetectors: {
    pattern: true,
    escalation: true,
    framing: true,
    harmful_request: true,
    intent_signal: false,
    safe_agent: false,
    embedding: false,
    benign_context: true,
  },
  threshold: 70,
}

export function L1Properties({ data, onChange }: PropertyComponentProps) {
  const l1Config: L1Config = (data.l1Config as L1Config) || defaultL1Config

  const updateConfig = (updates: Partial<L1Config>) => {
    onChange({
      ...data,
      l1Config: { ...l1Config, ...updates },
    })
  }

  const toggleDetector = (detectorId: string) => {
    const currentDetectors = l1Config.enabledDetectors || defaultL1Config.enabledDetectors
    updateConfig({
      enabledDetectors: {
        ...currentDetectors,
        [detectorId]: !currentDetectors[detectorId as keyof typeof currentDetectors],
      },
    })
  }

  const activeDetectorCount = Object.values(l1Config.enabledDetectors || {}).filter(Boolean).length

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/50">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
          <div>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
              L1: Input Validator
            </p>
            <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
              Pre-AI detection with 700+ patterns. Validates input before it reaches the LLM.
            </p>
          </div>
        </div>
      </div>

      {/* Detection Mode */}
      <div className="space-y-2">
        <Label>Detection Mode</Label>
        <Select
          value={l1Config.mode}
          onValueChange={(value) => updateConfig({ mode: value as L1Config['mode'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="strict">
              <div className="py-1">
                <div className="font-medium">Strict</div>
                <div className="text-muted-foreground text-xs">Block all suspicious content</div>
              </div>
            </SelectItem>
            <SelectItem value="moderate">
              <div className="py-1">
                <div className="font-medium">Moderate (Recommended)</div>
                <div className="text-muted-foreground text-xs">
                  Balanced detection with fewer false positives
                </div>
              </div>
            </SelectItem>
            <SelectItem value="lenient">
              <div className="py-1">
                <div className="font-medium">Lenient</div>
                <div className="text-muted-foreground text-xs">
                  Allow more content through, only block clear threats
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Detection Threshold */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Detection Threshold</Label>
          <span className="text-muted-foreground font-mono text-sm">{l1Config.threshold}%</span>
        </div>
        <Slider
          value={[l1Config.threshold]}
          onValueChange={([value]) => updateConfig({ threshold: value })}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
        <p className="text-muted-foreground text-xs">
          Lower values are more sensitive (more blocks), higher values reduce false positives.
        </p>
      </div>

      {/* Active Detectors */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Active Detectors</Label>
          <Badge variant="secondary" className="text-xs">
            {activeDetectorCount}/{detectors.length} active
          </Badge>
        </div>

        <div className="space-y-2">
          {detectors.map((detector) => {
            const isEnabled =
              l1Config.enabledDetectors?.[detector.id as keyof L1Config['enabledDetectors']] ??
              detector.defaultEnabled

            return (
              <button
                key={detector.id}
                type="button"
                onClick={() => toggleDetector(detector.id)}
                className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                  isEnabled
                    ? 'border-blue-500/50 bg-blue-500/5 dark:bg-blue-500/10'
                    : 'bg-muted/30 border-transparent opacity-60 hover:opacity-80'
                } `}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <p className="text-sm font-medium">{detector.label}</p>
                  <p className="text-muted-foreground truncate text-xs">{detector.description}</p>
                </div>
                <Badge
                  variant={isEnabled ? 'default' : 'outline'}
                  className={isEnabled ? 'bg-blue-600' : ''}
                >
                  {isEnabled ? 'ON' : 'OFF'}
                </Badge>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
