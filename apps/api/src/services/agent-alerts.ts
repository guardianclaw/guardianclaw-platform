/**
 * Agent Alerts Evaluation Service
 *
 * Evaluates per-agent alert rules and sends notifications when thresholds are exceeded.
 * This is called by the scheduled worker every 5 minutes.
 *
 * NOTE: This is DISTINCT from the admin-level alert system (checkAlertRules in scheduled.ts).
 * - Admin alerts: Platform-wide monitoring (error_rate, p95_latency across ALL agents)
 * - Agent alerts: Per-agent monitoring (specific agent metrics, user-configurable)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { checkUrlOrLog } from '../lib/ssrf-guard'
import { createSecureLogger, type SecureLogger } from '../lib/secure-logger'

// Rule types matching the database schema
type RuleType =
  | 'error_rate'
  | 'latency_p95'
  | 'latency_p99'
  | 'block_rate'
  | 'success_rate'
  | 'request_volume'

type Comparison = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'
type NotificationChannel = 'email' | 'webhook' | 'slack'

interface AgentAlertRule {
  id: string
  agent_id: string
  rule_type: RuleType
  threshold: number
  window_minutes: number
  comparison: Comparison
  notification_channel: NotificationChannel
  notification_target: string
  cooldown_minutes: number
  consecutive_threshold: number
  consecutive_triggers: number
  last_triggered_at: string | null
  severity: string
  name: string
}

interface AgentMetrics {
  total_requests: number
  success_count: number
  error_count: number
  blocked_count: number
  error_rate: number
  success_rate: number
  block_rate: number
  latency_p95: number
  latency_p99: number
}

export interface CheckAgentAlertsResult {
  rulesChecked: number
  alertsTriggered: number
  notificationsSent: number
  errors: string[]
}

/**
 * Compare a metric value against a threshold using the specified comparison operator.
 */
function evaluateCondition(value: number, threshold: number, comparison: Comparison): boolean {
  switch (comparison) {
    case 'gt':
      return value > threshold
    case 'gte':
      return value >= threshold
    case 'lt':
      return value < threshold
    case 'lte':
      return value <= threshold
    case 'eq':
      return value === threshold
    default:
      return false
  }
}

/**
 * Get the metric value from the metrics object based on the rule type.
 */
function getMetricValue(metrics: AgentMetrics, ruleType: RuleType): number {
  switch (ruleType) {
    case 'error_rate':
      return metrics.error_rate
    case 'latency_p95':
      return metrics.latency_p95
    case 'latency_p99':
      return metrics.latency_p99
    case 'block_rate':
      return metrics.block_rate
    case 'success_rate':
      return metrics.success_rate
    case 'request_volume':
      return metrics.total_requests
    default:
      return 0
  }
}

/**
 * Format a human-readable description of the alert condition.
 */
function formatAlertMessage(rule: AgentAlertRule, metricValue: number, agentName?: string): string {
  const comparisonText: Record<Comparison, string> = {
    gt: 'exceeded',
    gte: 'reached or exceeded',
    lt: 'fell below',
    lte: 'is at or below',
    eq: 'equals',
  }

  const unitText: Record<RuleType, string> = {
    error_rate: '%',
    latency_p95: 'ms',
    latency_p99: 'ms',
    block_rate: '%',
    success_rate: '%',
    request_volume: ' requests',
  }

  const agent = agentName ? ` for agent "${agentName}"` : ''

  return (
    `Alert: ${rule.name}${agent}\n` +
    `${rule.rule_type.replace(/_/g, ' ')} ${comparisonText[rule.comparison]} threshold.\n` +
    `Current: ${metricValue.toFixed(2)}${unitText[rule.rule_type]}\n` +
    `Threshold: ${rule.threshold}${unitText[rule.rule_type]}\n` +
    `Severity: ${rule.severity.toUpperCase()}`
  )
}

