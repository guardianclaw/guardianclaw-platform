'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Eye, AlertTriangle, Info, Zap } from 'lucide-react'
import type { PropertyComponentProps } from '../properties-panel'
import type { L4Config } from '@/stores'

// LLM Provider options
const llmProviders = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo'] },
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229'],
  },
  { value: 'openrouter', label: 'OpenRouter', models: ['meta-llama/llama-3-8b-instruct'] },
] as const

// Fallback policy descriptions
// Note: SDK uses "L2" to refer to Gate 2, which is the L3 OutputValidator layer
const fallbackPolicies = [
  {
    value: 'BLOCK',
    label: 'BLOCK',
    description: 'Always block if L4 analysis fails or times out',
    severity: 'high',
  },
  {
    value: 'ALLOW_IF_L2_PASSED',
    label: 'ALLOW_IF_L2_PASSED',
    description: 'Allow if Gate 2 (L3 OutputValidator) passed (Recommended)',
    severity: 'medium',
  },
  {
    value: 'ALLOW',
    label: 'ALLOW',
    description: 'Always allow through (minimum security)',
    severity: 'low',
  },
] as const

// Default L4 configuration
const defaultL4Config: L4Config = {
  enabled: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  fallbackPolicy: 'ALLOW_IF_L2_PASSED',
  maxRetries: 2,
  retryDelayMs: 1000,
}

export function L4Properties({ data, onChange }: PropertyComponentProps) {
  const l4Config: L4Config = (data.l4Config as L4Config) || defaultL4Config

  const updateConfig = (updates: Partial<L4Config>) => {
    onChange({
      ...data,
      l4Config: { ...l4Config, ...updates },
    })
  }

  const selectedProvider =
    llmProviders.find((p) => p.value === l4Config.provider) || llmProviders[0]
  const selectedPolicy =
    fallbackPolicies.find((p) => p.value === l4Config.fallbackPolicy) || fallbackPolicies[1]

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/50">
        <div className="flex items-start gap-3">
          <Eye className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
              L4: GuardianClaw Observer
            </p>
            <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
              LLM-based transcript analysis for nuanced safety evaluation beyond patterns.
            </p>
          </div>
        </div>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label className="text-sm">Enable L4 Analysis</Label>
          <p className="text-muted-foreground text-xs">Uses LLM API (adds latency and cost)</p>
        </div>
        <Switch
          checked={l4Config.enabled}
          onCheckedChange={(checked) => updateConfig({ enabled: checked })}
        />
      </div>

      {/* Configuration options (only shown when enabled) */}
      {l4Config.enabled ? (
        <>
          {/* LLM Provider Selection */}
          <div className="space-y-2">
            <Label>LLM Provider</Label>
            <Select
              value={l4Config.provider}
              onValueChange={(value) => updateConfig({ provider: value as L4Config['provider'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {llmProviders.map((provider) => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={l4Config.model}
              onValueChange={(value) => updateConfig({ model: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectedProvider.models.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Or enter a custom model name below</p>
            <Input
              value={l4Config.model}
              onChange={(e) => updateConfig({ model: e.target.value })}
              placeholder="Custom model name..."
              className="font-mono text-xs"
            />
          </div>

          {/* Fallback Policy */}
          <div className="space-y-2">
            <Label>Fallback Policy</Label>
            <Select
              value={l4Config.fallbackPolicy}
              onValueChange={(value) =>
                updateConfig({ fallbackPolicy: value as L4Config['fallbackPolicy'] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fallbackPolicies.map((policy) => (
                  <SelectItem key={policy.value} value={policy.value}>
                    <div className="py-1">
                      <div className="font-medium">{policy.label}</div>
                      <div className="text-muted-foreground text-xs">{policy.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Policy explanation */}
            <div className="bg-muted/50 flex items-start gap-2 rounded p-2">
              <Info className="text-muted-foreground mt-0.5 h-4 w-4 flex-shrink-0" />
              <p className="text-muted-foreground text-xs">
                {selectedPolicy.description}. Used when L4 LLM call fails, times out, or returns an
                error.
              </p>
            </div>
          </div>

          {/* Retry Configuration */}
          <div className="space-y-3">
            <Label>Retry Configuration</Label>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs">Max Retries</label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  value={l4Config.maxRetries}
                  onChange={(e) => updateConfig({ maxRetries: parseInt(e.target.value) || 0 })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground text-xs">Retry Delay (ms)</label>
                <Input
                  type="number"
                  min={100}
                  max={10000}
                  step={100}
                  value={l4Config.retryDelayMs}
                  onChange={(e) => updateConfig({ retryDelayMs: parseInt(e.target.value) || 1000 })}
                  className="font-mono"
                />
              </div>
            </div>
          </div>

          {/* Cost & Latency Warning */}
          <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
                Performance Impact
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                L4 analysis adds ~1-3s latency and ~$0.0005 per validation call. Consider using
                ALLOW_IF_L3_PASSED fallback for better UX.
              </p>
            </div>
          </div>
        </>
      ) : (
        /* Disabled state message */
        <div className="rounded-lg border border-dashed p-4 text-center">
          <Zap className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            L4 analysis is disabled. Validation will rely on L1-L3 layers only.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Enable for nuanced LLM-based safety checks.
          </p>
        </div>
      )}
    </div>
  )
}
