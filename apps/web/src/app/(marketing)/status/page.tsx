'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, AlertTriangle, Clock, ArrowUpRight, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ServiceStatus {
  name: string
  description: string
  status: 'operational' | 'degraded' | 'outage' | 'maintenance'
  latency?: number
  lastCheck: Date
}

interface Incident {
  id: string
  title: string
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  severity: 'minor' | 'major' | 'critical'
  createdAt: Date
  updatedAt: Date
  updates: Array<{
    time: Date
    message: string
  }>
}

// Simulated service status (in production, would fetch from API)
const SERVICES: ServiceStatus[] = [
  {
    name: 'Platform Frontend',
    description: 'Web application and dashboard',
    status: 'operational',
    latency: 45,
    lastCheck: new Date(),
  },
  {
    name: 'Validation API',
    description: 'Core validation endpoints',
    status: 'operational',
    latency: 23,
    lastCheck: new Date(),
  },
  {
    name: 'Agent Runtime',
    description: 'Agent execution environment',
    status: 'operational',
    latency: 156,
    lastCheck: new Date(),
  },
  {
    name: 'Database',
    description: 'Data storage and retrieval',
    status: 'operational',
    latency: 12,
    lastCheck: new Date(),
  },
  {
    name: 'Authentication',
    description: 'Wallet authentication service',
    status: 'operational',
    latency: 34,
    lastCheck: new Date(),
  },
  {
    name: 'Solana RPC',
    description: 'Blockchain connectivity',
    status: 'operational',
    latency: 89,
    lastCheck: new Date(),
  },
]

// Sample past incidents (in production, would fetch from API)
const PAST_INCIDENTS: Incident[] = [
  {
    id: '1',
    title: 'API latency increase',
    status: 'resolved',
    severity: 'minor',
    createdAt: new Date('2026-01-05T14:00:00Z'),
    updatedAt: new Date('2026-01-05T15:30:00Z'),
    updates: [
      {
        time: new Date('2026-01-05T14:00:00Z'),
        message: 'Investigating increased API response times',
      },
      {
        time: new Date('2026-01-05T14:30:00Z'),
        message: 'Identified: Increased traffic causing load spikes',
      },
      {
        time: new Date('2026-01-05T15:30:00Z'),
        message: 'Resolved: Auto-scaling has normalized response times',
      },
    ],
  },
]

const statusConfig = {
  operational: {
    icon: CheckCircle2,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    label: 'Operational',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    label: 'Degraded',
  },
  outage: {
    icon: XCircle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    label: 'Outage',
  },
  maintenance: {
    icon: Clock,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    label: 'Maintenance',
  },
}

const severityConfig = {
  minor: { color: 'text-yellow-500', label: 'Minor' },
  major: { color: 'text-orange-500', label: 'Major' },
  critical: { color: 'text-red-500', label: 'Critical' },
}

