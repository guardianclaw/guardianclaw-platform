/**
 * Scheduled Workers (Cron Jobs)
 *
 * Handles periodic tasks for the admin system:
 * - Hourly metrics aggregation
 * - Daily metrics aggregation
 * - Platform summary refresh
 * - Old metrics cleanup
 * - Alert rule evaluation (admin-level and per-agent)
 *
 * Reference: ADMIN_SPEC Phase 8
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { processPendingDeliveries } from './services/webhook-delivery'
import { checkAgentAlertRules } from './services/agent-alerts'
import { finalizeProposal } from './routes/governance'

type Env = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  ENVIRONMENT: string
  SOLANA_RPC_URL?: string
  SOLANA_ARCHIVE_RPC_URL?: string
}

// Cron trigger configuration:
//
// "0 * * * *"      - Every hour at minute 0 (hourly aggregation)
// "5 * * * *"      - Every hour at minute 5 (platform summary refresh)
// "0 0 * * *"      - Daily at midnight UTC (daily aggregation)
// "0 1 * * *"      - Daily at 1 AM UTC (cleanup old metrics)
// "every 5 min"    - Every 5 minutes (alert rule check)

// Job registry for logging and tracking
const JOBS = {
  HOURLY_METRICS: 'aggregate_hourly_metrics',
  DAILY_METRICS: 'aggregate_daily_metrics',
  REFRESH_SUMMARY: 'refresh_platform_summary',
  CLEANUP_HOURLY: 'cleanup_old_hourly_metrics',
  CHECK_ALERTS: 'check_alert_rules',
  CHECK_AGENT_ALERTS: 'check_agent_alert_rules',
  PROCESS_DELIVERIES: 'process_webhook_deliveries',
  CLEANUP_DELIVERIES: 'cleanup_old_deliveries',
  FINALIZE_PROPOSALS: 'finalize_expired_proposals',
} as const

type JobName = (typeof JOBS)[keyof typeof JOBS]

interface JobResult {
  job: JobName
  success: boolean
  duration_ms: number
  error?: string
  details?: Record<string, unknown>
}

/**
 * Log job execution result.
 */
function logJobResult(result: JobResult): void {
  const level = result.success ? 'info' : 'error'
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      type: 'cron_job',
      ...result,
    })
  )
}

/**
 * Aggregate hourly metrics from agent_events.
 * Called every hour at minute 0.
 */
