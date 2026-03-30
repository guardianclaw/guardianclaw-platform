'use client'

/**
 * OpenAI Agents SDK Integration Properties Panel
 *
 * Configuration panel for OpenAI Agents SDK-based agents.
 * Allows users to configure:
 * - Guardrail model selection
 * - Gate requirements (all gates vs avoidance-only)
 * - Heuristic/semantic validation layers
 * - Timeout and error handling
 */

import { useState, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Shield, Zap, Clock, AlertTriangle } from 'lucide-react'
import type { OpenAIAgentsConfig } from '@/types/integration'

interface OpenAIAgentsPropertiesProps {
  subtype: string
  config: OpenAIAgentsConfig | Record<string, unknown>
  onChange: (config: OpenAIAgentsConfig) => void
}

// Guardrail model options
const GUARDRAIL_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Fast, cost-effective (Recommended)' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Most capable, higher cost' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Balanced performance' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fastest, lowest cost' },
]

export function OpenAIAgentsProperties({ config, onChange }: OpenAIAgentsPropertiesProps) {
  // Extract values with defaults
  const guardrailModel = (config.guardrail_model as string) || 'gpt-4o-mini'
  const requireAllGates = config.require_all_gates !== false
  const skipSemanticIfHeuristic = config.skip_semantic_if_heuristic !== false
  const validationTimeoutMs = (config.validation_timeout_ms as number) || 30000
  const blockOnViolation = config.block_on_violation !== false
  const logViolations = config.log_validations !== false
  const failOpen = config.fail_open === true
  const useHeuristic = config.use_heuristic !== false

  // Update helper that merges with existing config
  const updateConfig = useCallback(
    (updates: Partial<OpenAIAgentsConfig>) => {
      onChange({
        ...config,
        ...updates,
      } as OpenAIAgentsConfig)
    },
    [config, onChange]
  )

  return (
    <div className="space-y-6">
      {/* Framework Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-xs">
          OpenAI Agents SDK
        </Badge>
        <span className="text-muted-foreground text-xs">Integration</span>
      </div>

      {/* Guardrail Model */}
      <div className="space-y-2">
        <Label htmlFor="guardrail-model">Guardrail Model</Label>
        <Select
          value={guardrailModel}
          onValueChange={(value) => updateConfig({ guardrail_model: value })}
        >
          <SelectTrigger id="guardrail-model">
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent>
            {GUARDRAIL_MODELS.map((model) => (
              <SelectItem key={model.value} value={model.value}>
                <div className="flex flex-col">
                  <span>{model.label}</span>
                  <span className="text-muted-foreground text-xs">{model.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">Model used for semantic CLAW validation</p>
      </div>

      {/* Gate Requirements */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="require-all-gates">Require All Gates</Label>
            <p className="text-muted-foreground text-xs">All CLAW gates must pass (recommended)</p>
          </div>
          <Switch
            id="require-all-gates"
            checked={requireAllGates}
            onCheckedChange={(checked) => updateConfig({ require_all_gates: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="block-on-violation">Block on Violation</Label>
            <p className="text-muted-foreground text-xs">Stop execution when validation fails</p>
          </div>
          <Switch
            id="block-on-violation"
            checked={blockOnViolation}
            onCheckedChange={(checked) => updateConfig({ block_on_violation: checked })}
          />
        </div>
      </div>

      {/* Validation Layers */}
      <CollapsibleSection title="Validation Layers">
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="use-heuristic" className="flex items-center gap-2">
                <Zap className="h-3 w-3" />
                Heuristic Layer
              </Label>
              <p className="text-muted-foreground text-xs">
                Fast pattern matching (580+ patterns, {'<'}10ms)
              </p>
            </div>
            <Switch
              id="use-heuristic"
              checked={useHeuristic}
              onCheckedChange={(checked) => updateConfig({ use_heuristic: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="skip-semantic" className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                Skip Semantic if Heuristic Blocks
              </Label>
              <p className="text-muted-foreground text-xs">
                Save API cost when patterns catch violations
              </p>
            </div>
            <Switch
              id="skip-semantic"
              checked={skipSemanticIfHeuristic}
              onCheckedChange={(checked) => updateConfig({ skip_semantic_if_heuristic: checked })}
            />
          </div>
        </div>
      </CollapsibleSection>

      {/* Advanced Settings */}
      <CollapsibleSection title="Advanced Settings">
        <div className="space-y-4 pt-2">
          {/* Timeout */}
          <div className="space-y-2">
            <Label htmlFor="validation-timeout" className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              Validation Timeout (ms)
            </Label>
            <Input
              id="validation-timeout"
              type="number"
              value={validationTimeoutMs}
              onChange={(e) =>
                updateConfig({ validation_timeout_ms: parseInt(e.target.value, 10) || 30000 })
              }
              min={1000}
              max={120000}
              step={1000}
            />
            <p className="text-muted-foreground text-xs">
              Max time for LLM validation (1-120 seconds)
            </p>
          </div>

          {/* Log Violations */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="log-violations">Log Violations</Label>
              <p className="text-muted-foreground text-xs">Record violations for debugging</p>
            </div>
            <Switch
              id="log-violations"
              checked={logViolations}
              onCheckedChange={(checked) => updateConfig({ log_validations: checked })}
            />
          </div>

          {/* Fail Open */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="fail-open" className="flex items-center gap-2">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Fail Open
              </Label>
              <p className="text-muted-foreground text-xs">
                Allow on validation error (less secure)
              </p>
            </div>
            <Switch
              id="fail-open"
              checked={failOpen}
              onCheckedChange={(checked) => updateConfig({ fail_open: checked })}
            />
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}

// Simple collapsible section component
function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-t pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="hover:text-foreground/80 flex w-full items-center justify-between py-2 text-sm font-medium"
      >
        {title}
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  )
}
