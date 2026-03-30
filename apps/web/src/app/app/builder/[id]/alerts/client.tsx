'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Bell,
  Plus,
  RefreshCw,
  Trash2,
  Play,
  Pause,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Gauge,
  ShieldAlert,
  TrendingUp,
  Webhook,
  MessageSquare,
  History,
  Settings2,
  Info,
  AlertTriangle,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useAgent } from '../context'
import {
  alertsApi,
  AlertRule,
  AlertRuleType,
  AlertComparison,
  AlertSeverity,
  AlertNotificationChannel,
  AlertHistory,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from '@/lib/api'

// Rule type options with metadata
const RULE_TYPE_OPTIONS: {
  value: AlertRuleType
  label: string
  description: string
  icon: React.ElementType
  unit: string
}[] = [
  {
    value: 'error_rate',
    label: 'Error Rate',
    description: 'Percentage of failed requests',
    icon: XCircle,
    unit: '%',
  },
  {
    value: 'latency_p95',
    label: 'Latency P95',
    description: '95th percentile response time',
    icon: Gauge,
    unit: 'ms',
  },
  {
    value: 'latency_p99',
    label: 'Latency P99',
    description: '99th percentile response time',
    icon: Gauge,
    unit: 'ms',
  },
  {
    value: 'block_rate',
    label: 'Block Rate',
    description: 'Percentage blocked by GuardianClaw',
    icon: ShieldAlert,
    unit: '%',
  },
  {
    value: 'success_rate',
    label: 'Success Rate',
    description: 'Percentage of successful requests',
    icon: CheckCircle2,
    unit: '%',
  },
  {
    value: 'request_volume',
    label: 'Request Volume',
    description: 'Number of requests in time window',
    icon: TrendingUp,
    unit: '',
  },
]

// Comparison options
const COMPARISON_OPTIONS: { value: AlertComparison; label: string; symbol: string }[] = [
  { value: 'gt', label: 'Greater than', symbol: '>' },
  { value: 'gte', label: 'Greater than or equal', symbol: '≥' },
  { value: 'lt', label: 'Less than', symbol: '<' },
  { value: 'lte', label: 'Less than or equal', symbol: '≤' },
  { value: 'eq', label: 'Equal to', symbol: '=' },
]

// Severity options
const SEVERITY_OPTIONS: {
  value: AlertSeverity
  label: string
  color: string
  icon: React.ElementType
}[] = [
  { value: 'info', label: 'Info', color: 'bg-blue-500', icon: Info },
  { value: 'warning', label: 'Warning', color: 'bg-yellow-500', icon: AlertTriangle },
  { value: 'critical', label: 'Critical', color: 'bg-red-500', icon: Zap },
]

// Channel options
const CHANNEL_OPTIONS: {
  value: AlertNotificationChannel
  label: string
  icon: React.ElementType
  placeholder: string
}[] = [
  {
    value: 'webhook',
    label: 'Webhook',
    icon: Webhook,
    placeholder: 'https://your-server.com/alerts',
  },
  {
    value: 'slack',
    label: 'Slack',
    icon: MessageSquare,
    placeholder: 'https://hooks.slack.com/...',
  },
]

// Severity badge component
function SeverityBadge({ severity }: { severity: string }) {
  const option = SEVERITY_OPTIONS.find((o) => o.value === severity) || SEVERITY_OPTIONS[1]
  const Icon = option.icon
  return (
    <Badge className={cn('gap-1 text-xs', option.color)}>
      <Icon className="h-3 w-3" />
      {option.label}
    </Badge>
  )
}

// Status badge for alert history
function StatusBadge({ sent, error }: { sent: boolean; error?: string | null }) {
  if (sent) {
    return (
      <Badge className="gap-1 bg-green-500 text-xs">
        <CheckCircle2 className="h-3 w-3" />
        Sent
      </Badge>
    )
  }
  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>
            <Badge className="gap-1 bg-red-500 text-xs">
              <XCircle className="h-3 w-3" />
              Failed
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  return (
    <Badge className="gap-1 bg-gray-500 text-xs">
      <Clock className="h-3 w-3" />
      Pending
    </Badge>
  )
}

// Format time ago
function timeAgo(date: string): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

export function AlertsPageClient() {
  const { agent, isDemo } = useAgent()

  // Loading states
  const [loadingRules, setLoadingRules] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [rules, setRules] = useState<AlertRule[]>([])
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null)
  const [ruleHistory, setRuleHistory] = useState<AlertHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Dialog states
  const [createDialog, setCreateDialog] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)

  // Form state for creating/editing
  const [formData, setFormData] = useState<CreateAlertRuleInput>({
    name: '',
    description: '',
    rule_type: 'error_rate',
    threshold: 5,
    window_minutes: 60,
    comparison: 'gt',
    notification_channel: 'webhook',
    notification_target: '',
    cooldown_minutes: 60,
    consecutive_threshold: 1,
    severity: 'warning',
  })

  // Load rules
  const loadRules = useCallback(async () => {
    if (!agent || isDemo) {
      setLoadingRules(false)
      return
    }

    try {
      setLoadingRules(true)
      const data = await alertsApi.list(agent.id)
      setRules(data.rules)
    } catch (err) {
      console.error('Failed to load alert rules:', err)
      setError('Failed to load alert rules')
    } finally {
      setLoadingRules(false)
    }
  }, [agent, isDemo])

  // Load history for a rule
  const loadHistory = useCallback(
    async (ruleId: string) => {
      if (!agent) return

      try {
        setLoadingHistory(true)
        const data = await alertsApi.history(agent.id, ruleId, { limit: 20 })
        setRuleHistory(data.history)
      } catch (err) {
        console.error('Failed to load alert history:', err)
      } finally {
        setLoadingHistory(false)
      }
    },
    [agent]
  )

  // Initial load
  useEffect(() => {
    loadRules()
  }, [loadRules])

  // Load history when rule is selected
  useEffect(() => {
    if (selectedRule) {
      loadHistory(selectedRule.id)
    } else {
      setRuleHistory([])
    }
  }, [selectedRule, loadHistory])

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      rule_type: 'error_rate',
      threshold: 5,
      window_minutes: 60,
      comparison: 'gt',
      notification_channel: 'webhook',
      notification_target: '',
      cooldown_minutes: 60,
      consecutive_threshold: 1,
      severity: 'warning',
    })
  }

  // Create rule
  const handleCreate = async () => {
    if (!agent) return

    try {
      setCreating(true)
      setError(null)
      await alertsApi.create(agent.id, formData)
      setCreateDialog(false)
      resetForm()
      await loadRules()
    } catch (err: unknown) {
      console.error('Failed to create alert rule:', err)
      const message = err instanceof Error ? err.message : 'Failed to create alert rule'
      setError(message)
    } finally {
      setCreating(false)
    }
  }

  // Toggle rule active
  const handleToggle = async (rule: AlertRule) => {
    if (!agent) return

    try {
      await alertsApi.update(agent.id, rule.id, { is_active: !rule.is_active })
      await loadRules()
    } catch (err: unknown) {
      console.error('Failed to update alert rule:', err)
      const message = err instanceof Error ? err.message : 'Failed to update alert rule'
      setError(message)
    }
  }

  // Delete rule
  const handleDelete = async () => {
    if (!agent || !deleteRuleId) return

    try {
      setDeleting(true)
      await alertsApi.delete(agent.id, deleteRuleId)
      setDeleteRuleId(null)
      if (selectedRule?.id === deleteRuleId) {
        setSelectedRule(null)
      }
      await loadRules()
    } catch (err: unknown) {
      console.error('Failed to delete alert rule:', err)
      const message = err instanceof Error ? err.message : 'Failed to delete alert rule'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  // Test rule
  const handleTest = async (ruleId: string) => {
    if (!agent) return

    try {
      setTesting(ruleId)
      const result = await alertsApi.test(agent.id, ruleId)
      if (result.success) {
        // Show success temporarily
        setError(null)
      } else {
        setError(`Test failed: ${result.error}`)
      }
    } catch (err: unknown) {
      console.error('Failed to test alert rule:', err)
      const message = err instanceof Error ? err.message : 'Failed to test alert rule'
      setError(message)
    } finally {
      setTesting(null)
    }
  }

  // Get rule type metadata
  const getRuleTypeMeta = (type: AlertRuleType) => {
    return RULE_TYPE_OPTIONS.find((o) => o.value === type) || RULE_TYPE_OPTIONS[0]
  }

  // Form validation
  const isFormValid = useMemo(() => {
    return (
      formData.name.trim().length > 0 &&
      formData.notification_target.trim().length > 0 &&
      formData.threshold >= 0
    )
  }, [formData])

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading alerts...</p>
        </div>
      </div>
    )
  }

  // Demo mode
  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <Bell className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Alerts Not Available</h2>
          <p className="text-muted-foreground">Sign in to configure alert rules for your agent.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-6xl py-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Bell className="text-claw-500 h-6 w-6" />
            Alert Rules
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure notifications for agent metrics thresholds
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border-destructive/20 mb-6 rounded-lg border p-4">
            <p className="text-destructive flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Rules List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      Alert Rules
                    </CardTitle>
                    <CardDescription>
                      {rules.length} rule{rules.length !== 1 ? 's' : ''} configured
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadRules}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        resetForm()
                        setCreateDialog(true)
                      }}
                      className="bg-claw-600 hover:bg-claw-700"
                      disabled={rules.length >= 10}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Rule
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingRules ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                  </div>
                ) : rules.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <Bell className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No alert rules configured</p>
                    <p className="mt-1 text-sm">
                      Create a rule to get notified when metrics exceed thresholds
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => {
                      const meta = getRuleTypeMeta(rule.rule_type as AlertRuleType)
                      const Icon = meta.icon
                      const comparison = COMPARISON_OPTIONS.find((c) => c.value === rule.comparison)

                      return (
                        <div
                          key={rule.id}
                          className={cn(
                            'cursor-pointer rounded-lg border p-4 transition-colors',
                            rule.is_active ? 'bg-card hover:bg-muted/50' : 'bg-muted/30 opacity-60',
                            selectedRule?.id === rule.id && 'ring-claw-500 ring-2'
                          )}
                          onClick={() => setSelectedRule(rule)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="mb-1 flex items-center gap-2">
                                <Icon className="text-muted-foreground h-4 w-4" />
                                <h3 className="truncate font-medium">{rule.name}</h3>
                                <SeverityBadge severity={rule.severity} />
                                {!rule.is_active && (
                                  <Badge variant="secondary" className="text-xs">
                                    Paused
                                  </Badge>
                                )}
                              </div>
                              <p className="text-muted-foreground text-sm">
                                {meta.label} {comparison?.symbol} {rule.threshold}
                                {meta.unit} over {rule.window_minutes}min
                              </p>
                              {rule.last_triggered_at && (
                                <p className="text-muted-foreground mt-1 text-xs">
                                  Last triggered: {timeAgo(rule.last_triggered_at)}
                                </p>
                              )}
                            </div>
                            <div
                              className="flex items-center gap-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handleTest(rule.id)}
                                      disabled={testing === rule.id || !rule.is_active}
                                    >
                                      {testing === rule.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Play className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Test notification</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <Switch
                                checked={rule.is_active}
                                onCheckedChange={() => handleToggle(rule)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive h-8 w-8"
                                onClick={() => setDeleteRuleId(rule.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
                {rules.length >= 10 && (
                  <p className="text-muted-foreground mt-4 text-center text-xs">
                    Maximum 10 rules per agent reached
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Rule Details / History */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  {selectedRule ? 'Rule Details' : 'Select a Rule'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedRule ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <Settings2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">Select a rule to view details and history</p>
                  </div>
                ) : (
                  <Tabs defaultValue="details" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="history">History</TabsTrigger>
                    </TabsList>
                    <TabsContent value="details" className="mt-4 space-y-4">
                      <div>
                        <Label className="text-muted-foreground text-xs">Name</Label>
                        <p className="font-medium">{selectedRule.name}</p>
                      </div>
                      {selectedRule.description && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Description</Label>
                          <p className="text-sm">{selectedRule.description}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Metric</Label>
                          <p className="text-sm">
                            {getRuleTypeMeta(selectedRule.rule_type as AlertRuleType).label}
                          </p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Threshold</Label>
                          <p className="text-sm">
                            {
                              COMPARISON_OPTIONS.find((c) => c.value === selectedRule.comparison)
                                ?.symbol
                            }{' '}
                            {selectedRule.threshold}
                            {getRuleTypeMeta(selectedRule.rule_type as AlertRuleType).unit}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Window</Label>
                          <p className="text-sm">{selectedRule.window_minutes} min</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Cooldown</Label>
                          <p className="text-sm">{selectedRule.cooldown_minutes} min</p>
                        </div>
                      </div>
                      <div>
                        <Label className="text-muted-foreground text-xs">Notification</Label>
                        <p className="text-sm capitalize">{selectedRule.notification_channel}</p>
                      </div>
                      {selectedRule.last_value !== null && (
                        <div>
                          <Label className="text-muted-foreground text-xs">Last Value</Label>
                          <p className="text-sm">
                            {selectedRule.last_value?.toFixed(2)}
                            {getRuleTypeMeta(selectedRule.rule_type as AlertRuleType).unit}
                          </p>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="history" className="mt-4">
                      {loadingHistory ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                        </div>
                      ) : ruleHistory.length === 0 ? (
                        <div className="text-muted-foreground py-8 text-center">
                          <Clock className="mx-auto mb-2 h-8 w-8 opacity-50" />
                          <p className="text-sm">No triggers yet</p>
                        </div>
                      ) : (
                        <div className="max-h-80 space-y-2 overflow-y-auto">
                          {ruleHistory.map((entry) => (
                            <div key={entry.id} className="rounded border p-2 text-sm">
                              <div className="mb-1 flex items-center justify-between">
                                <StatusBadge
                                  sent={entry.notification_sent}
                                  error={entry.notification_error}
                                />
                                <span className="text-muted-foreground text-xs">
                                  {timeAgo(entry.triggered_at)}
                                </span>
                              </div>
                              <p className="text-muted-foreground text-xs">
                                Value: {entry.metric_value.toFixed(2)} (threshold: {entry.threshold}
                                )
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create Rule Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
            <DialogDescription>
              Get notified when agent metrics exceed thresholds.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="ruleName">Name *</Label>
              <Input
                id="ruleName"
                placeholder="e.g., High Error Rate Alert"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="ruleDescription">Description</Label>
              <Textarea
                id="ruleDescription"
                placeholder="Optional description..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
              />
            </div>

            {/* Metric Type */}
            <div className="space-y-2">
              <Label>Metric Type *</Label>
              <Select
                value={formData.rule_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, rule_type: value as AlertRuleType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RULE_TYPE_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.label}</span>
                          <span className="text-muted-foreground text-xs">
                            - {option.description}
                          </span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Condition */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Comparison</Label>
                <Select
                  value={formData.comparison}
                  onValueChange={(value) =>
                    setFormData({ ...formData, comparison: value as AlertComparison })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPARISON_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.symbol} {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold">
                  Threshold *{' '}
                  {getRuleTypeMeta(formData.rule_type).unit && (
                    <span className="text-muted-foreground">
                      ({getRuleTypeMeta(formData.rule_type).unit})
                    </span>
                  )}
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  value={formData.threshold}
                  onChange={(e) =>
                    setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            {/* Time Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="window">Time Window (min)</Label>
                <Input
                  id="window"
                  type="number"
                  min={1}
                  max={1440}
                  value={formData.window_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      window_minutes: parseInt(e.target.value) || 60,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cooldown">Cooldown (min)</Label>
                <Input
                  id="cooldown"
                  type="number"
                  min={0}
                  max={1440}
                  value={formData.cooldown_minutes}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      cooldown_minutes: parseInt(e.target.value) || 60,
                    })
                  }
                />
              </div>
            </div>

            {/* Severity */}
            <div className="space-y-2">
              <Label>Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(value) =>
                  setFormData({ ...formData, severity: value as AlertSeverity })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITY_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Notification Channel */}
            <div className="space-y-2">
              <Label>Notification Channel *</Label>
              <Select
                value={formData.notification_channel}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    notification_channel: value as AlertNotificationChannel,
                    notification_target: '',
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((option) => {
                    const Icon = option.icon
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Notification Target */}
            <div className="space-y-2">
              <Label htmlFor="target">
                {formData.notification_channel === 'slack' ? 'Slack Webhook URL' : 'Webhook URL'} *
              </Label>
              <Input
                id="target"
                type="url"
                placeholder={
                  CHANNEL_OPTIONS.find((c) => c.value === formData.notification_channel)
                    ?.placeholder
                }
                value={formData.notification_target}
                onChange={(e) => setFormData({ ...formData, notification_target: e.target.value })}
              />
            </div>

            {/* Consecutive Threshold */}
            <div className="space-y-2">
              <Label htmlFor="consecutive">Consecutive Triggers</Label>
              <Input
                id="consecutive"
                type="number"
                min={1}
                value={formData.consecutive_threshold}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    consecutive_threshold: parseInt(e.target.value) || 1,
                  })
                }
              />
              <p className="text-muted-foreground text-xs">
                Number of consecutive checks that must exceed threshold before notification
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !isFormValid}
              className="bg-claw-600 hover:bg-claw-700"
            >
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRuleId} onOpenChange={() => setDeleteRuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the alert rule and all its history. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Rule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
