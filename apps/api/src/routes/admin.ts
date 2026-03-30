/**
 * Admin Routes
 *
 * Platform administration endpoints for dashboards, user management,
 * alerts, and metrics. Requires admin role.
 *
 * Reference: ADMIN_SPEC Phase 8
 */

import { Hono } from 'hono'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import {
  adminAuthMiddleware,
  requireRole,
  requireDashboard,
  requireAction,
  type AdminRole,
} from '../middleware/admin-auth'
import { adminAuditMiddleware } from '../middleware/admin-audit'
import { adminCreditsRoutes } from './admin-credits'
import { adminAgentsRoutes } from './admin-agents'
import { adminDeploymentsRoutes } from './admin-deployments'
import { adminGovernanceRoutes } from './admin-governance'
import { adminComplianceRoutes } from './admin-compliance'
import { adminSystemRoutes } from './admin-system'
import { adminAuditRoutes } from './admin-audit'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  JWT_SECRET: string
  JWT_ES256_PRIVATE_KEY?: string
  JWT_ES256_PUBLIC_KEY?: string
  RATE_LIMIT_KV?: KVNamespace
  IP_HASH_SECRET?: string
}

type Variables = {
  wallet: string
  plan: string
  adminRole: AdminRole
  adminPermissions: {
    dashboards: string[]
    actions: string[]
  }
  walletHash: string
  requestId?: string
}

export const adminRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Mount admin sub-routes
adminRoutes.route('/credits', adminCreditsRoutes)
adminRoutes.route('/agents', adminAgentsRoutes)
adminRoutes.route('/deployments', adminDeploymentsRoutes)
adminRoutes.route('/governance', adminGovernanceRoutes)
adminRoutes.route('/compliance', adminComplianceRoutes)
adminRoutes.route('/system', adminSystemRoutes)
adminRoutes.route('/audit', adminAuditRoutes)

// ============================================
// VALIDATION SCHEMAS
// ============================================

// User search query schema
const userSearchSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100, 'Query too long'),
  limit: z.coerce.number().min(1).max(50).default(20),
})

// Alert update schema
const updateAlertSchema = z.object({
  status: z.enum(['acknowledged', 'resolved'], {
    errorMap: () => ({ message: 'Status must be "acknowledged" or "resolved"' }),
  }),
  resolution_notes: z.string().max(1000, 'Resolution notes too long').optional(),
})

// Alert rule create schema
const createRuleSchema = z.object({
  name: z.string().min(1, 'Rule name is required').max(100, 'Rule name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  metric_name: z.string().min(1, 'Metric name is required').max(50, 'Metric name too long'),
  condition: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'spike'], {
    errorMap: () => ({ message: 'Invalid condition. Must be: gt, lt, gte, lte, eq, or spike' }),
  }),
  threshold_value: z.number({
    required_error: 'Threshold value is required',
    invalid_type_error: 'Threshold must be a number',
  }),
  window_minutes: z
    .number()
    .int('Window must be an integer')
    .min(1, 'Window must be at least 1 minute')
    .max(1440, 'Window cannot exceed 24 hours')
    .default(5),
  severity: z.enum(['info', 'warning', 'critical'], {
    errorMap: () => ({ message: 'Severity must be: info, warning, or critical' }),
  }),
  cooldown_minutes: z
    .number()
    .int('Cooldown must be an integer')
    .min(1, 'Cooldown must be at least 1 minute')
    .max(1440, 'Cooldown cannot exceed 24 hours')
    .default(15),
  is_enabled: z.boolean().default(true),
})

// Alert rule update schema (all fields optional)
const updateRuleSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    metric_name: z.string().min(1).max(50).optional(),
    condition: z.enum(['gt', 'lt', 'gte', 'lte', 'eq', 'spike']).optional(),
    threshold_value: z.number().optional(),
    window_minutes: z.number().int().min(1).max(1440).optional(),
    severity: z.enum(['info', 'warning', 'critical']).optional(),
    cooldown_minutes: z.number().int().min(1).max(1440).optional(),
    is_enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

// Admin role create schema
const createRoleSchema = z.object({
  wallet_address: z
    .string()
    .min(32, 'Invalid wallet address')
    .max(64, 'Invalid wallet address')
    .regex(/^[A-Za-z0-9]+$/, 'Invalid wallet address format'),
  role: z.enum(['super_admin', 'admin', 'support', 'viewer'], {
    errorMap: () => ({ message: 'Role must be: super_admin, admin, support, or viewer' }),
  }),
  permissions: z
    .object({
      dashboards: z.array(z.string()).optional(),
      actions: z.array(z.string()).optional(),
    })
    .optional(),
})

// Admin role update schema
const updateRoleSchema = z
  .object({
    role: z.enum(['super_admin', 'admin', 'support', 'viewer']).optional(),
    permissions: z
      .object({
        dashboards: z.array(z.string()).optional(),
        actions: z.array(z.string()).optional(),
      })
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  })

// Apply admin auth and audit to all routes
adminRoutes.use('*', adminAuthMiddleware)
adminRoutes.use('*', adminAuditMiddleware)

// ============================================
// AUTH VERIFICATION
// ============================================

/**
 * GET /admin/auth/verify
 *
 * Verify admin access and return role/permissions.
 * Used by frontend to check admin status on load.
 */
adminRoutes.get('/auth/verify', async (c) => {
  const role = c.get('adminRole')
  const permissions = c.get('adminPermissions')
  const walletHash = c.get('walletHash')

  return c.json({
    verified: true,
    role,
    permissions,
    walletHash: walletHash.substring(0, 8) + '...',
  })
})

// ============================================
// METRICS: OVERVIEW DASHBOARD
// ============================================

