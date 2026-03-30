'use client'

/**
 * Test page for IntegrationPropertiesRouter
 *
 * This is a development test page to verify the integration properties
 * components render correctly. Remove before production.
 *
 * Access at: /test/integration-properties
 */

import { useState } from 'react'
import { IntegrationPropertiesRouter } from '@/components/builder/properties/integration'
import type { Framework, IntegrationConfig } from '@/types/integration'

export default function IntegrationPropertiesTestPage() {
  const [framework, setFramework] = useState<Framework>('openai_agents')
  const [config, setConfig] = useState<Record<string, unknown>>({
    seed_level: 'standard',
    on_violation: 'block',
    inject_seed: true,
    log_validations: true,
    fail_closed: false,
    gates: {
      credibility: true,
      avoidance: true,
      limits: true,
      worth: true,
    },
  })

  const handleConfigChange = (newConfig: IntegrationConfig | Record<string, unknown>) => {
    setConfig(newConfig as Record<string, unknown>)
    console.log('Config updated:', newConfig)
  }

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-md space-y-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Integration Properties Test</h1>
          <p className="text-muted-foreground">Testing IntegrationPropertiesRouter component</p>
        </div>

        {/* Framework selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Framework</label>
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value as Framework)}
            className="bg-background w-full rounded-md border p-2"
          >
            <option value="openai_agents">OpenAI Agents</option>
            <option value="coinbase">Coinbase</option>
            <option value="solana_agent_kit">Solana</option>
            <option value="google_adk">Google ADK</option>
            <option value="virtuals">Virtuals</option>
          </select>
        </div>

        {/* Properties panel */}
        <div className="bg-card rounded-lg border p-4">
          <IntegrationPropertiesRouter
            subtype={framework}
            config={config}
            onChange={handleConfigChange}
            framework={framework}
          />
        </div>

        {/* Current config display */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Config (JSON)</label>
          <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
