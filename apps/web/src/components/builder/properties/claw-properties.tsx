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
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import type { PropertyComponentProps } from '../properties-panel'
import type { GuardianClawLayerType } from '@/stores'

// Import layer-specific property components
import { L1Properties } from './l1-properties'
import { L2Properties } from './l2-properties'
import { L3Properties } from './l3-properties'
import { L4Properties } from './l4-properties'

// =============================================================================
// Layer Type Detection
// =============================================================================

const layerTypes: GuardianClawLayerType[] = [
  'input_validator',
  'seed_injection',
  'output_validator',
  'observer',
]

function isLayerNode(data: Record<string, unknown>): boolean {
  return (
    typeof data.layerType === 'string' &&
    layerTypes.includes(data.layerType as GuardianClawLayerType)
  )
}

// =============================================================================
// Main Dispatcher Component
// =============================================================================

export function GuardianClawProperties({ data, onChange }: PropertyComponentProps) {
  // Check if this is a v2.25 layer node
  if (isLayerNode(data)) {
    const layerType = data.layerType as GuardianClawLayerType

    switch (layerType) {
      case 'input_validator':
        return <L1Properties data={data} onChange={onChange} />
      case 'seed_injection':
        return <L2Properties data={data} onChange={onChange} />
      case 'output_validator':
        return <L3Properties data={data} onChange={onChange} />
      case 'observer':
        return <L4Properties data={data} onChange={onChange} />
    }
  }

  // Fallback to legacy gate properties
  return <LegacyGateProperties data={data} onChange={onChange} />
}

// =============================================================================
// Legacy Gate Properties (v2.18 compatibility)
// =============================================================================

const gateTypes = [
  {
    value: 'all',
    label: 'All Gates (CLAW)',
    description: 'Apply all four gates',
    gates: ['credibility', 'avoidance', 'limits', 'worth'],
  },
  {
    value: 'credibility',
    label: 'Credibility Gate',
    description: 'Verify factual accuracy',
    gates: ['credibility'],
  },
  {
    value: 'avoidance',
    label: 'Avoidance Gate',
    description: 'Check for harmful content',
    gates: ['avoidance'],
  },
  {
    value: 'limits',
    label: 'Limits Gate',
    description: 'Verify appropriate boundaries',
    gates: ['limits'],
  },
  {
    value: 'worth',
    label: 'Worth Gate',
    description: 'Require beneficial purpose',
    gates: ['worth'],
  },
]

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function LegacySwitch({ checked, onCheckedChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={`focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 ${checked ? 'bg-claw-600' : 'bg-input'} `}
    >
      <span
        className={`bg-background pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'} `}
      />
    </button>
  )
}

function LegacyGateProperties({ data, onChange }: PropertyComponentProps) {
  const config = (data.config as Record<string, unknown>) || {}
  const gateType = (data.gateType as string) || 'all'
  const enabled = (config.enabled as boolean) !== false
  const strictMode = (config.strictMode as boolean) || false

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: { ...config, [key]: value },
    })
  }

  const selectedGate = gateTypes.find((g) => g.value === gateType)

  return (
    <div className="space-y-4">
      {/* Legacy Notice */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-950/50">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
          <div>
            <p className="text-xs font-medium text-yellow-900 dark:text-yellow-100">
              Legacy Gate (v2.18)
            </p>
            <p className="mt-0.5 text-xs text-yellow-700 dark:text-yellow-300">
              Consider using the new L1-L4 layer architecture for better control.
            </p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-claw-50 border-claw-200 rounded-lg border p-3 dark:border-green-800 dark:bg-green-950/50">
        <div className="flex items-start gap-2">
          <Shield className="text-claw-600 mt-0.5 h-5 w-5 dark:text-green-400" />
          <div>
            <p className="text-claw-900 text-sm font-medium dark:text-green-100">
              GuardianClaw Protection
            </p>
            <p className="text-claw-700 mt-1 text-xs dark:text-green-300">
              CLAW Protocol validates content through Credibility, Avoidance, Limits, and Worth
              gates.
            </p>
          </div>
        </div>
      </div>

      {/* Gate Type */}
      <div className="space-y-2">
        <Label>Gate Type</Label>
        <Select value={gateType} onValueChange={(v) => onChange({ ...data, gateType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {gateTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                <div>
                  <div className="font-medium">{type.label}</div>
                  <div className="text-muted-foreground text-xs">{type.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Validation Stage */}
      <div className="space-y-2">
        <Label>Validation Stage</Label>
        <Select
          value={(config.validationStage as string) || 'auto'}
          onValueChange={(v) => handleConfigChange('validationStage', v === 'auto' ? undefined : v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <div>
                <div className="font-medium">Auto-detect</div>
                <div className="text-muted-foreground text-xs">
                  Based on position relative to LLM
                </div>
              </div>
            </SelectItem>
            <SelectItem value="input">
              <div>
                <div className="font-medium">Input Validation</div>
                <div className="text-muted-foreground text-xs">
                  Validate user input before processing
                </div>
              </div>
            </SelectItem>
            <SelectItem value="output">
              <div>
                <div className="font-medium">Output Validation</div>
                <div className="text-muted-foreground text-xs">
                  Validate AI response before sending
                </div>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Auto-detect uses position in flow: before LLM = input, after LLM = output
        </p>
      </div>

      {/* Active Gates */}
      {selectedGate && (
        <div className="space-y-2">
          <Label>Active Gates</Label>
          <div className="flex flex-wrap gap-2">
            {['credibility', 'avoidance', 'limits', 'worth'].map((gate) => {
              const isActive = selectedGate.gates.includes(gate)
              return (
                <Badge
                  key={gate}
                  variant={isActive ? 'default' : 'outline'}
                  className={isActive ? 'bg-claw-600' : 'opacity-50'}
                >
                  {gate.charAt(0).toUpperCase() + gate.slice(1)}
                </Badge>
              )
            })}
          </div>
        </div>
      )}

      {/* Enabled Toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <Label>Enabled</Label>
          <p className="text-muted-foreground text-xs">Activate this gate in the flow</p>
        </div>
        <LegacySwitch
          checked={enabled}
          onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
        />
      </div>

      {/* Strict Mode Toggle */}
      <div className="flex items-center justify-between py-2">
        <div>
          <Label>Strict Mode</Label>
          <p className="text-muted-foreground text-xs">Block on any uncertainty</p>
        </div>
        <LegacySwitch
          checked={strictMode}
          onCheckedChange={(checked) => handleConfigChange('strictMode', checked)}
        />
      </div>

      {/* Status Indicator */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center gap-2">
          {enabled ? (
            <>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Protection Active
              </span>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                Protection Disabled
              </span>
            </>
          )}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          {enabled
            ? `Validating through ${selectedGate?.gates.length || 0} gate(s)`
            : 'Content will pass without validation'}
        </p>
      </div>
    </div>
  )
}