export default function StatusPage() {
  const [services, setServices] = useState(SERVICES)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const refreshStatus = async () => {
    setIsRefreshing(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setLastUpdated(new Date())
    setServices(SERVICES.map((s) => ({ ...s, lastCheck: new Date() })))
    setIsRefreshing(false)
  }

  useEffect(() => {
    // Auto-refresh every 60 seconds
    const interval = setInterval(refreshStatus, 60000)
    return () => clearInterval(interval)
  }, [])

  const overallStatus = services.every((s) => s.status === 'operational')
    ? 'operational'
    : services.some((s) => s.status === 'outage')
      ? 'outage'
      : 'degraded'

  const overallConfig = statusConfig[overallStatus]
  const OverallIcon = overallConfig.icon

  return (
    <div className="bg-background min-h-screen">
      {/* Header */}
      <div className="border-border border-b">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to GuardianClaw
            </Link>
            <button
              onClick={refreshStatus}
              disabled={isRefreshing}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          <h1 className="text-foreground mb-2 text-3xl font-bold">System Status</h1>
          <p className="text-muted-foreground">Current status of GuardianClaw Platform services</p>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Overall Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'mb-8 rounded-lg border p-6',
            overallConfig.bg,
            overallStatus === 'operational'
              ? 'border-emerald-500/20'
              : overallStatus === 'outage'
                ? 'border-red-500/20'
                : 'border-yellow-500/20'
          )}
        >
          <div className="flex items-center gap-4">
            <OverallIcon className={cn('h-8 w-8', overallConfig.color)} />
            <div>
              <h2 className={cn('text-xl font-semibold', overallConfig.color)}>
                {overallStatus === 'operational'
                  ? 'All Systems Operational'
                  : overallStatus === 'outage'
                    ? 'System Outage Detected'
                    : 'Degraded Performance'}
              </h2>
              <p className="text-muted-foreground text-sm">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Services List */}
        <div className="mb-12">
          <h3 className="text-foreground mb-4 text-lg font-medium">Services</h3>
          <div className="bg-card/50 border-border overflow-hidden rounded-lg border">
            {services.map((service, index) => {
              const config = statusConfig[service.status]
              const StatusIcon = config.icon

              return (
                <motion.div
                  key={service.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'flex items-center justify-between p-4',
                    index !== services.length - 1 && 'border-border border-b'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <StatusIcon className={cn('h-5 w-5', config.color)} />
                    <div>
                      <p className="text-foreground font-medium">{service.name}</p>
                      <p className="text-muted-foreground text-sm">{service.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-medium', config.color)}>{config.label}</p>
                    {service.latency && (
                      <p className="text-muted-foreground text-xs">{service.latency}ms</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Uptime Stats */}
        <div className="mb-12">
          <h3 className="text-foreground mb-4 text-lg font-medium">Uptime (90 days)</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card/50 border-border rounded-lg border p-4 text-center">
              <p className="text-claw-500 text-3xl font-bold">99.98%</p>
              <p className="text-muted-foreground text-sm">Overall Uptime</p>
            </div>
            <div className="bg-card/50 border-border rounded-lg border p-4 text-center">
              <p className="text-foreground text-3xl font-bold">45ms</p>
              <p className="text-muted-foreground text-sm">Avg Response</p>
            </div>
            <div className="bg-card/50 border-border rounded-lg border p-4 text-center">
              <p className="text-foreground text-3xl font-bold">2</p>
              <p className="text-muted-foreground text-sm">Incidents</p>
            </div>
          </div>
        </div>

        {/* Uptime Chart (simplified visual) */}
        <div className="mb-12">
          <h3 className="text-foreground mb-4 text-lg font-medium">90-Day History</h3>
          <div className="bg-card/50 border-border rounded-lg border p-4">
            <div className="flex gap-0.5">
              {Array.from({ length: 90 }, (_, i) => {
                // Simulate mostly green with a few yellow days
                const status = i === 45 || i === 67 ? 'degraded' : 'operational'
                return (
                  <div
                    key={i}
                    className={cn(
                      'h-8 flex-1 rounded-sm',
                      status === 'operational' ? 'bg-emerald-500/60' : 'bg-yellow-500/60'
                    )}
                    title={`Day ${90 - i}: ${status}`}
                  />
                )
              })}
            </div>
            <div className="text-muted-foreground mt-2 flex justify-between text-xs">
              <span>90 days ago</span>
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Past Incidents */}
        <div>
          <h3 className="text-foreground mb-4 text-lg font-medium">Past Incidents</h3>
          {PAST_INCIDENTS.length === 0 ? (
            <div className="bg-card/50 border-border rounded-lg border p-8 text-center">
              <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" />
              <p className="text-muted-foreground">No incidents in the past 90 days</p>
            </div>
          ) : (
            <div className="space-y-4">
              {PAST_INCIDENTS.map((incident) => (
                <div key={incident.id} className="bg-card/50 border-border rounded-lg border p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h4 className="text-foreground font-medium">{incident.title}</h4>
                      <p className="text-muted-foreground text-sm">
                        {incident.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'rounded px-2 py-1 text-xs',
                          severityConfig[incident.severity].color,
                          'bg-current/10'
                        )}
                      >
                        {severityConfig[incident.severity].label}
                      </span>
                      <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-500">
                        Resolved
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {incident.updates.map((update, index) => (
                      <div key={index} className="flex gap-3 text-sm">
                        <span className="text-muted-foreground shrink-0">
                          {update.time.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <span className="text-foreground/90">{update.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Subscribe section */}
        <div className="border-border mt-12 border-t pt-8 text-center">
          <h3 className="text-foreground mb-2 text-lg font-medium">Stay Informed</h3>
          <p className="text-muted-foreground mb-4">
            Get notified about status updates and incidents
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="https://x.com/guardianclaw_"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-muted hover:bg-muted/80 text-foreground inline-flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
            >
              Follow on X
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <Link
              href="/docs/changelog"
              className="bg-claw-500 hover:bg-claw-600 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-white transition-colors"
            >
              View Changelog
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
