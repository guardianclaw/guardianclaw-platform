'use client'

/**
 * Coinbase AgentKit Integration Properties Panel
 *
 * Configuration panel for Coinbase AgentKit-based agents.
 * Allows users to configure:
 * - Security profile selection
 * - Spending limits
 * - Blocked addresses
 * - Fiduciary guard settings
 * - Transaction validation options
 */

import { useState, useCallback, useMemo } from 'react'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Wallet,
  Ban,
  DollarSign,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react'
import type { CoinbaseConfig, SpendingLimits, SecurityProfile } from '@/types/integration'

interface CoinbasePropertiesProps {
  subtype: string
  config: CoinbaseConfig | Record<string, unknown>
  onChange: (config: CoinbaseConfig) => void
}

// Security profile options
const SECURITY_PROFILES = [
  { value: 'permissive', label: 'Permissive', description: 'Minimal restrictions, for testing' },
  { value: 'standard', label: 'Standard', description: 'Balanced security (Recommended)' },
  { value: 'strict', label: 'Strict', description: 'Higher security, more confirmations' },
  { value: 'paranoid', label: 'Paranoid', description: 'Maximum security' },
]

// Default spending limits by profile
const PROFILE_DEFAULTS: Record<string, SpendingLimits> = {
  permissive: { max_single_transaction: 1000, max_daily_total: 5000, confirmation_threshold: 500 },
  standard: { max_single_transaction: 100, max_daily_total: 500, confirmation_threshold: 50 },
  strict: { max_single_transaction: 25, max_daily_total: 100, confirmation_threshold: 10 },
  paranoid: { max_single_transaction: 10, max_daily_total: 50, confirmation_threshold: 5 },
}

export function CoinbaseProperties({ config, onChange }: CoinbasePropertiesProps) {
  // State for collapsible sections
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showBlocklist, setShowBlocklist] = useState(false)
  const [newAddress, setNewAddress] = useState('')

  // Extract values with defaults
  const securityProfile = (config.security_profile as string) || 'standard'
  const spendingLimits =
    (config.spending_limits as SpendingLimits) ||
    PROFILE_DEFAULTS[securityProfile] ||
    PROFILE_DEFAULTS.standard
  const blockedAddresses = useMemo(
    () => (config.blocked_addresses as string[]) || [],
    [config.blocked_addresses]
  )
  const fiduciaryEnabled = config.fiduciary_enabled !== false
  const blockUnlimitedApprovals = config.block_unlimited_approvals !== false
  const validateBeforeSign = config.validate_before_sign !== false

  // Update helper
  const updateConfig = useCallback(
    (updates: Partial<CoinbaseConfig>) => {
      onChange({
        ...config,
        ...updates,
      } as CoinbaseConfig)
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

  // Handle profile change
  const handleProfileChange = useCallback(
    (profile: string) => {
      const defaults = PROFILE_DEFAULTS[profile] || PROFILE_DEFAULTS.standard
      updateConfig({
        security_profile: profile as SecurityProfile,
        spending_limits: defaults,
      })
    },
    [updateConfig]
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
        <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-xs">
          <Wallet className="mr-1 h-3 w-3" />
          Coinbase AgentKit
        </Badge>
        <span className="text-muted-foreground text-xs">Integration</span>
      </div>

      {/* Security Profile */}
      <div className="space-y-2">
        <Label htmlFor="security-profile" className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Security Profile
        </Label>
        <Select value={securityProfile} onValueChange={handleProfileChange}>
          <SelectTrigger id="security-profile">
            <SelectValue placeholder="Select profile" />
          </SelectTrigger>
          <SelectContent>
            {SECURITY_PROFILES.map((profile) => (
              <SelectItem key={profile.value} value={profile.value}>
                <div className="flex flex-col">
                  <span>{profile.label}</span>
                  <span className="text-muted-foreground text-xs">{profile.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Determines default spending limits and validation strictness
        </p>
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

      {/* Security Toggles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="fiduciary-enabled" className="text-sm">
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
            <Label htmlFor="block-unlimited" className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />
              Block Unlimited Approvals
            </Label>
            <p className="text-muted-foreground text-xs">
              Prevent token approvals with unlimited amounts
            </p>
          </div>
          <Switch
            id="block-unlimited"
            checked={blockUnlimitedApprovals}
            onCheckedChange={(checked) => updateConfig({ block_unlimited_approvals: checked })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="validate-before-sign" className="text-sm">
              Validate Before Sign
            </Label>
            <p className="text-muted-foreground text-xs">
              Run validation before signing transactions
            </p>
          </div>
          <Switch
            id="validate-before-sign"
            checked={validateBeforeSign}
            onCheckedChange={(checked) => updateConfig({ validate_before_sign: checked })}
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
                placeholder="0x..."
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
          </div>
        )}
      </div>
    </div>
  )
}
