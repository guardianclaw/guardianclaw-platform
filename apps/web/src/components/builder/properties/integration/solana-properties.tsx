'use client'

/**
 * Solana Agent Kit Integration Properties Panel
 *
 * Configuration panel for Solana Agent Kit-based agents.
 * Allows users to configure:
 * - Spending limits
 * - Slippage tolerance
 * - Priority fee caps
 * - Blocked addresses
 * - Memory integrity settings
 */

import { useState, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Coins,
  Ban,
  DollarSign,
  Plus,
  X,
  Percent,
  Zap,
  Database,
} from 'lucide-react'
import type { SolanaConfig, SpendingLimits } from '@/types/integration'

interface SolanaPropertiesProps {
  subtype: string
  config: SolanaConfig | Record<string, unknown>
  onChange: (config: SolanaConfig) => void
}

// Default spending limits
const DEFAULT_SPENDING_LIMITS: SpendingLimits = {
  max_single_transaction: 100,
  max_daily_total: 500,
  confirmation_threshold: 50,
}

export function SolanaProperties({ config, onChange }: SolanaPropertiesProps) {
  // State for collapsible sections
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showBlocklist, setShowBlocklist] = useState(false)
  const [newAddress, setNewAddress] = useState('')

  // Extract values with defaults
  const spendingLimits = (config.spending_limits as SpendingLimits) || DEFAULT_SPENDING_LIMITS
  const blockedAddresses = useMemo(
    () => (config.blocked_addresses as string[]) || [],
    [config.blocked_addresses]
  )
  const fiduciaryEnabled = config.fiduciary_enabled !== false
  const slippageTolerance = (config.slippage_tolerance as number) ?? 1.0
  const priorityFeeCap = (config.priority_fee_cap as number) ?? 10000
  const memoryIntegrityCheck = config.memory_integrity_check === true

  // Update helper
  const updateConfig = useCallback(
    (updates: Partial<SolanaConfig>) => {
      onChange({
        ...config,
        ...updates,
      } as SolanaConfig)
    },
    [config, onChange]
  )

  // Update spending limits
  const updateSpendingLimits = useCallback(
    (updates: Partial<SpendingLimits>) => {
      updateConfig({
        spending_limits: {
          ...spendingLimits,
          ...updates,
        },
      })
    },
    [spendingLimits, updateConfig]
  )

  // Add blocked address
  const addBlockedAddress = useCallback(() => {
    if (newAddress && !blockedAddresses.includes(newAddress)) {
      updateConfig({
        blocked_addresses: [...blockedAddresses, newAddress],
      })
      setNewAddress('')
    }
  }, [newAddress, blockedAddresses, updateConfig])

  // Remove blocked address
  const removeBlockedAddress = useCallback(
    (address: string) => {
      updateConfig({
        blocked_addresses: blockedAddresses.filter((a) => a !== address),
      })
    },
    [blockedAddresses, updateConfig]
  )

  return (
    <div className="space-y-6">
      {/* Framework Badge */}
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-purple-500/30 bg-purple-500/10 text-xs">
          <Coins className="mr-1 h-3 w-3" />
          Solana Agent Kit
        </Badge>
        <span className="text-muted-foreground text-xs">Integration</span>
      </div>

      {/* Spending Limits */}
      <div className="bg-muted/50 space-y-4 rounded-lg p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <DollarSign className="h-4 w-4" />
          Spending Limits
        </h4>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="max-single" className="text-xs">
              Max Single Transaction (USD)
            </Label>
            <Input
              id="max-single"
              type="number"
              min={0}
              value={spendingLimits.max_single_transaction}
              onChange={(e) =>
                updateSpendingLimits({
                  max_single_transaction: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-daily" className="text-xs">
              Max Daily Total (USD)
            </Label>
            <Input
              id="max-daily"
              type="number"
              min={0}
              value={spendingLimits.max_daily_total}
              onChange={(e) =>
                updateSpendingLimits({
                  max_daily_total: parseFloat(e.target.value) || 0,
                })
              }
            />
          </div>

          <div className="col-span-2 space-y-2">
            <Label htmlFor="confirmation-threshold" className="text-xs">
              Confirmation Threshold (USD)
            </Label>
            <Input
              id="confirmation-threshold"
              type="number"
              min={0}
              value={spendingLimits.confirmation_threshold}
              onChange={(e) =>
                updateSpendingLimits({
                  confirmation_threshold: parseFloat(e.target.value) || 0,
                })
              }
            />
            <p className="text-muted-foreground text-xs">
              Transactions above this amount require human confirmation
            </p>
          </div>
        </div>
      </div>

      {/* DeFi Settings */}
      <div className="bg-muted/50 space-y-4 rounded-lg p-4">
        <h4 className="flex items-center gap-2 text-sm font-medium">
          <Percent className="h-4 w-4" />
          DeFi Settings
        </h4>

        {/* Slippage Tolerance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="slippage" className="text-xs">
              Slippage Tolerance
            </Label>
            <span className="font-mono text-xs">{slippageTolerance.toFixed(1)}%</span>
          </div>
          <Slider
            id="slippage"
            min={0.1}
            max={5}
            step={0.1}
            value={[slippageTolerance]}
            onValueChange={([value]) => updateConfig({ slippage_tolerance: value })}
          />
          <p className="text-muted-foreground text-xs">Maximum acceptable slippage for swaps</p>
        </div>

        {/* Priority Fee Cap */}
        <div className="space-y-2">
          <Label htmlFor="priority-fee" className="flex items-center gap-2 text-xs">
            <Zap className="h-3 w-3" />
            Priority Fee Cap (lamports)
          </Label>
          <Input
            id="priority-fee"
            type="number"
            min={0}
            value={priorityFeeCap}
            onChange={(e) => updateConfig({ priority_fee_cap: parseInt(e.target.value) || 0 })}
          />
          <p className="text-muted-foreground text-xs">
            Maximum priority fee to prevent overpaying
          </p>
        </div>
      </div>

      {/* Security Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="fiduciary-enabled" className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4" />
              Fiduciary Guard
            </Label>
            <p className="text-muted-foreground text-xs">
              Validate transactions serve user&apos;s stated goals
            </p>
          </div>
          <Switch
            id="fiduciary-enabled"
            checked={fiduciaryEnabled}
            onCheckedChange={(checked) => updateConfig({ fiduciary_enabled: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="memory-integrity" className="flex items-center gap-2 text-sm">
              <Database className="h-4 w-4" />
              Memory Integrity Check
            </Label>
            <p className="text-muted-foreground text-xs">
              Verify agent memory hasn&apos;t been tampered with
            </p>
          </div>
          <Switch
            id="memory-integrity"
            checked={memoryIntegrityCheck}
            onCheckedChange={(checked) => updateConfig({ memory_integrity_check: checked })}
          />
        </div>
      </div>

      {/* Blocked Addresses */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setShowBlocklist(!showBlocklist)}
          className="hover:text-foreground/80 flex items-center gap-2 text-sm font-medium"
        >
          {showBlocklist ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <Ban className="h-4 w-4" />
          Blocked Addresses ({blockedAddresses.length})
        </button>

        {showBlocklist && (
          <div className="space-y-3 pl-6">
            {/* Add new address */}
            <div className="flex gap-2">
              <Input
                placeholder="Solana address..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="font-mono text-xs"
              />
              <Button type="button" size="sm" onClick={addBlockedAddress} disabled={!newAddress}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* List blocked addresses */}
            {blockedAddresses.length === 0 ? (
              <p className="text-muted-foreground text-xs">No addresses blocked</p>
            ) : (
              <div className="space-y-2">
                {blockedAddresses.map((address) => (
                  <div
                    key={address}
                    className="bg-muted/50 flex items-center justify-between rounded p-2 font-mono text-xs"
                  >
                    <span className="truncate">{address}</span>
                    <button
                      type="button"
                      onClick={() => removeBlockedAddress(address)}
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
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="log-validations" className="text-sm">
                  Log Validations
                </Label>
                <p className="text-muted-foreground text-xs">
                  Log all validation attempts for audit
                </p>
              </div>
              <Switch
                id="log-validations"
                checked={config.log_validations !== false}
                onCheckedChange={(checked) => updateConfig({ log_validations: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="fail-closed" className="text-sm">
                  Fail Closed
                </Label>
                <p className="text-muted-foreground text-xs">
                  Block transactions if validation fails
                </p>
              </div>
              <Switch
                id="fail-closed"
                checked={config.fail_closed === true}
                onCheckedChange={(checked) => updateConfig({ fail_closed: checked })}
              />
            </div>

            {memoryIntegrityCheck && (
              <div className="space-y-2">
                <Label htmlFor="memory-secret" className="text-xs">
                  Memory Secret Key
                </Label>
                <Input
                  id="memory-secret"
                  type="password"
                  placeholder="Secret key for memory integrity..."
                  value={(config.memory_secret_key as string) || ''}
                  onChange={(e) => updateConfig({ memory_secret_key: e.target.value })}
                />
                <p className="text-muted-foreground text-xs">
                  HMAC key for verifying memory integrity
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