interface PlatformOverview {
  users: {
    total: number
    active: number
    new_today: number
    by_plan: {
      free: number
      starter: number
      pro: number
    }
  }
  agents: {
    total: number
    deployed: number
    new_today: number
  }
  requests: {
    today: number
    blocked_today: number
    block_rate: number
  }
  alerts: {
    active: number
    critical: number
  }
  revenue: {
    mtd_usd: number
    mrr_estimated: number
  }
}

/**
 * GET /admin/metrics/overview
 *
 * Platform summary for main admin dashboard.
 * Aggregates key metrics across all areas.
 */
adminRoutes.get('/metrics/overview', requireDashboard('overview'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const today = new Date().toISOString().split('T')[0]
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().split('T')[0]

  // Parallel queries for performance
  const [
    usersResult,
    usersByPlanResult,
    newUsersResult,
    agentsResult,
    deployedAgentsResult,
    newAgentsResult,
    requestsTodayResult,
    alertsResult,
    revenueResult,
  ] = await Promise.all([
    // Total users
    supabase.from('profiles').select('*', { count: 'exact', head: true }),

    // Users by plan
    supabase.from('profiles').select('plan'),

    // New users today
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`),

    // Total agents
    supabase.from('agents').select('*', { count: 'exact', head: true }).neq('status', 'archived'),

    // Deployed agents
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'deployed'),

    // New agents today
    supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', `${today}T00:00:00Z`),

    // Requests today (from usage_daily) - include wallet for active user counting
    supabase
      .from('usage_daily')
      .select('wallet_address, requests_count, blocked_count')
      .eq('date', today),

    // Active alerts
    supabase.from('alerts').select('severity').eq('status', 'active'),

    // Revenue this month (from revenue_daily)
    supabase.from('revenue_daily').select('usd_equivalent').gte('date', monthStartStr),
  ])

  // Calculate user counts by plan
  const planCounts = { free: 0, starter: 0, pro: 0 }
  if (usersByPlanResult.data) {
    for (const user of usersByPlanResult.data) {
      const plan = user.plan as keyof typeof planCounts
      if (plan in planCounts) {
        planCounts[plan]++
      }
    }
  }

  // Calculate request totals
  let requestsToday = 0
  let blockedToday = 0
  if (requestsTodayResult.data) {
    for (const usage of requestsTodayResult.data) {
      requestsToday += usage.requests_count || 0
      blockedToday += usage.blocked_count || 0
    }
  }

  // Calculate alert counts
  let activeAlerts = 0
  let criticalAlerts = 0
  if (alertsResult.data) {
    activeAlerts = alertsResult.data.length
    criticalAlerts = alertsResult.data.filter((a) => a.severity === 'critical').length
  }

  // Calculate revenue
  let mtdUsd = 0
  if (revenueResult.data) {
    for (const rev of revenueResult.data) {
      mtdUsd += rev.usd_equivalent || 0
    }
  }

  // Estimate MRR (simplified: MTD * days remaining ratio)
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const dayOfMonth = new Date().getDate()
  const mrrEstimated = dayOfMonth > 0 ? (mtdUsd / dayOfMonth) * daysInMonth : 0

  // Calculate active users from today's usage
  const activeUsersSet = new Set<string>()
  if (requestsTodayResult.data) {
    // Active users = users with at least 1 request today
    // Note: usage_daily has wallet_address column
    for (const usage of requestsTodayResult.data as Array<{
      wallet_address?: string
      requests_count: number
    }>) {
      if (usage.wallet_address && usage.requests_count > 0) {
        activeUsersSet.add(usage.wallet_address)
      }
    }
  }

  const overview: PlatformOverview = {
    users: {
      total: usersResult.count || 0,
      active: activeUsersSet.size,
      new_today: newUsersResult.count || 0,
      by_plan: planCounts,
    },
    agents: {
      total: agentsResult.count || 0,
      deployed: deployedAgentsResult.count || 0,
      new_today: newAgentsResult.count || 0,
    },
    requests: {
      today: requestsToday,
      blocked_today: blockedToday,
      block_rate:
        requestsToday > 0 ? parseFloat(((blockedToday / requestsToday) * 100).toFixed(2)) : 0,
    },
    alerts: {
      active: activeAlerts,
      critical: criticalAlerts,
    },
    revenue: {
      mtd_usd: parseFloat(mtdUsd.toFixed(2)),
      mrr_estimated: parseFloat(mrrEstimated.toFixed(2)),
    },
  }

  return c.json(overview)
})

// ============================================
// METRICS: OPERATIONS DASHBOARD
// ============================================

interface OperationsMetrics {
  health: {
    status: 'healthy' | 'degraded' | 'down'
    uptime_percent: number | null
    last_incident: string | null
  }
  latency: {
    current_avg_ms: number
    current_p95_ms: number
    trend: 'improving' | 'stable' | 'degrading'
  }
  errors: {
    rate_percent: number
    count_today: number
    by_type: Record<string, number>
  }
  throughput: {
    requests_per_minute: number
    peak_rpm_today: number
  }
  hourly: Array<{
    hour: string
    requests: number
    errors: number
    avg_latency_ms: number
    blocked: number
  }>
}

/**
 * GET /admin/metrics/operations
 *
 * Real-time operations metrics for health monitoring.
 * Includes latency, errors, throughput, and hourly breakdown.
 */
adminRoutes.get('/metrics/operations', requireDashboard('operations'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Get hourly metrics for last 24 hours
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: hourlyData } = await supabase
    .from('metrics_hourly')
    .select('*')
    .gte('hour', yesterday.toISOString())
    .order('hour', { ascending: true })

  // Calculate current metrics from last hour
  const lastHour = hourlyData?.slice(-1)[0]
  const previousHour = hourlyData?.slice(-2, -1)[0]

  // Build hourly array
  const hourly = (hourlyData || []).map((h) => ({
    hour: h.hour,
    requests: h.total_requests || 0,
    errors: (h.error_4xx || 0) + (h.error_5xx || 0),
    avg_latency_ms: h.avg_latency_ms || 0,
    blocked: h.total_blocked || 0,
  }))

  // Calculate totals for today
  const today = new Date().toISOString().split('T')[0]
  const todayData = (hourlyData || []).filter((h) => h.hour.startsWith(today))

  let totalRequests = 0
  let totalErrors = 0
  let _totalLatency = 0
  let peakRpm = 0

  for (const h of todayData) {
    const requests = h.total_requests || 0
    totalRequests += requests
    totalErrors += (h.error_4xx || 0) + (h.error_5xx || 0)
    _totalLatency += (h.avg_latency_ms || 0) * requests
    // Estimate RPM from hourly (rough: requests/60)
    const rpm = requests / 60
    if (rpm > peakRpm) peakRpm = rpm
  }

  // Determine latency trend
  let trend: 'improving' | 'stable' | 'degrading' = 'stable'
  if (lastHour && previousHour) {
    const diff = (lastHour.avg_latency_ms || 0) - (previousHour.avg_latency_ms || 0)
    if (diff > 50) trend = 'degrading'
    else if (diff < -50) trend = 'improving'
  }

  // Calculate health status
  const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0
  let healthStatus: 'healthy' | 'degraded' | 'down' = 'healthy'
  if (errorRate > 5) healthStatus = 'degraded'
  if (errorRate > 20) healthStatus = 'down'

  // Calculate uptime from error rate (simplified: 100% - error_rate for 5xx errors)
  // Real uptime tracking would require a separate incidents table
  const error5xxRate =
    totalRequests > 0
      ? (todayData.reduce((sum, h) => sum + (h.error_5xx || 0), 0) / totalRequests) * 100
      : 0
  const uptimePercent = totalRequests > 0 ? parseFloat((100 - error5xxRate).toFixed(2)) : null

  // Get last critical alert as last incident
  const { data: lastIncident } = await supabase
    .from('alerts')
    .select('created_at, title')
    .eq('severity', 'critical')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const operations: OperationsMetrics = {
    health: {
      status: healthStatus,
      uptime_percent: uptimePercent,
      last_incident: lastIncident?.created_at || null,
    },
    latency: {
      current_avg_ms: lastHour?.avg_latency_ms || 0,
      current_p95_ms: lastHour?.p95_latency_ms || 0,
      trend,
    },
    errors: {
      rate_percent: parseFloat(errorRate.toFixed(2)),
      count_today: totalErrors,
      by_type: {
        '4xx': todayData.reduce((sum, h) => sum + (h.error_4xx || 0), 0),
        '5xx': todayData.reduce((sum, h) => sum + (h.error_5xx || 0), 0),
      },
    },
    throughput: {
      requests_per_minute: lastHour ? Math.round((lastHour.total_requests || 0) / 60) : 0,
      peak_rpm_today: Math.round(peakRpm),
    },
    hourly,
  }

  return c.json(operations)
})

// ============================================
// METRICS: BUSINESS DASHBOARD
// ============================================

interface BusinessMetrics {
  growth: {
    dau: number
    wau: number
    mau: number
    dau_mau_ratio: number
  }
  retention: {
    d1: number | null
    d7: number | null
    d30: number | null
    note: string
  }
  engagement: {
    avg_agents_per_user: number
    avg_requests_per_user: number
  }
  daily: Array<{
    date: string
    new_users: number
    active_users: number
    requests: number
  }>
}

/**
 * GET /admin/metrics/business
 *
 * Business metrics: growth, retention, engagement.
 */
adminRoutes.get('/metrics/business', requireDashboard('business'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Get daily metrics for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: dailyData } = await supabase
    .from('metrics_daily')
    .select('*')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })

  // Get latest metrics
  const latest = dailyData?.slice(-1)[0]

  // Build daily array
  const daily = (dailyData || []).map((d) => ({
    date: d.date,
    new_users: d.new_users || 0,
    active_users: d.active_users || 0,
    requests: Number(d.total_requests) || 0,
  }))

  // Calculate DAU (today's active users)
  const dau = latest?.active_users || 0

  // Calculate WAU (distinct active users over last 7 days)
  // Sum all active_users from last 7 days, capped at total users
  const last7Days = dailyData?.slice(-7) || []
  const wauSum = last7Days.reduce((sum, d) => sum + (d.active_users || 0), 0)
  // WAU is approximately the average daily active * overlap factor
  // Using a conservative estimate: unique users ~ sum / days * 1.5 (accounting for repeat users)
  const wau = Math.min(
    Math.round((wauSum / Math.max(last7Days.length, 1)) * 2),
    latest?.total_users || 0
  )

  // Calculate MAU (distinct active users over last 30 days)
  const mauSum = (dailyData || []).reduce((sum, d) => sum + (d.active_users || 0), 0)
  const mau = Math.min(
    Math.round((mauSum / Math.max(dailyData?.length || 1, 1)) * 3),
    latest?.total_users || 0
  )

  // Calculate engagement
  const totalUsers = latest?.total_users || 1
  const totalAgents = latest?.total_agents || 0
  const totalRequests = Number(latest?.total_requests) || 0

  // Retention calculation requires cohort data
  // For now, we calculate a simple approximation based on returning users
  // Real implementation would require tracking user cohorts by signup date
  let d1Retention: number | null = null
  let d7Retention: number | null = null
  const d30Retention: number | null = null

  // If we have enough data, calculate approximate retention
  if (dailyData && dailyData.length >= 2) {
    const yesterday = dailyData[dailyData.length - 2]
    const today = dailyData[dailyData.length - 1]
    // D1 approximation: active users today / new users yesterday
    if (yesterday?.new_users && yesterday.new_users > 0 && today?.active_users) {
      // This is an approximation - real retention needs cohort tracking
      d1Retention = Math.min(
        100,
        parseFloat(((today.active_users / yesterday.new_users) * 100).toFixed(1))
      )
    }
  }

  if (dailyData && dailyData.length >= 8) {
    const weekAgo = dailyData[dailyData.length - 8]
    const today = dailyData[dailyData.length - 1]
    if (weekAgo?.new_users && weekAgo.new_users > 0 && today?.active_users) {
      d7Retention = Math.min(
        100,
        parseFloat((((today.active_users * 0.3) / weekAgo.new_users) * 100).toFixed(1))
      )
    }
  }

  const business: BusinessMetrics = {
    growth: {
      dau,
      wau,
      mau,
      dau_mau_ratio: mau > 0 ? parseFloat(((dau / mau) * 100).toFixed(1)) : 0,
    },
    retention: {
      d1: d1Retention,
      d7: d7Retention,
      d30: d30Retention,
      note: 'Retention metrics require cohort analysis. Values shown are approximations based on active user trends.',
    },
    engagement: {
      avg_agents_per_user: parseFloat((totalAgents / totalUsers).toFixed(2)),
      avg_requests_per_user: parseFloat((totalRequests / totalUsers).toFixed(0)),
    },
    daily,
  }

  return c.json(business)
})

// ============================================
// METRICS: FINANCIAL DASHBOARD
// ============================================

interface FinancialMetrics {
  revenue: {
    mtd_usd: number
    last_month_usd: number
    mrr: number
    arr: number
  }
  subscriptions: {
    total_active: number
    new_this_month: number
    churned_this_month: number
    churn_rate: number
  }
  arpu: number
  by_plan: Record<string, { count: number; revenue_usd: number }>
  by_token: Record<string, { count: number; revenue_usd: number }>
  daily: Array<{
    date: string
    revenue_usd: number
    new_subs: number
  }>
}

/**
 * GET /admin/metrics/financial
 *
 * Financial metrics: revenue, MRR, churn, ARPU.
 */
adminRoutes.get('/metrics/financial', requireDashboard('financial'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)

  // Get revenue data
  const [currentMonthRev, lastMonthRev, subscriptions] = await Promise.all([
    supabase.from('revenue_daily').select('*').gte('date', monthStart.toISOString().split('T')[0]),

    supabase
      .from('revenue_daily')
      .select('*')
      .gte('date', lastMonthStart.toISOString().split('T')[0])
      .lte('date', lastMonthEnd.toISOString().split('T')[0]),

    supabase.from('subscriptions').select('*').eq('status', 'active'),
  ])

  // Calculate totals
  let mtdUsd = 0
  let lastMonthUsd = 0
  const byPlan: Record<string, { count: number; revenue_usd: number }> = {}
  const byToken: Record<string, { count: number; revenue_usd: number }> = {}

  for (const rev of currentMonthRev.data || []) {
    mtdUsd += rev.usd_equivalent || 0

    if (!byPlan[rev.plan]) byPlan[rev.plan] = { count: 0, revenue_usd: 0 }
    byPlan[rev.plan].count += rev.subscription_count || 0
    byPlan[rev.plan].revenue_usd += rev.usd_equivalent || 0

    if (!byToken[rev.payment_token]) byToken[rev.payment_token] = { count: 0, revenue_usd: 0 }
    byToken[rev.payment_token].count += rev.subscription_count || 0
    byToken[rev.payment_token].revenue_usd += rev.usd_equivalent || 0
  }

  for (const rev of lastMonthRev.data || []) {
    lastMonthUsd += rev.usd_equivalent || 0
  }

  // Calculate MRR (using active subscriptions)
  const activeCount = subscriptions.data?.length || 0
  const avgSubscriptionValue = activeCount > 0 && mtdUsd > 0 ? mtdUsd / activeCount : 0
  const mrr = activeCount * avgSubscriptionValue

  // Build daily array first (needed for churn calculation)
  const dailyMap = new Map<string, { revenue_usd: number; new_subs: number }>()
  for (const rev of currentMonthRev.data || []) {
    const existing = dailyMap.get(rev.date) || { revenue_usd: 0, new_subs: 0 }
    existing.revenue_usd += rev.usd_equivalent || 0
    existing.new_subs += rev.subscription_count || 0
    dailyMap.set(rev.date, existing)
  }

  const daily = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Calculate month boundaries for churn query
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)

  // Calculate churn (subscriptions that expired this month and weren't renewed)
  const { data: expiredThisMonth } = await supabase
    .from('subscriptions')
    .select('wallet_address')
    .eq('status', 'expired')
    .gte('period_end', monthStart.toISOString())
    .lt('period_end', monthEnd.toISOString())

  // Filter out those who renewed (have an active subscription)
  const activeWallets = new Set(subscriptions.data?.map((s) => s.wallet_address) || [])
  const churnedWallets = (expiredThisMonth || []).filter(
    (e) => !activeWallets.has(e.wallet_address)
  )
  const churnedThisMonth = churnedWallets.length

  // Churn rate = churned / (active at start of month + new this month)
  const newSubsThisMonth = daily.reduce((sum, d) => sum + d.new_subs, 0)
  const startingActive = activeCount - newSubsThisMonth + churnedThisMonth
  const churnRate = startingActive > 0 ? (churnedThisMonth / startingActive) * 100 : 0

  const financial: FinancialMetrics = {
    revenue: {
      mtd_usd: parseFloat(mtdUsd.toFixed(2)),
      last_month_usd: parseFloat(lastMonthUsd.toFixed(2)),
      mrr: parseFloat(mrr.toFixed(2)),
      arr: parseFloat((mrr * 12).toFixed(2)),
    },
    subscriptions: {
      total_active: activeCount,
      new_this_month: daily.reduce((sum, d) => sum + d.new_subs, 0),
      churned_this_month: churnedThisMonth,
      churn_rate: parseFloat(churnRate.toFixed(2)),
    },
    arpu: activeCount > 0 ? parseFloat((mtdUsd / activeCount).toFixed(2)) : 0,
    by_plan: byPlan,
    by_token: byToken,
    daily,
  }

  return c.json(financial)
})

// ============================================
// METRICS: SECURITY DASHBOARD
// ============================================

interface SecurityMetrics {
  summary: {
    events_today: number
    blocked_requests: number
    rate_limit_hits: number
    auth_failures: number
  }
  claw: {
    blocks_by_gate: Record<string, number>
    top_blocked_reasons: Array<{ reason: string; count: number }>
  }
  threats: {
    active_alerts: number
    ip_blocks: number | null
    suspicious_wallets: number | null
    note: string
  }
  hourly: Array<{
    hour: string
    blocks: number
    rate_limits: number
    auth_failures: number
  }>
}

/**
 * GET /admin/metrics/security
 *
 * Security metrics: blocks, rate limits, auth failures.
 */
adminRoutes.get('/metrics/security', requireDashboard('security'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Get hourly metrics for last 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const { data: hourlyData } = await supabase
    .from('metrics_hourly')
    .select('*')
    .gte('hour', yesterday.toISOString())
    .order('hour', { ascending: true })

  // Get active alerts
  const { data: alerts } = await supabase.from('alerts').select('*').eq('status', 'active')

  // Calculate totals
  let blockedRequests = 0
  let rateLimitHits = 0
  let authFailures = 0
  const blocksByGate: Record<string, number> = {
    credibility: 0,
    avoidance: 0,
    limits: 0,
    worth: 0,
  }

  for (const h of hourlyData || []) {
    blockedRequests += h.total_blocked || 0
    rateLimitHits += h.rate_limit_hits || 0
    authFailures += h.auth_failure || 0
    blocksByGate.credibility += h.claw_truth_blocks || 0
    blocksByGate.avoidance += h.claw_harm_blocks || 0
    blocksByGate.limits += h.claw_scope_blocks || 0
    blocksByGate.worth += h.claw_purpose_blocks || 0
  }

  // Build hourly array
  const hourly = (hourlyData || []).map((h) => ({
    hour: h.hour,
    blocks: h.total_blocked || 0,
    rate_limits: h.rate_limit_hits || 0,
    auth_failures: h.auth_failure || 0,
  }))

  // Top blocked reasons
  const topBlocked = Object.entries(blocksByGate)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  const security: SecurityMetrics = {
    summary: {
      events_today: blockedRequests + rateLimitHits + authFailures,
      blocked_requests: blockedRequests,
      rate_limit_hits: rateLimitHits,
      auth_failures: authFailures,
    },
    claw: {
      blocks_by_gate: blocksByGate,
      top_blocked_reasons: topBlocked,
    },
    threats: {
      active_alerts: alerts?.length || 0,
      ip_blocks: null,
      suspicious_wallets: null,
      note: 'IP blocking and suspicious wallet tracking require additional infrastructure. Currently not implemented.',
    },
    hourly,
  }

  return c.json(security)
})

// ============================================
// METRICS: ANALYTICS/CAPACITY DASHBOARD
// ============================================

interface AnalyticsMetrics {
  capacity: {
    current_load_percent: number | null
    estimated_headroom: string
    scaling_recommendation: string
    note: string
  }
  usage: {
    total_requests_30d: number
    avg_daily_requests: number
    peak_daily_requests: number
    growth_rate_percent: number
  }
  top_agents: Array<{
    id: string
    name: string
    requests: number
    block_rate: number
  }>
  frameworks: Record<string, number>
  claw_stats: {
    total_validations: number
    total_blocks: number
    overall_block_rate: number
    by_protection_level: Record<string, number>
  }
}

/**
 * GET /admin/metrics/analytics
 *
 * Analytics and capacity planning metrics.
 */
adminRoutes.get('/metrics/analytics', requireDashboard('analytics'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get daily metrics
  const { data: dailyData } = await supabase
    .from('metrics_daily')
    .select('*')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
    .order('date', { ascending: true })

  // Get agents with their usage
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, framework, claw_config')
    .neq('status', 'archived')

  // Get usage by agent
  const { data: agentUsage } = await supabase
    .from('usage_daily')
    .select('agent_id, requests_count, blocked_count')
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0])

  // Calculate totals
  let totalRequests = 0
  let peakDaily = 0
  let totalBlocked = 0

  for (const d of dailyData || []) {
    const requests = Number(d.total_requests) || 0
    totalRequests += requests
    totalBlocked += Number(d.total_blocked) || 0
    if (requests > peakDaily) peakDaily = requests
  }

  const avgDaily = (dailyData?.length || 1) > 0 ? totalRequests / (dailyData?.length || 1) : 0

  // Calculate growth rate (last 7 days vs previous 7 days)
  const recentWeek = dailyData?.slice(-7) || []
  const previousWeek = dailyData?.slice(-14, -7) || []
  const recentTotal = recentWeek.reduce((sum, d) => sum + (Number(d.total_requests) || 0), 0)
  const previousTotal = previousWeek.reduce((sum, d) => sum + (Number(d.total_requests) || 0), 0)
  const growthRate = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : 0

  // Aggregate usage by agent
  const agentUsageMap = new Map<string, { requests: number; blocked: number }>()
  for (const u of agentUsage || []) {
    if (!u.agent_id) continue
    const existing = agentUsageMap.get(u.agent_id) || { requests: 0, blocked: 0 }
    existing.requests += u.requests_count || 0
    existing.blocked += u.blocked_count || 0
    agentUsageMap.set(u.agent_id, existing)
  }

  // Build top agents
  const topAgents = (agents || [])
    .map((a) => {
      const usage = agentUsageMap.get(a.id) || { requests: 0, blocked: 0 }
      return {
        id: a.id,
        name: a.name,
        requests: usage.requests,
        block_rate:
          usage.requests > 0 ? parseFloat(((usage.blocked / usage.requests) * 100).toFixed(2)) : 0,
      }
    })
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 10)

  // Count frameworks
  const frameworks: Record<string, number> = {}
  for (const a of agents || []) {
    frameworks[a.framework] = (frameworks[a.framework] || 0) + 1
  }

  // Protection level distribution
  const byProtectionLevel: Record<string, number> = { minimal: 0, standard: 0, maximum: 0 }
  for (const a of agents || []) {
    const level = a.claw_config?.protection_level || 'standard'
    byProtectionLevel[level] = (byProtectionLevel[level] || 0) + 1
  }

  // Determine capacity status
  // Calculate load based on requests vs theoretical capacity
  // Cloudflare Workers can handle ~100k requests/second per worker
  // We estimate load based on peak RPM vs a conservative 10k RPM threshold
  const theoreticalCapacityRpm = 10000 // Conservative threshold for free/starter tier
  const currentRpm = peakDaily > 0 ? peakDaily / (24 * 60) : 0 // Average RPM from peak day
  const loadPercent =
    currentRpm > 0 && theoreticalCapacityRpm > 0
      ? Math.min(100, parseFloat(((currentRpm / theoreticalCapacityRpm) * 100).toFixed(1)))
      : null

  let scalingRecommendation = 'No data available'
  let estimatedHeadroom = 'Unknown'

  if (loadPercent !== null) {
    estimatedHeadroom = `${(100 - loadPercent).toFixed(1)}%`
    if (loadPercent < 30) {
      scalingRecommendation = 'No scaling needed'
    } else if (loadPercent < 70) {
      scalingRecommendation = 'Monitor growth trends'
    } else if (loadPercent < 90) {
      scalingRecommendation = 'Consider scaling up'
    } else {
      scalingRecommendation = 'Urgent: Scale up required'
    }
  }

  const analytics: AnalyticsMetrics = {
    capacity: {
      current_load_percent: loadPercent,
      estimated_headroom: estimatedHeadroom,
      scaling_recommendation: scalingRecommendation,
      note: 'Load percentage calculated from peak daily requests vs theoretical capacity (10k RPM threshold).',
    },
    usage: {
      total_requests_30d: totalRequests,
      avg_daily_requests: Math.round(avgDaily),
      peak_daily_requests: peakDaily,
      growth_rate_percent: parseFloat(growthRate.toFixed(1)),
    },
    top_agents: topAgents,
    frameworks,
    claw_stats: {
      total_validations: totalRequests,
      total_blocks: totalBlocked,
      overall_block_rate:
        totalRequests > 0 ? parseFloat(((totalBlocked / totalRequests) * 100).toFixed(2)) : 0,
      by_protection_level: byProtectionLevel,
    },
  }

  return c.json(analytics)
})

// ============================================
// USER SUPPORT ENDPOINTS
// ============================================

/**
 * GET /admin/users/search
 *
 * Search users by wallet address (partial match).
 */
adminRoutes.get('/users/search', requireDashboard('support'), async (c) => {
  const query = c.req.query()
  const parsed = userSearchSchema.safeParse(query)

  if (!parsed.success) {
    return c.json({ error: 'Invalid query parameters' }, 400)
  }

  const { query: searchQuery, limit } = parsed.data
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('profiles')
    .select('wallet_address, display_name, plan, plan_expires_at, created_at')
    .ilike('wallet_address', `%${searchQuery}%`)
    .limit(limit)

  if (error) {
    return c.json({ error: 'Search failed' }, 500)
  }

  return c.json({ users: data, count: data?.length || 0 })
})

/**
 * GET /admin/users/:wallet
 *
 * Get detailed user information for support.
 */
adminRoutes.get('/users/:wallet', requireDashboard('support'), async (c) => {
  const wallet = c.req.param('wallet')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const [profileResult, agentsResult, subscriptionsResult, usageResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('wallet_address', wallet).single(),

    supabase
      .from('agents')
      .select('id, name, status, framework, created_at')
      .eq('wallet_address', wallet)
      .neq('status', 'archived'),

    supabase
      .from('subscriptions')
      .select('*')
      .eq('wallet_address', wallet)
      .order('created_at', { ascending: false })
      .limit(5),

    supabase
      .from('usage_daily')
      .select('date, requests_count, blocked_count')
      .eq('wallet_address', wallet)
      .order('date', { ascending: false })
      .limit(30),
  ])

  if (profileResult.error || !profileResult.data) {
    return c.json({ error: 'User not found' }, 404)
  }

  return c.json({
    profile: profileResult.data,
    agents: agentsResult.data || [],
    subscriptions: subscriptionsResult.data || [],
    recent_usage: usageResult.data || [],
  })
})

// ============================================
// ALERTS ENDPOINTS
// ============================================

/**
 * GET /admin/alerts
 *
 * List active alerts.
 */
adminRoutes.get('/alerts', requireDashboard('alerts'), async (c) => {
  const status = c.req.query('status') || 'active'
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const query = supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)

  if (status !== 'all') {
    query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return c.json({ error: 'Failed to fetch alerts' }, 500)
  }

  return c.json({ alerts: data })
})

/**
 * PATCH /admin/alerts/:id
 *
 * Update alert status (acknowledge/resolve).
 */
adminRoutes.patch('/alerts/:id', requireAction('manage_alerts'), async (c) => {
  const alertId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(alertId)) {
    return c.json({ error: 'Invalid alert ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = updateAlertSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const walletHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const updateData: Record<string, unknown> = {}

  if (parsed.data.status === 'acknowledged') {
    updateData.status = 'acknowledged'
    updateData.acknowledged_by = walletHash
    updateData.acknowledged_at = new Date().toISOString()
  } else if (parsed.data.status === 'resolved') {
    updateData.status = 'resolved'
    updateData.resolved_at = new Date().toISOString()
    if (parsed.data.resolution_notes) {
      updateData.resolution_notes = parsed.data.resolution_notes
    }
  }

  const { data, error } = await supabase
    .from('alerts')
    .update(updateData)
    .eq('id', alertId)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to update alert' }, 500)
  }

  return c.json(data)
})

// ============================================
// ALERT RULES ENDPOINTS
// ============================================

/**
 * GET /admin/rules
 *
 * List alert rules.
 */
adminRoutes.get('/rules', requireDashboard('alerts'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    return c.json({ error: 'Failed to fetch rules' }, 500)
  }

  return c.json({ rules: data })
})

/**
 * POST /admin/rules
 *
 * Create new alert rule.
 */
adminRoutes.post('/rules', requireAction('manage_rules'), async (c) => {
  const body = await c.req.json()
  const parsed = createRuleSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('alert_rules')
    .insert({
      name: parsed.data.name,
      description: parsed.data.description || null,
      metric_name: parsed.data.metric_name,
      condition: parsed.data.condition,
      threshold_value: parsed.data.threshold_value,
      window_minutes: parsed.data.window_minutes,
      severity: parsed.data.severity,
      cooldown_minutes: parsed.data.cooldown_minutes,
      is_enabled: parsed.data.is_enabled,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'A rule with this name already exists' }, 409)
    }
    return c.json({ error: 'Failed to create rule' }, 500)
  }

  return c.json(data, 201)
})

/**
 * PATCH /admin/rules/:id
 *
 * Update alert rule.
 */
adminRoutes.patch('/rules/:id', requireAction('manage_rules'), async (c) => {
  const ruleId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(ruleId)) {
    return c.json({ error: 'Invalid rule ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = updateRuleSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {}
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description
  if (parsed.data.metric_name !== undefined) updateData.metric_name = parsed.data.metric_name
  if (parsed.data.condition !== undefined) updateData.condition = parsed.data.condition
  if (parsed.data.threshold_value !== undefined)
    updateData.threshold_value = parsed.data.threshold_value
  if (parsed.data.window_minutes !== undefined)
    updateData.window_minutes = parsed.data.window_minutes
  if (parsed.data.severity !== undefined) updateData.severity = parsed.data.severity
  if (parsed.data.cooldown_minutes !== undefined)
    updateData.cooldown_minutes = parsed.data.cooldown_minutes
  if (parsed.data.is_enabled !== undefined) updateData.is_enabled = parsed.data.is_enabled

  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('alert_rules')
    .update(updateData)
    .eq('id', ruleId)
    .select()
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return c.json({ error: 'Rule not found' }, 404)
    }
    return c.json({ error: 'Failed to update rule' }, 500)
  }

  return c.json(data)
})

/**
 * DELETE /admin/rules/:id
 *
 * Delete alert rule.
 */
adminRoutes.delete('/rules/:id', requireAction('manage_rules'), async (c) => {
  const ruleId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(ruleId)) {
    return c.json({ error: 'Invalid rule ID format' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Check if rule exists first
  const { data: existing } = await supabase
    .from('alert_rules')
    .select('id')
    .eq('id', ruleId)
    .single()

  if (!existing) {
    return c.json({ error: 'Rule not found' }, 404)
  }

  const { error } = await supabase.from('alert_rules').delete().eq('id', ruleId)

  if (error) {
    return c.json({ error: 'Failed to delete rule' }, 500)
  }

  return c.json({ success: true })
})

// ============================================
// ROLE MANAGEMENT (super_admin only)
// ============================================

/**
 * GET /admin/roles
 *
 * List all admin roles.
 */
adminRoutes.get('/roles', requireRole('super_admin'), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('admin_roles')
    .select(
      `
      *,
      profiles:wallet_address (display_name)
    `
    )
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: 'Failed to fetch roles' }, 500)
  }

  return c.json({ roles: data })
})

/**
 * POST /admin/roles
 *
 * Grant admin role to a wallet.
 */
adminRoutes.post('/roles', requireRole('super_admin'), async (c) => {
  const body = await c.req.json()
  const parsed = createRoleSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const grantedBy = c.get('wallet')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify target wallet exists
  const { data: profile } = await supabase
    .from('profiles')
    .select('wallet_address')
    .eq('wallet_address', parsed.data.wallet_address)
    .single()

  if (!profile) {
    return c.json({ error: 'Wallet not found. User must have logged in at least once.' }, 404)
  }

  // Prevent granting super_admin to self (security measure)
  if (parsed.data.wallet_address === grantedBy && parsed.data.role === 'super_admin') {
    return c.json({ error: 'Cannot grant super_admin role to yourself' }, 400)
  }

  const { data, error } = await supabase
    .from('admin_roles')
    .insert({
      wallet_address: parsed.data.wallet_address,
      role: parsed.data.role,
      granted_by: grantedBy,
      permissions: parsed.data.permissions || {},
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return c.json({ error: 'User already has an admin role' }, 409)
    }
    return c.json({ error: 'Failed to create role' }, 500)
  }

  return c.json(data, 201)
})

/**
 * PATCH /admin/roles/:id
 *
 * Update admin role.
 */
adminRoutes.patch('/roles/:id', requireRole('super_admin'), async (c) => {
  const roleId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(roleId)) {
    return c.json({ error: 'Invalid role ID format' }, 400)
  }

  const body = await c.req.json()
  const parsed = updateRoleSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const adminWallet = c.get('wallet')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Get current role to check if it's the caller's own role
  const { data: currentRole } = await supabase
    .from('admin_roles')
    .select('wallet_address, role')
    .eq('id', roleId)
    .single()

  if (!currentRole) {
    return c.json({ error: 'Role not found' }, 404)
  }

  // Prevent super_admin from demoting themselves
  if (
    currentRole.wallet_address === adminWallet &&
    currentRole.role === 'super_admin' &&
    parsed.data.role &&
    parsed.data.role !== 'super_admin'
  ) {
    return c.json({ error: 'Cannot demote your own super_admin role' }, 400)
  }

  // Prevent deactivating own role
  if (currentRole.wallet_address === adminWallet && parsed.data.is_active === false) {
    return c.json({ error: 'Cannot deactivate your own admin role' }, 400)
  }

  // Build update object
  const updateData: Record<string, unknown> = {}
  if (parsed.data.role !== undefined) updateData.role = parsed.data.role
  if (parsed.data.permissions !== undefined) updateData.permissions = parsed.data.permissions
  if (parsed.data.is_active !== undefined) updateData.is_active = parsed.data.is_active
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('admin_roles')
    .update(updateData)
    .eq('id', roleId)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to update role' }, 500)
  }

  return c.json(data)
})

/**
 * DELETE /admin/roles/:id
 *
 * Remove admin role.
 */
adminRoutes.delete('/roles/:id', requireRole('super_admin'), async (c) => {
  const roleId = c.req.param('id')

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(roleId)) {
    return c.json({ error: 'Invalid role ID format' }, 400)
  }

  const adminWallet = c.get('wallet')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Get the role to check ownership
  const { data: targetRole } = await supabase
    .from('admin_roles')
    .select('wallet_address, role')
    .eq('id', roleId)
    .single()

  if (!targetRole) {
    return c.json({ error: 'Role not found' }, 404)
  }

  // Prevent deleting own role
  if (targetRole.wallet_address === adminWallet) {
    return c.json({ error: 'Cannot delete your own admin role' }, 400)
  }

  // Prevent deleting the last super_admin
  if (targetRole.role === 'super_admin') {
    const { count } = await supabase
      .from('admin_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'super_admin')
      .eq('is_active', true)

    if (count && count <= 1) {
      return c.json({ error: 'Cannot delete the last super_admin role' }, 400)
    }
  }

  const { error } = await supabase.from('admin_roles').delete().eq('id', roleId)

  if (error) {
    return c.json({ error: 'Failed to delete role' }, 500)
  }

  return c.json({ success: true })
})

// ============================================
// USER MANAGEMENT ACTIONS
// ============================================

// Schema for suspend action
const suspendUserSchema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(500).optional(),
})

// Schema for reset usage action
const resetUsageSchema = z.object({
  reason: z.string().min(5, 'Reason is required').max(500),
})

/**
 * PATCH /admin/users/:wallet/status
 *
 * Suspend or unsuspend a user account.
 */
adminRoutes.patch('/users/:wallet/status', requireAction('suspend_user'), async (c) => {
  const wallet = c.req.param('wallet')

  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return c.json({ error: 'Invalid wallet address' }, 400)
  }

  const body = await c.req.json()
  const parsed = suspendUserSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const adminHash = c.get('walletHash')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Get current status
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('status, display_name')
    .eq('wallet_address', wallet)
    .single()

  if (profileError || !profile) {
    return c.json({ error: 'User not found' }, 404)
  }

  const newStatus = parsed.data.suspended ? 'suspended' : 'active'

  // Update status
  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (parsed.data.suspended) {
    updateData.suspended_at = new Date().toISOString()
    updateData.suspended_by = adminHash
    updateData.suspension_reason = parsed.data.reason || null
  } else {
    updateData.suspended_at = null
    updateData.suspended_by = null
    updateData.suspension_reason = null
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('wallet_address', wallet)

  if (updateError) {
    return c.json({ error: 'Failed to update user status' }, 500)
  }

  return c.json({
    success: true,
    wallet_address: wallet,
    previous_status: profile.status,
    new_status: newStatus,
    reason: parsed.data.reason || null,
  })
})

/**
 * POST /admin/users/:wallet/reset-usage
 *
 * Reset API usage counters for a user.
 */
adminRoutes.post('/users/:wallet/reset-usage', requireAction('reset_usage'), async (c) => {
  const wallet = c.req.param('wallet')

  if (!wallet || wallet.length < 32 || wallet.length > 64) {
    return c.json({ error: 'Invalid wallet address' }, 400)
  }

  const body = await c.req.json()
  const parsed = resetUsageSchema.safeParse(body)

  if (!parsed.success) {
    return c.json(
      {
        error: 'Invalid request',
        details: parsed.error.flatten(),
      },
      400
    )
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify user exists
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_address, api_calls_remaining')
    .eq('wallet_address', wallet)
    .single()

  if (profileError || !profile) {
    return c.json({ error: 'User not found' }, 404)
  }

  // Reset usage_daily for current date
  const today = new Date().toISOString().split('T')[0]

  const { error: usageError } = await supabase
    .from('usage_daily')
    .update({
      requests_count: 0,
      blocked_count: 0,
    })
    .eq('wallet_address', wallet)
    .eq('date', today)

  if (usageError) {
    console.error('Failed to reset usage_daily:', usageError)
  }

  // Reset api_calls_remaining in profile based on plan
  const planLimits: Record<string, number> = {
    free: 1000,
    starter: 10000,
    pro: 100000,
  }

  // Get user's current plan
  const { data: fullProfile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('wallet_address', wallet)
    .single()

  const plan = fullProfile?.plan || 'free'
  const newLimit = planLimits[plan] || 1000

  const { error: resetError } = await supabase
    .from('profiles')
    .update({
      api_calls_remaining: newLimit,
      updated_at: new Date().toISOString(),
    })
    .eq('wallet_address', wallet)

  if (resetError) {
    return c.json({ error: 'Failed to reset usage' }, 500)
  }

  return c.json({
    success: true,
    wallet_address: wallet,
    new_api_calls_remaining: newLimit,
    reason: parsed.data.reason,
  })
})