async function aggregateHourlyMetrics(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.HOURLY_METRICS

  try {
    // Calculate the hour we're aggregating (previous hour)
    const now = new Date()
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000)
    lastHour.setMinutes(0, 0, 0)
    const hourStart = lastHour.toISOString()
    const hourEnd = new Date(lastHour.getTime() + 60 * 60 * 1000).toISOString()

    // Query agent_events for the hour
    const { data: events, error: eventsError } = await supabase
      .from('agent_events')
      .select('claw_blocked, claw_gate, latency_ms')
      .gte('created_at', hourStart)
      .lt('created_at', hourEnd)

    if (eventsError) {
      throw new Error(`Failed to query events: ${eventsError.message}`)
    }

    // Calculate metrics
    const totalRequests = events?.length || 0
    const blockedEvents = events?.filter((e) => e.claw_blocked) || []
    const totalBlocked = blockedEvents.length

    // Calculate latency stats
    const latencies = events?.map((e) => e.latency_ms).filter((l) => l != null) || []
    const avgLatency =
      latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0
    const sortedLatencies = [...latencies].sort((a, b) => a - b)
    const p95Latency =
      sortedLatencies.length > 0
        ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0
        : 0

    // Count blocks by gate
    const gateBlocks = {
      credibility: 0,
      avoidance: 0,
      limits: 0,
      worth: 0,
    }

    for (const event of blockedEvents) {
      const gate = event.claw_gate?.toLowerCase() || ''
      if (gate.includes('credibility')) gateBlocks.credibility++
      else if (gate.includes('avoidance')) gateBlocks.avoidance++
      else if (gate.includes('limits')) gateBlocks.limits++
      else if (gate.includes('worth')) gateBlocks.worth++
    }

    // Upsert hourly metrics
    const { error: upsertError } = await supabase.from('metrics_hourly').upsert(
      {
        hour: hourStart,
        total_requests: totalRequests,
        total_blocked: totalBlocked,
        avg_latency_ms: avgLatency,
        p95_latency_ms: p95Latency,
        claw_truth_blocks: gateBlocks.credibility,
        claw_harm_blocks: gateBlocks.avoidance,
        claw_scope_blocks: gateBlocks.limits,
        claw_purpose_blocks: gateBlocks.worth,
        error_4xx: 0, // TODO: Track from API logs
        error_5xx: 0,
        rate_limit_hits: 0,
        auth_success: 0,
        auth_failure: 0,
      },
      {
        onConflict: 'hour',
      }
    )

    if (upsertError) {
      throw new Error(`Failed to upsert metrics: ${upsertError.message}`)
    }

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
      details: {
        hour: hourStart,
        total_requests: totalRequests,
        total_blocked: totalBlocked,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Aggregate daily metrics from various sources.
 * Called daily at midnight UTC.
 */
async function aggregateDailyMetrics(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.DAILY_METRICS

  try {
    // Calculate yesterday's date
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const dateStr = yesterday.toISOString().split('T')[0]
    const dayStart = `${dateStr}T00:00:00Z`
    const dayEnd = `${dateStr}T23:59:59Z`

    // Parallel queries for efficiency
    const [
      profilesResult,
      newUsersResult,
      activeUsersResult,
      agentsResult,
      newAgentsResult,
      deployedAgentsResult,
      usageResult,
      planDistResult,
      hourlyResult,
    ] = await Promise.all([
      // Total users (as of end of day)
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .lte('created_at', dayEnd),

      // New users that day
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd),

      // Active users (distinct wallets with requests)
      supabase
        .from('usage_daily')
        .select('wallet_address')
        .eq('date', dateStr)
        .gt('requests_count', 0),

      // Total agents
      supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'archived')
        .lte('created_at', dayEnd),

      // New agents
      supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd),

      // Deployed agents
      supabase
        .from('agents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'deployed')
        .lte('created_at', dayEnd),

      // Daily usage totals
      supabase.from('usage_daily').select('requests_count, blocked_count').eq('date', dateStr),

      // Plan distribution
      supabase.from('profiles').select('plan').lte('created_at', dayEnd),

      // Hourly metrics for that day (for claw blocks)
      supabase
        .from('metrics_hourly')
        .select('claw_truth_blocks, claw_harm_blocks, claw_scope_blocks, claw_purpose_blocks')
        .gte('hour', dayStart)
        .lte('hour', dayEnd),
    ])

    // Calculate active users (distinct)
    const activeWallets = new Set(activeUsersResult.data?.map((u) => u.wallet_address) || [])
    const activeUsers = activeWallets.size

    // Calculate usage totals
    let totalRequests = 0
    let totalBlocked = 0
    for (const usage of usageResult.data || []) {
      totalRequests += usage.requests_count || 0
      totalBlocked += usage.blocked_count || 0
    }

    // Calculate plan distribution
    const planCounts = { free: 0, starter: 0, pro: 0 }
    for (const profile of planDistResult.data || []) {
      const plan = profile.plan as keyof typeof planCounts
      if (plan in planCounts) {
        planCounts[plan]++
      }
    }

    // Calculate claw blocks from hourly data
    let truthBlocks = 0
    let harmBlocks = 0
    let scopeBlocks = 0
    let purposeBlocks = 0
    for (const hourly of hourlyResult.data || []) {
      truthBlocks += hourly.claw_truth_blocks || 0
      harmBlocks += hourly.claw_harm_blocks || 0
      scopeBlocks += hourly.claw_scope_blocks || 0
      purposeBlocks += hourly.claw_purpose_blocks || 0
    }

    // Upsert daily metrics
    const { error: upsertError } = await supabase.from('metrics_daily').upsert(
      {
        date: dateStr,
        total_users: profilesResult.count || 0,
        new_users: newUsersResult.count || 0,
        active_users: activeUsers,
        total_agents: agentsResult.count || 0,
        new_agents: newAgentsResult.count || 0,
        deployed_agents: deployedAgentsResult.count || 0,
        total_requests: totalRequests,
        total_blocked: totalBlocked,
        users_free: planCounts.free,
        users_starter: planCounts.starter,
        users_pro: planCounts.pro,
        claw_truth_blocks: truthBlocks,
        claw_harm_blocks: harmBlocks,
        claw_scope_blocks: scopeBlocks,
        claw_purpose_blocks: purposeBlocks,
      },
      {
        onConflict: 'date',
      }
    )

    if (upsertError) {
      throw new Error(`Failed to upsert daily metrics: ${upsertError.message}`)
    }

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
      details: {
        date: dateStr,
        total_users: profilesResult.count || 0,
        active_users: activeUsers,
        total_requests: totalRequests,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Refresh the platform summary materialized view.
 * Called every hour at minute 5.
 */
async function refreshPlatformSummary(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.REFRESH_SUMMARY

  try {
    // Call the refresh function
    const { error } = await supabase.rpc('refresh_platform_summary')

    if (error) {
      throw new Error(`Failed to refresh summary: ${error.message}`)
    }

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Clean up old hourly metrics (retain 7 days).
 * Called daily at 1 AM UTC.
 */
async function cleanupOldHourlyMetrics(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.CLEANUP_HOURLY

  try {
    // Calculate cutoff (7 days ago)
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Delete old records
    const { error, count } = await supabase
      .from('metrics_hourly')
      .delete({ count: 'exact' })
      .lt('hour', cutoff)

    if (error) {
      throw new Error(`Failed to cleanup: ${error.message}`)
    }

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
      details: {
        deleted_count: count || 0,
        cutoff,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check alert rules and create alerts if thresholds exceeded.
 * Called every 5 minutes.
 */
async function checkAlertRules(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.CHECK_ALERTS

  try {
    // Get all enabled rules
    const { data: rules, error: rulesError } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('is_enabled', true)

    if (rulesError) {
      throw new Error(`Failed to fetch rules: ${rulesError.message}`)
    }

    if (!rules || rules.length === 0) {
      return {
        job,
        success: true,
        duration_ms: Date.now() - startTime,
        details: { rules_checked: 0, alerts_created: 0 },
      }
    }

    // Get recent metrics for evaluation
    const windowStart = new Date(Date.now() - 60 * 60 * 1000).toISOString() // Last hour

    const { data: recentMetrics } = await supabase
      .from('metrics_hourly')
      .select('*')
      .gte('hour', windowStart)
      .order('hour', { ascending: false })
      .limit(12) // Up to 12 x 5-min windows

    // Calculate current metric values
    const metrics: Record<string, number> = {}

    if (recentMetrics && recentMetrics.length > 0) {
      const latest = recentMetrics[0]
      const totalRequests = latest.total_requests || 1 // Avoid division by zero

      metrics.error_rate =
        (((latest.error_4xx || 0) + (latest.error_5xx || 0)) / totalRequests) * 100
      metrics.p95_latency_ms = latest.p95_latency_ms || 0
      metrics.block_rate = ((latest.total_blocked || 0) / totalRequests) * 100
      metrics.rate_limit_hits = latest.rate_limit_hits || 0
      metrics.auth_failure = latest.auth_failure || 0
    }

    let alertsCreated = 0

    // Evaluate each rule
    for (const rule of rules) {
      const metricValue = metrics[rule.metric_name]

      if (metricValue === undefined) {
        continue // Metric not available
      }

      // Check condition
      let triggered = false
      switch (rule.condition) {
        case 'gt':
          triggered = metricValue > rule.threshold_value
          break
        case 'gte':
          triggered = metricValue >= rule.threshold_value
          break
        case 'lt':
          triggered = metricValue < rule.threshold_value
          break
        case 'lte':
          triggered = metricValue <= rule.threshold_value
          break
        case 'eq':
          triggered = metricValue === rule.threshold_value
          break
        case 'spike':
          // For spike detection, compare to previous period
          if (recentMetrics && recentMetrics.length > 1) {
            const _previous = recentMetrics[1]
            const prevValue = metrics[rule.metric_name] || 0
            const change = prevValue > 0 ? ((metricValue - prevValue) / prevValue) * 100 : 0
            triggered = change > rule.threshold_value
          }
          break
      }

      if (triggered) {
        // Check cooldown - don't create duplicate alerts
        const cooldownStart = new Date(Date.now() - rule.cooldown_minutes * 60 * 1000).toISOString()

        const { data: recentAlerts } = await supabase
          .from('alerts')
          .select('id')
          .eq('type', rule.metric_name)
          .gte('created_at', cooldownStart)
          .limit(1)

        if (recentAlerts && recentAlerts.length > 0) {
          continue // Still in cooldown
        }

        // Create alert
        const { error: alertError } = await supabase.from('alerts').insert({
          type: rule.metric_name,
          severity: rule.severity,
          title: rule.name,
          description: rule.description,
          metric_name: rule.metric_name,
          metric_value: metricValue,
          threshold_value: rule.threshold_value,
          status: 'active',
          metadata: {
            rule_id: rule.id,
            condition: rule.condition,
          },
        })

        if (!alertError) {
          alertsCreated++
        }
      }
    }

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
      details: {
        rules_checked: rules.length,
        alerts_created: alertsCreated,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Check per-agent alert rules and send notifications if thresholds exceeded.
 * Called every 5 minutes.
 */
async function checkAgentAlerts(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.CHECK_AGENT_ALERTS

  try {
    const result = await checkAgentAlertRules(supabase)

    return {
      job,
      success: result.errors.length === 0,
      duration_ms: Date.now() - startTime,
      details: {
        rules_checked: result.rulesChecked,
        alerts_triggered: result.alertsTriggered,
        notifications_sent: result.notificationsSent,
        errors: result.errors.length > 0 ? result.errors : undefined,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Aggregate revenue daily data.
 * Called daily at midnight UTC.
 */
async function aggregateDailyRevenue(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = 'aggregate_daily_revenue' as JobName

  try {
    // Calculate yesterday's date
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const dateStr = yesterday.toISOString().split('T')[0]
    const dayStart = `${dateStr}T00:00:00Z`
    const dayEnd = `${dateStr}T23:59:59Z`

    // Get subscriptions created that day
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('plan, payment_token, amount_lamports')
      .gte('created_at', dayStart)
      .lte('created_at', dayEnd)

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`)
    }

    // Aggregate by plan and token
    const aggregated: Record<string, { count: number; total: number }> = {}

    for (const sub of subscriptions || []) {
      const key = `${sub.plan}:${sub.payment_token}`
      if (!aggregated[key]) {
        aggregated[key] = { count: 0, total: 0 }
      }
      aggregated[key].count++
      aggregated[key].total += Number(sub.amount_lamports) || 0
    }

    // Upsert revenue records
    for (const [key, data] of Object.entries(aggregated)) {
      const [plan, token] = key.split(':')

      // Simple USD conversion (would use real price feed in production)
      // SOL ~$100, USDC ~$1, GCLAW ~$0.01 (placeholder)
      let usdEquivalent = 0
      if (token === 'SOL') {
        usdEquivalent = (data.total / 1e9) * 100 // lamports to SOL * $100
      } else if (token === 'USDC') {
        usdEquivalent = data.total / 1e6 // micro-USDC to USD
      } else if (token === 'GCLAW') {
        usdEquivalent = (data.total / 1e9) * 0.01 // placeholder
      }

      await supabase.from('revenue_daily').upsert(
        {
          date: dateStr,
          plan,
          payment_token: token,
          subscription_count: data.count,
          total_amount: data.total,
          usd_equivalent: usdEquivalent,
        },
        {
          onConflict: 'date,plan,payment_token',
        }
      )
    }

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
      details: {
        date: dateStr,
        records_created: Object.keys(aggregated).length,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Process pending webhook deliveries (retries).
 * Called every minute.
 */
async function processWebhookDeliveries(
  supabase: SupabaseClient,
  serverSecret: string
): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.PROCESS_DELIVERIES

  try {
    const result = await processPendingDeliveries(supabase, serverSecret, 100)

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
      details: {
        processed: result.processed,
        succeeded: result.succeeded,
        failed: result.failed,
        retrying: result.retrying,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Cleanup old delivery records (30 days retention).
 * Called daily at midnight UTC.
 */
async function cleanupOldDeliveries(supabase: SupabaseClient): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.CLEANUP_DELIVERIES

  try {
    // Call the cleanup function in the database
    const { data, error } = await supabase.rpc('cleanup_old_deliveries', {
      p_retention_days: 30,
    })

    if (error) {
      throw new Error(`Failed to cleanup deliveries: ${error.message}`)
    }

    return {
      job,
      success: true,
      duration_ms: Date.now() - startTime,
      details: {
        deleted_count: data || 0,
        retention_days: 30,
      },
    }
  } catch (error) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Main scheduled handler.
 * Routes cron triggers to appropriate job handlers.
 */
export async function scheduled(
  controller: ScheduledController,
  env: Env,
  _ctx: ExecutionContext
): Promise<void> {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

  // Determine which job to run based on cron schedule
  const cronPattern = controller.cron

  const results: JobResult[] = []

  switch (cronPattern) {
    case '* * * * *':
    case '*/1 * * * *':
      // Every minute - process pending webhook deliveries (retries)
      results.push(await processWebhookDeliveries(supabase, env.JWT_SECRET))
      break

    case '0 * * * *':
      // Every hour - hourly aggregation + refresh summary (consolidated)
      results.push(await aggregateHourlyMetrics(supabase))
      results.push(await refreshPlatformSummary(supabase))
      break

    case '0 0 * * *':
      // Daily at midnight - daily aggregation + revenue + cleanup + governance (consolidated)
      results.push(await aggregateDailyMetrics(supabase))
      results.push(await aggregateDailyRevenue(supabase))
      results.push(await cleanupOldHourlyMetrics(supabase))
      results.push(await cleanupOldDeliveries(supabase))
      results.push(await finalizeExpiredProposals(supabase, env.SOLANA_RPC_URL))
      break

    case '*/5 * * * *':
      // Every 5 minutes - alert checks (admin-level and per-agent)
      results.push(await checkAlertRules(supabase))
      results.push(await checkAgentAlerts(supabase))
      break

    default:
      // Unknown cron, run all jobs (for manual triggers)
      console.log(`Unknown cron pattern: ${cronPattern}, running health check only`)
      results.push({
        job: 'health_check' as JobName,
        success: true,
        duration_ms: 0,
        details: { cron: cronPattern },
      })
  }

  // Log all results
  for (const result of results) {
    logJobResult(result)
  }
}

/**
 * Finalize proposals whose voting period has ended.
 * Called daily at midnight. Uses shared finalizeProposal() logic.
 */
async function finalizeExpiredProposals(
  supabase: SupabaseClient,
  rpcUrl?: string
): Promise<JobResult> {
  const startTime = Date.now()
  const job = JOBS.FINALIZE_PROPOSALS

  try {
    const now = new Date().toISOString()

    // Find all proposals in 'voting' status with expired voting period
    const { data: expiredProposals, error: queryError } = await supabase
      .from('proposals')
      .select('*')
      .eq('status', 'voting')
      .lt('voting_end_at', now)

    if (queryError) {
      throw new Error(`Failed to query expired proposals: ${queryError.message}`)
    }

    if (!expiredProposals || expiredProposals.length === 0) {
      return {
        job,
        success: true,
        duration_ms: Date.now() - startTime,
        details: { proposals_finalized: 0 },
      }
    }

    let finalized = 0
    let errors = 0
    const results: Array<{ id: string; status: string; error?: string }> = []

    for (const proposal of expiredProposals) {
      try {
        const result = await finalizeProposal(supabase, proposal, rpcUrl)
        const finalStatus = (result.proposal as Record<string, unknown>).status as string
        results.push({ id: proposal.id, status: finalStatus })
        finalized++
        console.log(
          `[cron] Finalized proposal ${proposal.id} → ${finalStatus} (supply: ${result.details.supply_source})`
        )
      } catch (err) {
        errors++
        const msg = err instanceof Error ? err.message : 'Unknown error'
        results.push({ id: proposal.id, status: 'error', error: msg })
        console.error(`[cron] Failed to finalize proposal ${proposal.id}:`, msg)
      }
    }

    return {
      job,
      success: errors === 0,
      duration_ms: Date.now() - startTime,
      details: {
        proposals_found: expiredProposals.length,
        proposals_finalized: finalized,
        proposals_errors: errors,
        results,
      },
    }
  } catch (err) {
    return {
      job,
      success: false,
      duration_ms: Date.now() - startTime,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

// Export individual job functions for testing
export {
  aggregateHourlyMetrics,
  aggregateDailyMetrics,
  refreshPlatformSummary,
  cleanupOldHourlyMetrics,
  checkAlertRules,
  checkAgentAlerts,
  aggregateDailyRevenue,
  processWebhookDeliveries,
  cleanupOldDeliveries,
  finalizeExpiredProposals,
}
