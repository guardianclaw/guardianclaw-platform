'use client'

/**
 * Test page for Phase 3 Secondary Integration Components
 *
 * Tests Google ADK and Virtuals Protocol properties panels
 */

import { useState } from 'react'
import { IntegrationPropertiesRouter } from '@/components/builder/properties/integration'
import type { Framework, GoogleADKConfig, VirtualsConfig } from '@/types/integration'

export default function Phase3SecondaryTestPage() {
  const [framework, setFramework] = useState<Framework>('google_adk')

  const [googleADKConfig, setGoogleADKConfig] = useState<GoogleADKConfig>({
    seed_level: 'standard',
    block_on_failure: true,
    fail_closed: false,
    validate_inputs: true,
    validate_outputs: true,
    validate_tools: true,
    max_text_size: 100000,
    validation_timeout: 5.0,
    log_validations: true,
  })

  const [virtualsConfig, setVirtualsConfig] = useState<VirtualsConfig>({
    block_unsafe: true,
    log_validations: true,
    max_transaction_amount: 1000,
    require_confirmation_above: 100,
    require_purpose_for: ['transfer', 'send', 'approve', 'swap', 'bridge', 'withdraw'],
    memory_integrity_check: false,
    blocked_functions: [
      'drain_wallet',
      'send_all_tokens',
      'approve_unlimited',
      'export_private_key',
    ],
    fiduciary_enabled: true,
    strict_fiduciary: false,
  })

  const currentConfig = framework === 'virtuals' ? virtualsConfig : googleADKConfig
  const setCurrentConfig =
    framework === 'virtuals'
      ? (config: Record<string, unknown>) => setVirtualsConfig(config as VirtualsConfig)
      : (config: Record<string, unknown>) => setGoogleADKConfig(config as GoogleADKConfig)

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-lg space-y-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Phase 3 Secondary Test</h1>
          <p className="text-muted-foreground">
            Testing Google ADK and Virtuals Protocol properties panels
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
            <option value="google_adk">Google ADK</option>
            <option value="virtuals">Virtuals Protocol (GAME SDK)</option>
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
