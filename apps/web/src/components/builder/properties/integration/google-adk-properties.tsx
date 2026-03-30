'use client'

/**
 * Google ADK Integration Properties Panel
 *
 * Configuration panel for Google Agent Development Kit agents.
 * Allows users to configure:
 * - Seed level (minimal, standard, full)
 * - Validation behavior (inputs, outputs, tools)
 * - Fail mode (fail-open or fail-closed)
 * - Timeout and text size limits
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
import { Slider } from '@/components/ui/slider'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Zap,
  Clock,
  FileText,
  Settings,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import type { GoogleADKConfig, SeedLevel } from '@/types/integration'

interface GoogleADKPropertiesProps {
  subtype: string
  config: GoogleADKConfig | Record<string, unknown>
  onChange: (config: GoogleADKConfig) => void
}

// Seed level options
const SEED_LEVELS = [
  { value: 'minimal', label: 'Minimal', description: 'Essential safety only (~2K tokens)' },
  { value: 'standard', label: 'Standard', description: 'Balanced protection (Recommended)' },
  { value: 'full', label: 'Full', description: 'Maximum safety (~8K tokens)' },
]

export function GoogleADKProperties({ config, onChange }: GoogleADKPropertiesProps) {
  // State for collapsible sections
  const [showValidation, setShowValidation] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Extract values with defaults
  const seedLevel = (config.seed_level as string) || 'standard'
  const blockOnFailure = config.block_on_failure !== false
  const failClosed = config.fail_closed === true
  const validateInputs = config.validate_inputs !== false
  const validateOutputs = config.validate_outputs !== false
  const validateTools = config.validate_tools !== false
  const maxTextSize = (config.max_text_size as number) || 100000
  const validationTimeout = (config.validation_timeout as number) || 5.0
  const logViolations = config.log_violations !== false
  const blockedMessage =
    (config.blocked_message as string) || 'Request blocked by safety validation.'

  // Update helper
  const updateConfig = useCallback(
    (updates: Partial<GoogleADKConfig>) => {
      onChange({
        ...config,
        ...updates,
      } as GoogleADKConfig)
    },
    [config, onChange]
  )

  return (
    <div className="space-y-6">
      {/* Framework Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-xs">
          <Zap className="mr-1 h-3 w-3" />
          Google ADK
        </Badge>
        <span className="text-muted-foreground text-xs">Integration</span>
      </div>

      {/* Seed Level */}
      <div className="space-y-2">
        <Label htmlFor="seed-level" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Seed Level
        </Label>
        <Select
          value={seedLevel}
          onValueChange={(value) => updateConfig({ seed_level: value as SeedLevel })}
        >
          <SelectTrigger id="seed-level">
            <SelectValue placeholder="Select seed level" />
          </SelectTrigger>
          <SelectContent>
            {SEED_LEVELS.map((level) => (
              <SelectItem key={level.value} value={level.value}>
                <div className="flex flex-col">
                  <span>{level.label}</span>
                  <span className="text-muted-foreground text-xs">{level.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Determines the limits of safety instructions injected into prompts
        </p>
      </div>

      {/* Validation Options */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowValidation(!showValidation)}
          className="hover:text-foreground/80 flex items-center gap-2 text-sm font-medium"
        >
          {showValidation ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <CheckCircle className="h-4 w-4" />
          Validation Points
        </button>

        {showValidation && (
          <div className="bg-muted/50 space-y-4 rounded-lg p-4 pl-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="validate-inputs" className="text-sm">
                  Validate Inputs
                </Label>
                <p className="text-muted-foreground text-xs">
                  Check user inputs before model processing
                </p>
              </div>
              <Switch
                id="validate-inputs"
                checked={validateInputs}
                onCheckedChange={(checked) => updateConfig({ validate_inputs: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="validate-outputs" className="text-sm">
                  Validate Outputs
                </Label>
                <p className="text-muted-foreground text-xs">
                  Check model responses before returning
                </p>
              </div>
              <Switch
                id="validate-outputs"
                checked={validateOutputs}
                onCheckedChange={(checked) => updateConfig({ validate_outputs: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="validate-tools" className="text-sm">
                  Validate Tools
                </Label>
                <p className="text-muted-foreground text-xs">
                  Check tool calls before and after execution
                </p>
              </div>
              <Switch
                id="validate-tools"
                checked={validateTools}
                onCheckedChange={(checked) => updateConfig({ validate_tools: checked })}
              />
            </div>
          </div>
        )}
      </div>

      {/* Behavior Settings */}
      <div className="space-y-4">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <Settings className="h-4 w-4" />
          Behavior
        </h4>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="block-on-failure" className="text-sm">
              Block on Violation
            </Label>
            <p className="text-muted-foreground text-xs">Block requests that fail validation</p>
          </div>
          <Switch
            id="block-on-failure"
            checked={blockOnFailure}
            onCheckedChange={(checked) => updateConfig({ block_on_failure: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="fail-closed" className="flex items-center gap-2 text-sm">
              <XCircle className="h-3 w-3 text-red-500" />
              Fail Closed
            </Label>
            <p className="text-muted-foreground text-xs">
              Block on validation errors (vs fail-open)
            </p>
          </div>
          <Switch
            id="fail-closed"
            checked={failClosed}
            onCheckedChange={(checked) => updateConfig({ fail_closed: checked })}
          />
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="hover:text-foreground/80 flex items-center gap-2 text-sm font-medium"
        >
          {showAdvanced ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="bg-muted/30 space-y-4 rounded-lg p-4 pl-6">
            {/* Validation Timeout */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm">
                <Clock className="h-3 w-3" />
                Validation Timeout: {validationTimeout}s
              </Label>
              <Slider
                value={[validationTimeout]}
                onValueChange={([value]) => updateConfig({ validation_timeout: value })}
                min={1}
                max={30}
                step={0.5}
                className="w-full"
              />
              <p className="text-muted-foreground text-xs">
                Maximum time allowed for validation (1-30 seconds)
              </p>
            </div>

            {/* Max Text Size */}
            <div className="space-y-2">
              <Label htmlFor="max-text-size" className="flex items-center gap-2 text-sm">
                <FileText className="h-3 w-3" />
                Max Text Size
              </Label>
              <Input
                id="max-text-size"
                type="number"
                min={1000}
                max={1000000}
                value={maxTextSize}
                onChange={(e) =>
                  updateConfig({ max_text_size: parseInt(e.target.value) || 100000 })
                }
              />
              <p className="text-muted-foreground text-xs">
                Maximum characters to validate (default: 100,000)
              </p>
            </div>

            {/* Blocked Message */}
            <div className="space-y-2">
              <Label htmlFor="blocked-message" className="text-sm">
                Blocked Message
              </Label>
              <Input
                id="blocked-message"
                value={blockedMessage}
                onChange={(e) => updateConfig({ blocked_message: e.target.value })}
                placeholder="Message shown when request is blocked"
              />
              <p className="text-muted-foreground text-xs">
                Message returned when a request is blocked
              </p>
            </div>

            {/* Log Violations */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="log-violations" className="text-sm">
                  Log Violations
                </Label>
                <p className="text-muted-foreground text-xs">
                  Record all validation failures for audit
                </p>
              </div>
              <Switch
                id="log-violations"
                checked={logViolations}
                onCheckedChange={(checked) => updateConfig({ log_violations: checked })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
