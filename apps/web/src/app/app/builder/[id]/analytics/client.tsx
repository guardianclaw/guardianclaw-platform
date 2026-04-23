'use client'

import { BarChart3, AlertTriangle, Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgent } from '../context'
import { useAnalyticsV2 } from './hooks/use-analytics'

import { OverviewSection } from './components/overview-section'
import { GuardianClawSection } from './components/claw-section'
import { TokensSection } from './components/tokens-section'
import { DailyChartSection } from './components/daily-chart-section'
import { RecentActivitySection } from './components/recent-activity-section'
import { ToolsSection } from './components/tools-section'
import { SocialSection } from './components/social-section'
import { DeFiSection } from './components/defi-section'
import { MemorySection } from './components/memory-section'
// Phase 4: Enhanced Analytics Components
import { GateBreakdownSection } from './components/gate-breakdown-section'
import { LatencyHistogramSection } from './components/latency-histogram-section'

function getFrameworkDescription(framework: string): string {
  const descriptions: Record<string, string> = {
    elizaos: 'Social agent metrics for Twitter, Discord, and Telegram',
    solana_agent_kit: 'DeFi protection metrics for Solana transactions',
    coinbase_agentkit: 'DeFi protection metrics for crypto operations',
    openai_agents: 'Agent guardrails and tool usage metrics',
    virtuals_protocol: 'Virtual agent metrics with memory protection',
    google_adk: 'Plugin execution and multi-agent metrics',
    voltagent: 'VoltAgent safety guardrail metrics',
    openclaw: 'OpenClaw protection layer metrics',
    custom: 'Custom agent performance metrics',
  }
  return descriptions[framework] || 'Agent performance and protection metrics'
}

// Default empty values for loading state
const emptyData = {
  summary: { total_requests: 0, total_blocked: 0, block_rate: 0, avg_latency_ms: 0 },
  daily: [] as { date: string; requests: number; blocked: number; avg_latency_ms: number }[],
  layers: [] as { layer: string; total_checks: number; blocked_count: number }[],
  recent_blocks: [] as { id: string; layer: string; gate: string; created_at: string }[],
  tokens: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  capabilities: {
    templateId: 'custom',
    framework: 'custom',
    hasSocialOutputs: false,
    hasDeFiOperations: false,
    hasMultiAgent: false,
    hasMemory: false,
    hasTools: false,
    hasCodeExecution: false,
    hasL4Observer: false,
  },
  // Phase 4: Enhanced Analytics
  gate_breakdown: [] as { gate: string; count: number; percentage: number }[],
  latency_percentiles: {
    p50: 0,
    p75: 0,
    p95: 0,
    p99: 0,
    max: 0,
    distribution: [] as { bucket: string; count: number }[],
  },
  // Conditional sections
  tools: undefined as
    | { tool_type: string; total_calls: number; success_count: number; avg_latency_ms: number }[]
    | undefined,
  social: undefined as
    | { platform: string; total_deliveries: number; success_count: number; failure_count: number }[]
    | undefined,
  defi: undefined as
    | {
        operation: string
        total_transactions: number
        blocked_count: number
        total_value_usd: number
      }[]
    | undefined,
  memory: undefined as { reads: number; writes: number; shield_blocks: number } | undefined,
}

export function AnalyticsPageClient() {
  const { agent, isDemo } = useAgent()
  const {
    data: analytics,
    loading,
    error,
  } = useAnalyticsV2(agent?.id, { days: 7, enabled: !isDemo && !!agent })

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <BarChart3 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Analytics Not Available</h2>
          <p className="text-muted-foreground">
            Sign in to view analytics for your deployed agents.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
          <h2 className="mb-2 text-xl font-semibold">Error Loading Analytics</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  // Show empty state only after loading is complete and there's no data
  if (!loading && (!analytics || analytics.summary.total_requests === 0)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <BarChart3 className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">No Analytics Data Yet</h2>
          <p className="text-muted-foreground">
            Analytics will appear here once your agent starts receiving requests. Deploy your agent
            and make some API calls to see data.
          </p>
        </div>
      </div>
    )
  }

  // Use real data or empty defaults while loading
  const {
    summary,
    daily,
    layers,
    recent_blocks,
    tokens,
    capabilities,
    // Phase 4: Enhanced Analytics
    gate_breakdown,
    latency_percentiles,
    // Conditional sections
    tools,
    social,
    defi,
    memory,
  } = analytics || emptyData

  return (
    <div className="h-full overflow-y-auto">
      <div className="container space-y-8 py-8">
        {/* Header */}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <BarChart3 className="text-claw-500 h-6 w-6" />
            Analytics
          </h1>
          {loading ? (
            <Skeleton className="mt-1 h-4 w-64" />
          ) : (
            <p className="text-muted-foreground mt-1">
              {getFrameworkDescription(capabilities.framework)}
            </p>
          )}
        </div>

        {/* Summary Cards */}
        <OverviewSection summary={summary} loading={loading} />

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2">
          <DailyChartSection daily={daily} loading={loading} />
          <GuardianClawSection layers={layers} loading={loading} />
        </div>

        {/* Phase 4: Enhanced Analytics - Gate Breakdown & Latency */}
        <div className="grid gap-6 md:grid-cols-2">
          <GateBreakdownSection gateBreakdown={gate_breakdown} loading={loading} />
          <LatencyHistogramSection latencyPercentiles={latency_percentiles} loading={loading} />
        </div>

        {/* Token Usage */}
        <TokensSection tokens={tokens} loading={loading} />

        {/* Conditional Sections based on capabilities */}
        {capabilities.hasTools && tools && <ToolsSection tools={tools} loading={loading} />}

        {capabilities.hasSocialOutputs && social && (
          <SocialSection social={social} loading={loading} />
        )}

        {capabilities.hasDeFiOperations && defi && <DeFiSection defi={defi} loading={loading} />}

        {capabilities.hasMemory && memory && <MemorySection memory={memory} loading={loading} />}

        {/* Recent Activity */}
        <RecentActivitySection recentBlocks={recent_blocks} loading={loading} />
      </div>
    </div>
  )
}
