'use client'

/**
 * Virtuals Protocol (GAME SDK) Integration Properties Panel
 *
 * Configuration panel for AI agents built with the GAME framework.
 * Allows users to configure:
 * - Transaction limits and spending controls
 * - CLAW gate settings
 * - Memory integrity protection
 * - Fiduciary validation
 * - Blocked functions management
 */

import { useState, useCallback } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Gamepad2,
  DollarSign,
  Ban,
  Brain,
  Lock,
  Plus,
  X,
  AlertTriangle,
  Users,
} from 'lucide-react'
import type { VirtualsConfig } from '@/types/integration'

interface VirtualsPropertiesProps {
  subtype: string
  config: VirtualsConfig | Record<string, unknown>
  onChange: (config: VirtualsConfig) => void
}

// Default blocked functions
const DEFAULT_BLOCKED_FUNCTIONS = [
  'drain_wallet',
  'send_all_tokens',
  'approve_unlimited',
  'export_private_key',
  'reveal_seed_phrase',
]

// Default actions requiring worth
const DEFAULT_PURPOSE_ACTIONS = ['transfer', 'send', 'approve', 'swap', 'bridge', 'withdraw']

export function VirtualsProperties({ config, onChange }: VirtualsPropertiesProps) {
  // State for collapsible sections
  const [showTransactionLimits, setShowTransactionLimits] = useState(true)
  const [showBlockedFunctions, setShowBlockedFunctions] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [newBlockedFunction, setNewBlockedFunction] = useState('')

  // Extract values with defaults
  const blockUnsafe = config.block_unsafe !== false
  const logValidations = config.log_validations !== false
  const maxTransactionAmount = (config.max_transaction_amount as number) || 1000
  const requireConfirmationAbove = (config.require_confirmation_above as number) || 100
  const memoryIntegrityCheck = config.memory_integrity_check === true
  const fiduciaryEnabled = config.fiduciary_enabled !== false
  const strictFiduciary = config.strict_fiduciary === true
  const blockedFunctions = (config.blocked_functions as string[]) || DEFAULT_BLOCKED_FUNCTIONS
  const requirePurposeFor = (config.require_purpose_for as string[]) || DEFAULT_PURPOSE_ACTIONS

  // Update helper
  const updateConfig = useCallback(
    (updates: Partial<VirtualsConfig>) => {
      onChange({
        ...config,
        ...updates,
      } as VirtualsConfig)
    },
    [config, onChange]
  )

  // Add blocked function
  const addBlockedFunction = useCallback(() => {
    if (newBlockedFunction && !blockedFunctions.includes(newBlockedFunction)) {
      updateConfig({
        blocked_functions: [...blockedFunctions, newBlockedFunction],
      })
      setNewBlockedFunction('')
    }
  }, [newBlockedFunction, blockedFunctions, updateConfig])

  // Remove blocked function
  const removeBlockedFunction = useCallback(
    (functionName: string) => {
      updateConfig({
        blocked_functions: blockedFunctions.filter((f) => f !== functionName),
      })
    },
    [blockedFunctions, updateConfig]
  )

  return (
    <div className="space-y-6">
      {/* Framework Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-xs">
          <Gamepad2 className="mr-1 h-3 w-3" />
          Virtuals Protocol
        </Badge>
        <span className="text-muted-foreground text-xs">GAME SDK</span>
      </div>

      {/* Transaction Limits */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowTransactionLimits(!showTransactionLimits)}
          className="hover:text-foreground/80 flex items-center gap-2 text-sm font-medium"
        >
          {showTransactionLimits ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <DollarSign className="h-4 w-4" />
          Transaction Limits
        </button>

        {showTransactionLimits && (
          <div className="bg-muted/50 space-y-4 rounded-lg p-4 pl-6">
            {/* Max Transaction */}
            <div className="space-y-2">
              <Label className="text-sm">Maximum Transaction: ${maxTransactionAmount}</Label>
              <Slider
                value={[maxTransactionAmount]}
                onValueChange={([value]) => updateConfig({ max_transaction_amount: value })}
                min={10}
                max={10000}
                step={10}
                className="w-full"
              />
              <p className="text-muted-foreground text-xs">
                Maximum amount per transaction (blocks above this)
              </p>
            </div>

            {/* Confirmation Threshold */}
            <div className="space-y-2">
              <Label className="text-sm">Confirmation Above: ${requireConfirmationAbove}</Label>
              <Slider
                value={[requireConfirmationAbove]}
                onValueChange={([value]) => updateConfig({ require_confirmation_above: value })}
                min={1}
                max={1000}
                step={5}
                className="w-full"
              />
              <p className="text-muted-foreground text-xs">
                Require confirmation for transactions above this amount
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Security Toggles */}
      <div className="bg-muted/50 space-y-4 rounded-lg p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <Shield className="h-4 w-4" />
          Security Settings
        </h4>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="block-unsafe" className="text-sm">
              Block Unsafe Actions
            </Label>
            <p className="text-muted-foreground text-xs">Block actions that fail CLAW validation</p>
          </div>
          <Switch
            id="block-unsafe"
            checked={blockUnsafe}
            onCheckedChange={(checked) => updateConfig({ block_unsafe: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="fiduciary-enabled" className="flex items-center gap-2 text-sm">
              <Users className="h-3 w-3 text-blue-500" />
              Fiduciary Guard
            </Label>
            <p className="text-muted-foreground text-xs">
              Ensure actions serve user&apos;s best interest
            </p>
          </div>
          <Switch
            id="fiduciary-enabled"
            checked={fiduciaryEnabled}
            onCheckedChange={(checked) => updateConfig({ fiduciary_enabled: checked })}
          />
        </div>

        {fiduciaryEnabled && (
          <div className="flex items-center justify-between pl-6">
            <div className="space-y-0.5">
              <Label htmlFor="strict-fiduciary" className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-3 w-3 text-yellow-500" />
                Strict Mode
              </Label>
              <p className="text-muted-foreground text-xs">Block on any fiduciary violation</p>
            </div>
            <Switch
              id="strict-fiduciary"
              checked={strictFiduciary}
              onCheckedChange={(checked) => updateConfig({ strict_fiduciary: checked })}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="memory-integrity" className="flex items-center gap-2 text-sm">
              <Brain className="h-3 w-3 text-purple-500" />
              Memory Integrity
            </Label>
            <p className="text-muted-foreground text-xs">
              Cryptographic protection against memory injection
            </p>
          </div>
          <Switch
            id="memory-integrity"
            checked={memoryIntegrityCheck}
            onCheckedChange={(checked) => updateConfig({ memory_integrity_check: checked })}
          />
        </div>
      </div>

      {/* Blocked Functions */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowBlockedFunctions(!showBlockedFunctions)}
          className="hover:text-foreground/80 flex items-center gap-2 text-sm font-medium"
        >
          {showBlockedFunctions ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Ban className="h-4 w-4" />
          Blocked Functions ({blockedFunctions.length})
        </button>

        {showBlockedFunctions && (
          <div className="space-y-3 pl-6">
            {/* Add new function */}
            <div className="flex gap-2">
              <Input
                placeholder="function_name"
                value={newBlockedFunction}
                onChange={(e) => setNewBlockedFunction(e.target.value)}
                className="font-mono text-xs"
              />
              <Button
                type="button"
                size="sm"
                onClick={addBlockedFunction}
                disabled={!newBlockedFunction}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* List blocked functions */}
            {blockedFunctions.length === 0 ? (
              <p className="text-muted-foreground text-xs">No functions blocked</p>
            ) : (
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {blockedFunctions.map((fn) => (
                  <div
                    key={fn}
                    className="bg-muted/50 flex items-center justify-between rounded p-2 font-mono text-xs"
                  >
                    <span className="truncate">{fn}</span>
                    <button
                      type="button"
                      onClick={() => removeBlockedFunction(fn)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
            {/* Log Validations */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="log-validations" className="text-sm">
                  Log Validations
                </Label>
                <p className="text-muted-foreground text-xs">
                  Record all validation attempts for audit
                </p>
              </div>
              <Switch
                id="log-validations"
                checked={logValidations}
                onCheckedChange={(checked) => updateConfig({ log_validations: checked })}
              />
            </div>

            {/* Memory Secret Key */}
            {memoryIntegrityCheck && (
              <div className="space-y-2">
                <Label htmlFor="memory-secret-key" className="flex items-center gap-2 text-sm">
                  <Lock className="h-3 w-3" />
                  Memory Secret Key
                </Label>
                <Input
                  id="memory-secret-key"
                  type="password"
                  placeholder="Enter secret key for HMAC signing"
                  value={(config.memory_secret_key as string) || ''}
                  onChange={(e) => updateConfig({ memory_secret_key: e.target.value || undefined })}
                />
                <p className="text-muted-foreground text-xs">
                  Secret key for signing memory entries (leave empty for auto-generated)
                </p>
              </div>
            )}

            {/* Require Worth For */}
            <div className="space-y-2">
              <Label className="text-sm">Require Worth For</Label>
              <div className="flex flex-wrap gap-2">
                {requirePurposeFor.map((action) => (
                  <Badge key={action} variant="secondary" className="text-xs">
                    {action}
                  </Badge>
                ))}
              </div>
              <p className="text-muted-foreground text-xs">
                Actions that require explicit worth/reason
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
