'use client'

/**
 * Test page for Integration Components
 *
 * Tests OpenAI Agents and Google ADK properties panels
 */

import { useState } from 'react'
import { IntegrationPropertiesRouter } from '@/components/builder/properties/integration'
import type { Framework } from '@/types/integration'

export default function Phase1ComponentsTestPage() {
  const [framework, setFramework] = useState<Framework>('openai_agents')
  const [config, setConfig] = useState<Record<string, unknown>>({
    guardrail_model: 'gpt-4o-mini',
    require_all_gates: true,
    skip_semantic_if_heuristic: true,
    validation_timeout_ms: 30000,
    block_on_violation: true,
    use_heuristic: true,
    fail_open: false,
  })

  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-lg space-y-8">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Integration Components Test</h1>
          <p className="text-muted-foreground">Testing integration properties panels</p>
        </div>

        {/* Framework selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Framework</label>
          <select
            value={framework}
            onChange={(e) => setFramework(e.target.value as Framework)}
            className="bg-background w-full rounded-md border p-2"
          >
            <option value="openai_agents">OpenAI Agents SDK</option>
            <option value="google_adk">Google ADK</option>
            <option value="coinbase">Coinbase AgentKit</option>
            <option value="virtuals">Virtuals Protocol</option>
          </select>
        </div>

        {/* Properties panel */}
        <div className="bg-card rounded-lg border p-4">
          <IntegrationPropertiesRouter
            subtype={framework}
            config={config}
            onChange={(newConfig) => setConfig(newConfig as Record<string, unknown>)}
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