/**
 * Send a notification for a triggered alert.
 *
 * SSRF guard runs before every outbound fetch as defense-in-depth — schema-time
 * validation in `routes/alerts.ts` is the primary boundary; this protects
 * against rows that were mutated outside that path. The optional `logger`
 * argument lets callers attach the env-bound IP_HASH_SECRET; the default-built
 * logger is fine for the structured ssrf_blocked event since no IP is hashed
 * in this path.
 */
async function sendNotification(
  rule: AgentAlertRule,
  metricValue: number,
  agentName?: string,
  logger: SecureLogger = createSecureLogger()
): Promise<{ sent: boolean; error?: string }> {
  const message = formatAlertMessage(rule, metricValue, agentName)

  if (rule.notification_channel === 'webhook' || rule.notification_channel === 'slack') {
    const urlCheck = await checkUrlOrLog(
      rule.notification_target,
      { surface: 'agent-alerts.deliver' },
      logger
    )
    if (!urlCheck.valid) {
      return { sent: false, error: urlCheck.error || 'Notification target is not allowed' }
    }
  }

  try {
    if (rule.notification_channel === 'webhook') {
      const response = await fetch(rule.notification_target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'agent_alert',
          alert_rule_id: rule.id,
          agent_id: rule.agent_id,
          rule_name: rule.name,
          rule_type: rule.rule_type,
          severity: rule.severity,
          metric_value: metricValue,
          threshold: rule.threshold,
          comparison: rule.comparison,
          message,
          timestamp: new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        return { sent: false, error: `Webhook returned status ${response.status}` }
      }
      return { sent: true }
    }

    if (rule.notification_channel === 'slack') {
      const severityEmoji: Record<string, string> = {
        info: 'ℹ️',
        warning: '⚠️',
        critical: '🚨',
      }

      const response = await fetch(rule.notification_target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${severityEmoji[rule.severity] || '⚠️'} *${rule.name}*\n${message}`,
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${severityEmoji[rule.severity] || '⚠️'} Alert: ${rule.name}`,
                emoji: true,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Metric:*\n${rule.rule_type.replace(/_/g, ' ')}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Severity:*\n${rule.severity.toUpperCase()}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Current Value:*\n${metricValue.toFixed(2)}`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Threshold:*\n${rule.threshold}`,
                },
              ],
            },
          ],
        }),
      })

      if (!response.ok) {
        return { sent: false, error: `Slack webhook returned status ${response.status}` }
      }
      return { sent: true }
    }

    if (rule.notification_channel === 'email') {
      // Email not yet implemented - would require email service integration
      return { sent: false, error: 'Email notifications not yet implemented' }
    }

    return { sent: false, error: `Unknown notification channel: ${rule.notification_channel}` }
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : 'Unknown notification error',
    }
  }
}

/**
 * Check if an alert is still in cooldown period.
 */
function isInCooldown(rule: AgentAlertRule): boolean {
  if (!rule.last_triggered_at || rule.cooldown_minutes === 0) {
    return false
  }

  const lastTriggered = new Date(rule.last_triggered_at).getTime()
  const cooldownMs = rule.cooldown_minutes * 60 * 1000
  const now = Date.now()

  return now - lastTriggered < cooldownMs
}

/**
 * Main function to check all agent alert rules.
 * Called by the scheduled worker every 5 minutes.
 */
