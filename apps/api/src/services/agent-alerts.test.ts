/**
 * Agent Alerts Service Tests
 *
 * Tests for the agent-level alert evaluation and notification system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkAgentAlertRules } from './agent-alerts'

// Mock fetch for notifications
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock Supabase client
function createMockSupabase(overrides: Record<string, unknown> = {}) {
  const defaultData = {
    rules: [],
    metrics: [],
    agent: { name: 'Test Agent' },
    ...overrides,
  }

  return {
    rpc: vi.fn((funcName: string, _params?: unknown) => {
      if (funcName === 'get_agent_alerts_to_check') {
        return Promise.resolve({ data: defaultData.rules, error: null })
      }
      if (funcName === 'get_agent_metrics_for_alerts') {
        return Promise.resolve({ data: defaultData.metrics, error: null })
      }
      if (funcName === 'record_agent_alert_trigger') {
        return Promise.resolve({ data: 'history-id', error: null })
      }
      if (funcName === 'reset_agent_alert_consecutive') {
        return Promise.resolve({ data: null, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(() => {
        if (table === 'agents') {
          return Promise.resolve({ data: defaultData.agent, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }),
    })),
  } as unknown as Parameters<typeof checkAgentAlertRules>[0]
}

describe('checkAgentAlertRules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns empty result when no rules exist', async () => {
    const supabase = createMockSupabase({ rules: [] })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(0)
    expect(result.alertsTriggered).toBe(0)
    expect(result.notificationsSent).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('returns empty result when rules is null', async () => {
    const supabase = createMockSupabase()
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(0)
    expect(result.alertsTriggered).toBe(0)
  })

  it('reports error when fetching rules fails', async () => {
    const supabase = createMockSupabase()
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Database connection failed' },
    })

    const result = await checkAgentAlertRules(supabase)

    expect(result.errors).toContain('Failed to fetch rules: Database connection failed')
  })

  it('skips evaluation when no requests in window (except request_volume)', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 0,
        success_count: 0,
        error_count: 0,
        blocked_count: 0,
        error_rate: 0,
        success_rate: 0,
        block_rate: 0,
        latency_p95: 0,
        latency_p99: 0,
      },
    ]

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(1)
    expect(result.alertsTriggered).toBe(0)
    // Should have called reset since no requests
    expect(supabase.rpc).toHaveBeenCalledWith('reset_agent_alert_consecutive', expect.any(Object))
  })

  it('triggers alert when threshold exceeded and sends webhook notification', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 90,
        error_count: 10,
        blocked_count: 0,
        error_rate: 10, // 10% > 5% threshold
        success_rate: 90,
        block_rate: 0,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    mockFetch.mockResolvedValueOnce({ ok: true })

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(1)
    expect(result.alertsTriggered).toBe(1)
    expect(result.notificationsSent).toBe(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    )
  })

  it('respects cooldown period and does not send duplicate notifications', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 5,
        last_triggered_at: new Date().toISOString(), // Just triggered
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 90,
        error_count: 10,
        blocked_count: 0,
        error_rate: 10,
        success_rate: 90,
        block_rate: 0,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(1)
    expect(result.alertsTriggered).toBe(0) // Should not trigger due to cooldown
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('handles consecutive threshold correctly', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 3, // Needs 3 consecutive triggers
        consecutive_triggers: 1, // Only 1 so far
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 90,
        error_count: 10,
        blocked_count: 0,
        error_rate: 10,
        success_rate: 90,
        block_rate: 0,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(1)
    expect(result.alertsTriggered).toBe(0) // Not enough consecutive triggers
    expect(mockFetch).not.toHaveBeenCalled()
    // Should have updated consecutive_triggers
    expect(supabase.from).toHaveBeenCalledWith('agent_alert_rules')
  })

  it('resets consecutive counter when condition is no longer met', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 5,
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 98,
        error_count: 2,
        blocked_count: 0,
        error_rate: 2, // 2% < 5% threshold - condition not met
        success_rate: 98,
        block_rate: 0,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(1)
    expect(result.alertsTriggered).toBe(0)
    expect(supabase.rpc).toHaveBeenCalledWith('reset_agent_alert_consecutive', {
      p_alert_rule_id: 'rule-1',
      p_current_value: 2,
    })
  })

  it('evaluates different comparison operators correctly', async () => {
    // Test 'lt' (less than) operator for success_rate
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'success_rate',
        threshold: 95, // Alert if success rate < 95%
        window_minutes: 60,
        comparison: 'lt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'critical',
        name: 'Low Success Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 90,
        error_count: 5,
        blocked_count: 5,
        error_rate: 5,
        success_rate: 90, // 90% < 95% threshold
        block_rate: 5,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    mockFetch.mockResolvedValueOnce({ ok: true })

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.alertsTriggered).toBe(1)
  })

  it('handles Slack notifications correctly', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'latency_p95',
        threshold: 1000,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'slack',
        notification_target: 'https://hooks.slack.com/services/xxx',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Latency',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 100,
        error_count: 0,
        blocked_count: 0,
        error_rate: 0,
        success_rate: 100,
        block_rate: 0,
        latency_p95: 1500, // 1500ms > 1000ms threshold
        latency_p99: 2000,
      },
    ]

    mockFetch.mockResolvedValueOnce({ ok: true })

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.notificationsSent).toBe(1)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/xxx',
      expect.objectContaining({
        method: 'POST',
      })
    )
    // Verify Slack payload structure
    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.text).toContain('High Latency')
    expect(body.blocks).toBeDefined()
  })

  it('handles notification failure gracefully', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 90,
        error_count: 10,
        blocked_count: 0,
        error_rate: 10,
        success_rate: 90,
        block_rate: 0,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 })

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.alertsTriggered).toBe(1)
    expect(result.notificationsSent).toBe(0)
    expect(result.errors).toContainEqual(
      expect.stringContaining('Notification failed for rule rule-1')
    )
  })

  it('handles network errors in notifications', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 90,
        error_count: 10,
        blocked_count: 0,
        error_rate: 10,
        success_rate: 90,
        block_rate: 0,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    mockFetch.mockRejectedValueOnce(new Error('Network timeout'))

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.alertsTriggered).toBe(1)
    expect(result.notificationsSent).toBe(0)
    expect(result.errors).toContainEqual(expect.stringContaining('Network timeout'))
  })

  it('processes multiple agents and rules efficiently', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook1',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'Agent 1 Error Rate',
      },
      {
        id: 'rule-2',
        agent_id: 'agent-1',
        rule_type: 'latency_p95',
        threshold: 1000,
        window_minutes: 30,
        comparison: 'gt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook2',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'critical',
        name: 'Agent 1 Latency',
      },
      {
        id: 'rule-3',
        agent_id: 'agent-2',
        rule_type: 'block_rate',
        threshold: 20,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'slack',
        notification_target: 'https://hooks.slack.com/xxx',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'Agent 2 Block Rate',
      },
    ]

    const metricsAgent1 = [
      {
        total_requests: 100,
        success_count: 85,
        error_count: 10,
        blocked_count: 5,
        error_rate: 10, // Triggers rule-1
        success_rate: 85,
        block_rate: 5,
        latency_p95: 1500, // Triggers rule-2
        latency_p99: 2000,
      },
    ]

    const metricsAgent2 = [
      {
        total_requests: 50,
        success_count: 30,
        error_count: 5,
        blocked_count: 15,
        error_rate: 10,
        success_rate: 60,
        block_rate: 30, // Triggers rule-3
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    mockFetch
      .mockResolvedValueOnce({ ok: true }) // rule-1
      .mockResolvedValueOnce({ ok: true }) // rule-2
      .mockResolvedValueOnce({ ok: true }) // rule-3

    const supabase = createMockSupabase({ rules })
    let metricsCallCount = 0
    vi.mocked(supabase.rpc).mockImplementation((funcName: string, params?: unknown) => {
      if (funcName === 'get_agent_alerts_to_check') {
        return Promise.resolve({ data: rules, error: null })
      }
      if (funcName === 'get_agent_metrics_for_alerts') {
        metricsCallCount++
        const agentId = (params as Record<string, unknown>)?.p_agent_id
        if (agentId === 'agent-1') {
          return Promise.resolve({ data: metricsAgent1, error: null })
        }
        return Promise.resolve({ data: metricsAgent2, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const result = await checkAgentAlertRules(supabase)

    expect(result.rulesChecked).toBe(3)
    expect(result.alertsTriggered).toBe(3)
    expect(result.notificationsSent).toBe(3)
    // Should have fetched metrics only twice (once per agent)
    expect(metricsCallCount).toBe(2)
  })

  it('handles email channel as not implemented', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'error_rate',
        threshold: 5,
        window_minutes: 60,
        comparison: 'gt',
        notification_channel: 'email',
        notification_target: 'alerts@example.com',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'High Error Rate',
      },
    ]

    const metrics = [
      {
        total_requests: 100,
        success_count: 90,
        error_count: 10,
        blocked_count: 0,
        error_rate: 10,
        success_rate: 90,
        block_rate: 0,
        latency_p95: 500,
        latency_p99: 800,
      },
    ]

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    expect(result.alertsTriggered).toBe(1)
    expect(result.notificationsSent).toBe(0)
    expect(result.errors).toContainEqual(
      expect.stringContaining('Email notifications not yet implemented')
    )
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('evaluates request_volume even with zero requests', async () => {
    const rules = [
      {
        id: 'rule-1',
        agent_id: 'agent-1',
        rule_type: 'request_volume',
        threshold: 10, // Alert if requests < 10 (agent is idle)
        window_minutes: 60,
        comparison: 'lt',
        notification_channel: 'webhook',
        notification_target: 'https://example.com/webhook',
        cooldown_minutes: 60,
        consecutive_threshold: 1,
        consecutive_triggers: 0,
        last_triggered_at: null,
        severity: 'warning',
        name: 'Low Traffic Alert',
      },
    ]

    const metrics = [
      {
        total_requests: 0, // Zero requests
        success_count: 0,
        error_count: 0,
        blocked_count: 0,
        error_rate: 0,
        success_rate: 0,
        block_rate: 0,
        latency_p95: 0,
        latency_p99: 0,
      },
    ]

    mockFetch.mockResolvedValueOnce({ ok: true })

    const supabase = createMockSupabase({ rules, metrics })

    const result = await checkAgentAlertRules(supabase)

    // Should still evaluate request_volume even with 0 requests
    expect(result.rulesChecked).toBe(1)
    expect(result.alertsTriggered).toBe(1) // 0 < 10, so alert triggers
    expect(result.notificationsSent).toBe(1)
  })
})
