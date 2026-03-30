/**
 * Analytics V2 Types Tests
 *
 * Unit tests for Analytics V2 type definitions and helpers.
 */

import { describe, it, expect } from 'vitest'
import type {
  LayerStats,
  ToolStats,
  SocialStats,
  DeFiStats,
  MemoryStats,
  TokenStats,
  AgentCapabilities,
  RecentBlockV2,
  AnalyticsResponseV2,
} from './api'

// Test data factories
function createLayerStats(overrides: Partial<LayerStats> = {}): LayerStats {
  return {
    layer: 'L1_input',
    total_checks: 100,
    blocked_count: 5,
    ...overrides,
  }
}

function createToolStats(overrides: Partial<ToolStats> = {}): ToolStats {
  return {
    tool_type: 'web_search',
    total_calls: 50,
    success_count: 48,
    avg_latency_ms: 250,
    ...overrides,
  }
}

function createSocialStats(overrides: Partial<SocialStats> = {}): SocialStats {
  return {
    platform: 'twitter',
    total_deliveries: 30,
    success_count: 28,
    failure_count: 2,
    ...overrides,
  }
}

function createDeFiStats(overrides: Partial<DeFiStats> = {}): DeFiStats {
  return {
    operation: 'transfer',
    total_transactions: 20,
    blocked_count: 1,
    total_value_usd: 5000,
    ...overrides,
  }
}

function createMemoryStats(overrides: Partial<MemoryStats> = {}): MemoryStats {
  return {
    reads: 100,
    writes: 50,
    shield_blocks: 3,
    ...overrides,
  }
}

function createTokenStats(overrides: Partial<TokenStats> = {}): TokenStats {
  return {
    input_tokens: 5000,
    output_tokens: 3000,
    total_tokens: 8000,
    ...overrides,
  }
}

function createCapabilities(overrides: Partial<AgentCapabilities> = {}): AgentCapabilities {
  return {
    templateId: 'custom',
    framework: 'custom',
    hasSocialOutputs: false,
    hasDeFiOperations: false,
    hasMultiAgent: false,
    hasMemory: false,
    hasTools: false,
    hasCodeExecution: false,
    hasL4Observer: false,
    ...overrides,
  }
}

function createRecentBlock(overrides: Partial<RecentBlockV2> = {}): RecentBlockV2 {
  return {
    id: 'block-1',
    layer: 'L1_input',
    gate: 'avoidance',
    created_at: '2026-01-14T10:00:00Z',
    ...overrides,
  }
}

