'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  ChevronLeft,
  AlertTriangle,
  Plus,
  Settings,
  Loader2,
  XCircle,
  RefreshCw,
  Activity,
  Bell,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

interface AlertRule {
  id: string
  name: string
  description: string | null
  metric_name: string
  condition: 'gt' | 'lt' | 'gte' | 'lte' | 'eq' | 'spike'
  threshold_value: number
  severity: 'info' | 'warning' | 'critical'
  is_enabled: boolean
  cooldown_minutes: number
  created_at: string
}

function ConditionLabel({ condition, threshold }: { condition: string; threshold: number }) {
  const labels: Record<string, string> = {
    gt: `> ${threshold}`,
    lt: `< ${threshold}`,
    gte: `>= ${threshold}`,
    lte: `<= ${threshold}`,
    eq: `= ${threshold}`,
    spike: `spike > ${threshold}%`,
  }

  return <span className="font-mono text-sm">{labels[condition] || condition}</span>
}

function SeverityBadge({ severity }: { severity: string }) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    info: { variant: 'outline' },
    warning: { variant: 'secondary' },
    critical: { variant: 'destructive' },
  }

  const { variant } = config[severity] || { variant: 'outline' }

  return (
    <Badge variant={variant} className="capitalize">
      {severity}
    </Badge>
  )
}

export default function AdminAlertRulesPage() {
  const { isAuthenticated } = useAuth()
  const { hasPermission } = useAdminAuth()
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const canManageRules = hasPermission('manage_rules')

  const fetchRules = useCallback(async () => {
    if (!isAuthenticated) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/admin/rules`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch rules')
      }

      const data = await response.json()
      setRules(data.rules || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    fetchRules()
  }, [fetchRules])

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    if (!isAuthenticated || !canManageRules) return

    setTogglingId(ruleId)
    try {
      const response = await fetch(`${API_URL}/admin/rules/${ruleId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_enabled: enabled }),
      })

      if (!response.ok) {
        throw new Error('Failed to update rule')
      }

      // Update local state
      setRules(rules.map((r) => (r.id === ruleId ? { ...r, is_enabled: enabled } : r)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setTogglingId(null)
    }
  }

  const enabledCount = rules.filter((r) => r.is_enabled).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/alerts">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Alert Rules</h2>
            <p className="text-muted-foreground">Configure automated alert triggers.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchRules} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
          {canManageRules && (
            <Button className="bg-claw-600 hover:bg-claw-700">
              <Plus className="mr-2 h-4 w-4" />
              New Rule
            </Button>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Total Rules</p>
                <p className="text-2xl font-bold">{rules.length}</p>
              </div>
              <Settings className="text-muted-foreground h-8 w-8" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm">Enabled Rules</p>
                <p className="text-2xl font-bold text-green-500">{enabledCount}</p>
              </div>
              <Bell className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules List */}
      <Card>
        <CardHeader>
          <CardTitle>Configured Rules</CardTitle>
          <CardDescription>Rules are checked every 5 minutes by the scheduler</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </div>
          ) : rules.length === 0 ? (
            <div className="py-8 text-center">
              <Settings className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
              <h3 className="mb-1 font-medium">No alert rules configured</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                Create your first rule to start monitoring metrics
              </p>
              {canManageRules && (
                <Button className="bg-claw-600 hover:bg-claw-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Rule
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    !rule.is_enabled ? 'opacity-60' : ''
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Activity className="text-muted-foreground h-4 w-4" />
                      <span className="font-medium">{rule.name}</span>
                      <SeverityBadge severity={rule.severity} />
                    </div>
                    <div className="text-muted-foreground flex items-center gap-4 text-sm">
                      <span>
                        <code className="bg-muted rounded px-1">{rule.metric_name}</code>
                      </span>
                      <ConditionLabel condition={rule.condition} threshold={rule.threshold_value} />
                      <span>Cooldown: {rule.cooldown_minutes}m</span>
                    </div>
                    {rule.description && (
                      <p className="text-muted-foreground text-sm">{rule.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    {canManageRules ? (
                      <Switch
                        checked={rule.is_enabled}
                        onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                        disabled={togglingId === rule.id}
                      />
                    ) : (
                      <Badge variant={rule.is_enabled ? 'default' : 'outline'}>
                        {rule.is_enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-muted-foreground mt-0.5 h-5 w-5" />
            <div className="text-muted-foreground text-sm">
              <p className="mb-1 font-medium">How Alert Rules Work</p>
              <ul className="list-inside list-disc space-y-1">
                <li>Rules are evaluated every 5 minutes by the scheduled job</li>
                <li>When a metric exceeds its threshold, an alert is created</li>
                <li>Cooldown period prevents duplicate alerts for the same issue</li>
                <li>Alerts can be acknowledged and resolved from the Alerts page</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