export async function checkAgentAlertRules(
  supabase: SupabaseClient
): Promise<CheckAgentAlertsResult> {
  const result: CheckAgentAlertsResult = {
    rulesChecked: 0,
    alertsTriggered: 0,
    notificationsSent: 0,
    errors: [],
  }

  try {
    // Get all rules that need checking (active rules not checked in the last 5 minutes)
    const { data: rules, error: rulesError } = await supabase.rpc('get_agent_alerts_to_check', {
      p_check_interval_minutes: 5,
    })

    if (rulesError) {
      result.errors.push(`Failed to fetch rules: ${rulesError.message}`)
      return result
    }

    if (!rules || rules.length === 0) {
      return result
    }

    // Group rules by agent_id for efficient metric fetching
    const rulesByAgent = new Map<string, AgentAlertRule[]>()
    for (const rule of rules as AgentAlertRule[]) {
      const existing = rulesByAgent.get(rule.agent_id) || []
      existing.push(rule)
      rulesByAgent.set(rule.agent_id, existing)
    }

    // Process each agent's rules
    for (const [agentId, agentRules] of rulesByAgent) {
      // Get the maximum window needed for this agent
      const maxWindow = Math.max(...agentRules.map((r) => r.window_minutes))

      // Fetch metrics for this agent
      const { data: metrics, error: metricsError } = await supabase.rpc(
        'get_agent_metrics_for_alerts',
        { p_agent_id: agentId, p_window_minutes: maxWindow }
      )

      if (metricsError || !metrics || metrics.length === 0) {
        result.errors.push(
          `Failed to fetch metrics for agent ${agentId}: ${metricsError?.message || 'No data'}`
        )
        // Update last_checked_at to avoid re-checking immediately
        for (const rule of agentRules) {
          await supabase.rpc('reset_agent_alert_consecutive', {
            p_alert_rule_id: rule.id,
            p_current_value: 0,
          })
        }
        continue
      }

      const agentMetrics = metrics[0] as AgentMetrics

      // Get agent name for notifications
      const { data: agent } = await supabase
        .from('agents')
        .select('name')
        .eq('id', agentId)
        .single()

      const agentName = agent?.name

      // Evaluate each rule for this agent
      for (const rule of agentRules) {
        result.rulesChecked++

        // If no requests in window, skip rule evaluation
        if (agentMetrics.total_requests === 0 && rule.rule_type !== 'request_volume') {
          await supabase.rpc('reset_agent_alert_consecutive', {
            p_alert_rule_id: rule.id,
            p_current_value: 0,
          })
          continue
        }

        const metricValue = getMetricValue(agentMetrics, rule.rule_type)
        const isTriggered = evaluateCondition(metricValue, rule.threshold, rule.comparison)

        if (isTriggered) {
          // Condition is triggered
          const newConsecutive = rule.consecutive_triggers + 1

          if (newConsecutive >= rule.consecutive_threshold && !isInCooldown(rule)) {
            // Threshold reached and not in cooldown - send notification
            result.alertsTriggered++

            const { sent, error: notifyError } = await sendNotification(
              rule,
              metricValue,
              agentName
            )

            // Record the trigger in history
            const { error: recordError } = await supabase.rpc('record_agent_alert_trigger', {
              p_alert_rule_id: rule.id,
              p_metric_value: metricValue,
              p_notification_sent: sent,
              p_notification_error: notifyError || null,
              p_metadata: {
                agent_name: agentName,
                total_requests: agentMetrics.total_requests,
                window_minutes: rule.window_minutes,
              },
            })

            if (recordError) {
              result.errors.push(
                `Failed to record trigger for rule ${rule.id}: ${recordError.message}`
              )
            }

            if (sent) {
              result.notificationsSent++
            } else if (notifyError) {
              result.errors.push(`Notification failed for rule ${rule.id}: ${notifyError}`)
            }
          } else {
            // Increment consecutive triggers but don't send notification yet
            await supabase
              .from('agent_alert_rules')
              .update({
                consecutive_triggers: newConsecutive,
                last_value: metricValue,
                last_checked_at: new Date().toISOString(),
              })
              .eq('id', rule.id)
          }
        } else {
          // Condition is not triggered - reset consecutive counter
          await supabase.rpc('reset_agent_alert_consecutive', {
            p_alert_rule_id: rule.id,
            p_current_value: metricValue,
          })
        }
      }
    }
  } catch (err) {
    result.errors.push(`Unexpected error: ${err instanceof Error ? err.message : 'Unknown'}`)
  }

  return result
}