describe('Analytics V2 Types', () => {
  describe('LayerStats', () => {
    it('should create valid layer stats', () => {
      const stats = createLayerStats()
      expect(stats.layer).toBe('L1_input')
      expect(stats.total_checks).toBe(100)
      expect(stats.blocked_count).toBe(5)
    })

    it('should support all layer types', () => {
      const l1 = createLayerStats({ layer: 'L1_input' })
      const l3 = createLayerStats({ layer: 'L3_output' })
      const l4 = createLayerStats({ layer: 'L4_observer' })

      expect(l1.layer).toBe('L1_input')
      expect(l3.layer).toBe('L3_output')
      expect(l4.layer).toBe('L4_observer')
    })
  })

  describe('ToolStats', () => {
    it('should create valid tool stats', () => {
      const stats = createToolStats()
      expect(stats.tool_type).toBe('web_search')
      expect(stats.total_calls).toBe(50)
      expect(stats.success_count).toBe(48)
      expect(stats.avg_latency_ms).toBe(250)
    })

    it('should calculate success rate correctly', () => {
      const stats = createToolStats({ total_calls: 100, success_count: 95 })
      const successRate = (stats.success_count / stats.total_calls) * 100
      expect(successRate).toBe(95)
    })
  })

  describe('SocialStats', () => {
    it('should create valid social stats', () => {
      const stats = createSocialStats()
      expect(stats.platform).toBe('twitter')
      expect(stats.total_deliveries).toBe(30)
      expect(stats.success_count).toBe(28)
      expect(stats.failure_count).toBe(2)
    })

    it('should have consistent delivery counts', () => {
      const stats = createSocialStats()
      expect(stats.success_count + stats.failure_count).toBe(stats.total_deliveries)
    })
  })

  describe('DeFiStats', () => {
    it('should create valid DeFi stats', () => {
      const stats = createDeFiStats()
      expect(stats.operation).toBe('transfer')
      expect(stats.total_transactions).toBe(20)
      expect(stats.blocked_count).toBe(1)
      expect(stats.total_value_usd).toBe(5000)
    })

    it('should support all operation types', () => {
      const transfer = createDeFiStats({ operation: 'transfer' })
      const swap = createDeFiStats({ operation: 'swap' })
      const stake = createDeFiStats({ operation: 'stake' })
      const mint = createDeFiStats({ operation: 'mint' })

      expect(transfer.operation).toBe('transfer')
      expect(swap.operation).toBe('swap')
      expect(stake.operation).toBe('stake')
      expect(mint.operation).toBe('mint')
    })
  })

  describe('MemoryStats', () => {
    it('should create valid memory stats', () => {
      const stats = createMemoryStats()
      expect(stats.reads).toBe(100)
      expect(stats.writes).toBe(50)
      expect(stats.shield_blocks).toBe(3)
    })
  })

  describe('TokenStats', () => {
    it('should create valid token stats', () => {
      const stats = createTokenStats()
      expect(stats.input_tokens).toBe(5000)
      expect(stats.output_tokens).toBe(3000)
      expect(stats.total_tokens).toBe(8000)
    })

    it('should have consistent total', () => {
      const stats = createTokenStats()
      expect(stats.input_tokens + stats.output_tokens).toBe(stats.total_tokens)
    })
  })

  describe('AgentCapabilities', () => {
    it('should create default capabilities (all false)', () => {
      const caps = createCapabilities()
      expect(caps.hasSocialOutputs).toBe(false)
      expect(caps.hasDeFiOperations).toBe(false)
      expect(caps.hasMultiAgent).toBe(false)
      expect(caps.hasMemory).toBe(false)
      expect(caps.hasTools).toBe(false)
      expect(caps.hasCodeExecution).toBe(false)
      expect(caps.hasL4Observer).toBe(false)
    })

    it('should create ElizaOS capabilities', () => {
      const caps = createCapabilities({
        framework: 'elizaos',
        hasSocialOutputs: true,
        hasMemory: true,
      })
      expect(caps.framework).toBe('elizaos')
      expect(caps.hasSocialOutputs).toBe(true)
      expect(caps.hasMemory).toBe(true)
    })

    it('should create Solana capabilities', () => {
      const caps = createCapabilities({
        framework: 'solana_agent_kit',
        hasDeFiOperations: true,
      })
      expect(caps.framework).toBe('solana_agent_kit')
      expect(caps.hasDeFiOperations).toBe(true)
    })

    it('should create OpenAI Agents capabilities', () => {
      const caps = createCapabilities({
        framework: 'openai_agents',
        hasMultiAgent: true,
        hasTools: true,
      })
      expect(caps.framework).toBe('openai_agents')
      expect(caps.hasMultiAgent).toBe(true)
      expect(caps.hasTools).toBe(true)
    })
  })

  describe('RecentBlockV2', () => {
    it('should create valid recent block', () => {
      const block = createRecentBlock()
      expect(block.id).toBe('block-1')
      expect(block.layer).toBe('L1_input')
      expect(block.gate).toBe('avoidance')
      expect(block.created_at).toBe('2026-01-14T10:00:00Z')
    })

    it('should include layer info (unlike v1)', () => {
      const block = createRecentBlock({ layer: 'L4_observer' })
      expect(block.layer).toBe('L4_observer')
    })
  })

  describe('AnalyticsResponseV2', () => {
    it('should create valid response structure', () => {
      const response: AnalyticsResponseV2 = {
        summary: {
          total_requests: 1000,
          total_blocked: 50,
          block_rate: 5,
          avg_latency_ms: 200,
        },
        daily: [{ date: '2026-01-14', requests: 100, blocked: 5, avg_latency_ms: 200 }],
        layers: [createLayerStats()],
        recent_blocks: [createRecentBlock()],
        tokens: createTokenStats(),
        capabilities: createCapabilities(),
      }

      expect(response.summary.total_requests).toBe(1000)
      expect(response.daily).toHaveLength(1)
      expect(response.layers).toHaveLength(1)
      expect(response.recent_blocks).toHaveLength(1)
      expect(response.tokens.total_tokens).toBe(8000)
      expect(response.capabilities.framework).toBe('custom')
    })

    it('should support optional conditional fields', () => {
      const response: AnalyticsResponseV2 = {
        summary: {
          total_requests: 100,
          total_blocked: 5,
          block_rate: 5,
          avg_latency_ms: 200,
        },
        daily: [],
        layers: [],
        recent_blocks: [],
        tokens: createTokenStats(),
        capabilities: createCapabilities({ hasSocialOutputs: true }),
        // Optional fields
        tools: [createToolStats()],
        social: [createSocialStats()],
        defi: undefined,
        memory: undefined,
      }

      expect(response.tools).toHaveLength(1)
      expect(response.social).toHaveLength(1)
      expect(response.defi).toBeUndefined()
      expect(response.memory).toBeUndefined()
    })
  })
})
