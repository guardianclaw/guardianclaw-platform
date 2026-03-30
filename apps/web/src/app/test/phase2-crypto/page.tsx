'use client'

/**
 * Test page for Phase 2 Crypto Integration Components
 *
 * Tests Coinbase AgentKit and Solana Agent Kit properties panels
 */

import { useState } from 'react'
import { IntegrationPropertiesRouter } from '@/components/builder/properties/integration'
import type { Framework, CoinbaseConfig, SolanaConfig } from '@/types/integration'

export default function Phase2CryptoTestPage() {
  const [framework, setFramework] = useState<Framework>('coinbase')

  const [coinbaseConfig, setCoinbaseConfig] = useState<CoinbaseConfig>({
    security_profile: 'standard',
    spending_limits: {
      max_single_transaction: 100,
      max_daily_total: 500,
      confirmation_threshold: 50,
    },
    blocked_addresses: [],
    fiduciary_enabled: true,
    block_unlimited_approvals: true,
    validate_before_sign: true,
    log_validations: true,
  })

  const [solanaConfig, setSolanaConfig] = useState<SolanaConfig>({
    spending_limits: {
      max_single_transaction: 100,
      max_daily_total: 500,
      confirmation_threshold: 50,
    },
    blocked_addresses: [],
    fiduciary_enabled: true,
    slippage_tolerance: 1.0,
    priority_fee_cap: 10000,
    memory_integrity_check: false,
    log_validations: true,
  })

  const currentConfig = framework === 'solana_agent_kit' ? solanaConfig : coinbaseConfig
  const setCurrentConfig =
    framework === 'solana_agent_kit'
      ? (config: Record<string, unknown>) => setSolanaConfig(config as SolanaConfig)
      : (config: Record<string, unknown>) => setCoinbaseConfig(config as CoinbaseConfig)

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-lg space-y-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Phase 2 Crypto Test</h1>
          <p className="text-muted-foreground">
            Testing Coinbase AgentKit and Solana Agent Kit properties panels
          </p>
        </div>

        {/* Framework selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Framework</label>
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value as Framework)}
            className="bg-background w-full rounded-md border p-2"
          >
            <option value="coinbase">Coinbase AgentKit</option>
            <option value="solana_agent_kit">Solana Agent Kit</option>
          </select>
        </div>

        {/* Properties panel */}
        <div className="bg-card rounded-lg border p-4">
          <IntegrationPropertiesRouter
            subtype={framework}
            config={currentConfig as Record<string, unknown>}
            onChange={(newConfig) => setCurrentConfig(newConfig as Record<string, unknown>)}
            framework={framework}
          />
        </div>

        {/* Current config display */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Config (JSON)</label>
          <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
            {JSON.stringify(currentConfig, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
