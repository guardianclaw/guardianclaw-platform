'use client'

/**
 * Integration Properties Router
 *
 * Routes to the appropriate integration-specific properties panel based on
 * the node's subtype or the agent's framework.
 *
 * Usage:
 *   <IntegrationPropertiesRouter
 *     subtype="coinbase_agentkit"
 *     config={node.data.config?.integration}
 *     onChange={(config) => updateNode({ config: { integration: config } })}
 *   />
 */

import React from 'react'
import type { Framework, IntegrationConfig } from '@/types/integration'

const OpenAIAgentsProperties = React.lazy(() =>
  import('./openai-agents-properties').then((m) => ({ default: m.OpenAIAgentsProperties }))
)

// Phase 2 - Crypto Integrations
const CoinbaseProperties = React.lazy(() =>
  import('./coinbase-properties').then((m) => ({ default: m.CoinbaseProperties }))
)

const SolanaProperties = React.lazy(() =>
  import('./solana-properties').then((m) => ({ default: m.SolanaProperties }))
)

// Phase 3 - Secondary Integrations
const GoogleADKProperties = React.lazy(() =>
  import('./google-adk-properties').then((m) => ({ default: m.GoogleADKProperties }))
)

const VirtualsProperties = React.lazy(() =>
  import('./virtuals-properties').then((m) => ({ default: m.VirtualsProperties }))
)

// Placeholder components for frameworks not yet implemented
const PlaceholderProperties = ({ framework }: { framework: string }) => (
  <div className="space-y-4">
    <div className="bg-muted/50 rounded-lg p-4">
      <p className="text-muted-foreground text-sm">
        Properties panel for <span className="font-medium">{framework}</span> is coming soon.
      </p>
      <p className="text-muted-foreground mt-2 text-xs">
        The integration will use default settings.
      </p>
    </div>
  </div>
)

// Map of framework/subtype to their property components
const INTEGRATION_COMPONENTS: Record<
  string,
  React.ComponentType<IntegrationPropertiesRouterProps>
> = {
  openai_agents:
    OpenAIAgentsProperties as unknown as React.ComponentType<IntegrationPropertiesRouterProps>,

  // Phase 2 - Crypto Integrations
  coinbase: CoinbaseProperties as unknown as React.ComponentType<IntegrationPropertiesRouterProps>,
  solana_agent_kit:
    SolanaProperties as unknown as React.ComponentType<IntegrationPropertiesRouterProps>,

  // Phase 3 - Secondary Integrations
  google_adk:
    GoogleADKProperties as unknown as React.ComponentType<IntegrationPropertiesRouterProps>,
  virtuals: VirtualsProperties as unknown as React.ComponentType<IntegrationPropertiesRouterProps>,
}

// Alternative subtypes that map to the same component
const SUBTYPE_ALIASES: Record<string, string> = {
  coinbase_agentkit: 'coinbase',
  solana_agentkit: 'solana_agent_kit',
  openai: 'openai_agents',
  // Phase 3 aliases
  googleadk: 'google_adk',
  game_sdk: 'virtuals',
  virtuals_protocol: 'virtuals',
}

export interface IntegrationPropertiesRouterProps {
  subtype: string
  config: IntegrationConfig | Record<string, unknown>
  onChange: (config: IntegrationConfig | Record<string, unknown>) => void
  framework?: Framework
}

export function IntegrationPropertiesRouter({
  subtype,
  config,
  onChange,
  framework,
}: IntegrationPropertiesRouterProps) {
  // Normalize subtype using aliases
  const normalizedSubtype = SUBTYPE_ALIASES[subtype] || subtype

  // Try to find a component for this subtype
  const Component = INTEGRATION_COMPONENTS[normalizedSubtype]

  if (Component) {
    return (
      <React.Suspense fallback={<IntegrationLoadingState />}>
        <Component
          subtype={normalizedSubtype}
          config={config}
          onChange={onChange}
          framework={framework}
        />
      </React.Suspense>
    )
  }

  // Fallback to placeholder for unimplemented integrations
  return <PlaceholderProperties framework={normalizedSubtype || framework || 'unknown'} />
}

// Loading state while lazy loading components
function IntegrationLoadingState() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="bg-muted h-4 w-1/3 rounded" />
      <div className="bg-muted h-10 rounded" />
      <div className="bg-muted h-4 w-1/2 rounded" />
      <div className="bg-muted h-10 rounded" />
    </div>
  )
}

// Export individual components for direct use
export { OpenAIAgentsProperties } from './openai-agents-properties'
export { CoinbaseProperties } from './coinbase-properties'
export { SolanaProperties } from './solana-properties'
// Phase 3
export { GoogleADKProperties } from './google-adk-properties'
export { VirtualsProperties } from './virtuals-properties'

// Re-export types
export type { IntegrationConfig } from '@/types/integration'
