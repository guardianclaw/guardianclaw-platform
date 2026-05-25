/**
 * ClawPay public status page (Sprint 6).
 *
 * One unauthenticated GET that returns:
 *   - Overall operational summary across the components ClawPay depends on.
 *   - The last 10 public incidents (closed and open).
 *   - Component-level last-known status.
 *
 * Component checks are deliberately cheap — we don't ping Stripe or
 * Modal on every request. Instead the route reads from
 * `clawpay_status_incidents`: any unresolved incident affecting a
 * component flips that component to its incident's severity. Components
 * with no recent incident are reported `operational`.
 *
 * The API health itself is the one component we DO check live — if you
 * can reach this endpoint, the API is up.
 */

import { Hono } from 'hono'
import { getServiceClient } from '../lib/supabase-client'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_JWT_SECRET?: string
  JWT_SECRET?: string
}

const COMPONENTS = ['api', 'modal', 'supabase', 'stripe', 'helius', 'tenderly'] as const

type Component = (typeof COMPONENTS)[number]

type ComponentStatus = 'operational' | 'degraded' | 'outage' | 'maintenance'

interface IncidentRow {
  id: string
  title: string
  description: string | null
  severity: 'maintenance' | 'minor' | 'major' | 'critical'
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  affected_components: string[] | null
  started_at: string
  resolved_at: string | null
}

function severityToComponentStatus(severity: IncidentRow['severity']): ComponentStatus {
  switch (severity) {
    case 'critical':
      return 'outage'
    case 'major':
      return 'outage'
    case 'minor':
      return 'degraded'
    case 'maintenance':
      return 'maintenance'
  }
}

function worse(a: ComponentStatus, b: ComponentStatus): ComponentStatus {
  const order: ComponentStatus[] = ['operational', 'maintenance', 'degraded', 'outage']
  return order.indexOf(a) >= order.indexOf(b) ? a : b
}

export const clawpayStatusRoutes = new Hono<{ Bindings: Bindings }>()

clawpayStatusRoutes.get('/status', async (c) => {
  const supabase = getServiceClient(c.env as never)

  // Last 10 public incidents, ordered newest first. Cheap, indexed query.
  const { data, error } = await supabase
    .from('clawpay_status_incidents')
    .select('id,title,description,severity,status,affected_components,started_at,resolved_at')
    .eq('public', true)
    .order('started_at', { ascending: false })
    .limit(10)

  if (error) {
    // API is up enough to respond; flag supabase degraded.
    return c.json(
      {
        operational: false,
        api_status: 'operational' as ComponentStatus,
        components: makeAllOperational(),
        incidents: [],
        warning: 'incidents store unreachable; component status may be stale',
      },
      200
    )
  }

  const incidents = (data ?? []) as IncidentRow[]
  const componentStatuses = makeAllOperational()

  for (const incident of incidents) {
    if (incident.resolved_at) continue
    const componentStatus = severityToComponentStatus(incident.severity)
    for (const comp of incident.affected_components ?? []) {
      if (isKnownComponent(comp)) {
        componentStatuses[comp] = worse(componentStatuses[comp], componentStatus)
      }
    }
  }

  // Roll-up: operational only if every component is operational.
  const overall = (Object.values(componentStatuses) as ComponentStatus[]).reduce(
    (acc, s) => worse(acc, s),
    'operational' as ComponentStatus
  )

  return c.json({
    operational: overall === 'operational',
    overall_status: overall,
    components: componentStatuses,
    incidents: incidents.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      severity: i.severity,
      status: i.status,
      affected_components: i.affected_components ?? [],
      started_at: i.started_at,
      resolved_at: i.resolved_at,
    })),
    checked_at: new Date().toISOString(),
  })
})

function makeAllOperational(): Record<Component, ComponentStatus> {
  return {
    api: 'operational',
    modal: 'operational',
    supabase: 'operational',
    stripe: 'operational',
    helius: 'operational',
    tenderly: 'operational',
  }
}

function isKnownComponent(value: string): value is Component {
  return (COMPONENTS as readonly string[]).includes(value)
}
