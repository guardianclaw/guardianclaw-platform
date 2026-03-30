'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PropertyComponentProps } from '../properties-panel'

const processTypes = [
  { value: 'llm_call', label: 'LLM Call', description: 'Call an AI model' },
  { value: 'condition', label: 'Condition', description: 'Branch based on condition' },
]

const providers = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openrouter', label: 'OpenRouter' },
]

const models: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  anthropic: [
    { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
    { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  ],
  openrouter: [{ value: 'auto', label: 'Auto (Best available)' }],
}

export function ProcessProperties({ data, onChange }: PropertyComponentProps) {
  const config = (data.config as Record<string, unknown>) || {}
  const processType = (data.processType as string) || 'llm_call'
  const provider = (config.provider as string) || 'openai'

  const handleConfigChange = (key: string, value: unknown) => {
    onChange({
      ...data,
      config: { ...config, [key]: value },
    })
  }

  return (
    <div className="space-y-4">
      {/* Process Type */}
      <div className="space-y-2">
        <Label>Process Type</Label>
        <Select value={processType} onValueChange={(v) => onChange({ ...data, processType: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {processTypes.map((type) => (
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

      {/* LLM-specific properties */}
      {processType === 'llm_call' && (
        <>
          {/* Provider */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => handleConfigChange('provider', v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model */}
          <div className="space-y-2">
            <Label>Model</Label>
            <Select
              value={(config.model as string) || 'gpt-4o-mini'}
              onValueChange={(v) => handleConfigChange('model', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(models[provider] || []).map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <Label>System Prompt</Label>
            <Textarea
              value={(config.prompt as string) || ''}
              onChange={(e) => handleConfigChange('prompt', e.target.value)}
              placeholder="You are a helpful assistant..."
              rows={4}
            />
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <Label>Temperature: {((config.temperature as number) || 0.7).toFixed(1)}</Label>
            <Slider
              value={[(config.temperature as number) || 0.7]}
              onValueChange={([v]) => handleConfigChange('temperature', v)}
              min={0}
              max={2}
              step={0.1}
            />
            <p className="text-muted-foreground text-xs">Higher values make output more random</p>
          </div>

          {/* Max Tokens */}
          <div className="space-y-2">
            <Label>Max Tokens: {(config.maxTokens as number) || 1024}</Label>
            <Slider
              value={[(config.maxTokens as number) || 1024]}
              onValueChange={([v]) => handleConfigChange('maxTokens', v)}
              min={256}
              max={8192}
              step={256}
            />
          </div>
        </>
      )}

      {/* Condition-specific properties */}
      {processType === 'condition' && (
        <div className="space-y-2">
          <Label>Condition Expression</Label>
          <Textarea
            value={(config.conditionExpression as string) || ''}
            onChange={(e) => handleConfigChange('conditionExpression', e.target.value)}
            placeholder="input.length > 100"
            rows={3}
            className="font-mono text-sm"
          />
          <p className="text-muted-foreground text-xs">
            JavaScript expression that returns true or false
          </p>
        </div>
      )}
    </div>
  )
}
