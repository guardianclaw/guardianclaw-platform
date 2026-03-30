'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Webhook as WebhookIcon,
  Send,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Edit2,
  Play,
  Pause,
  AlertCircle,
  Loader2,
  ExternalLink,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Settings2,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { cn } from '@/lib/utils'
import { useAgent } from '../context'
import {
  webhooksApi,
  endpointsApi,
  Webhook,
  WebhookWithSecret,
  WebhookEndpoint,
  EndpointWithSecret,
  WebhookDelivery,
  DeliveryEventType,
  CreateWebhookInput,
  CreateEndpointInput,
  API_URL,
} from '@/lib/api'
import { isValidWebhookUrl, copyToClipboard } from '@/lib/webhooks'

// Event type options for endpoint configuration
const EVENT_TYPE_OPTIONS: { value: DeliveryEventType; label: string; description: string }[] = [
  { value: 'agent.response', label: 'Agent Response', description: 'Successful agent responses' },
  {
    value: 'agent.blocked',
    label: 'Agent Blocked',
    description: 'Responses blocked by GuardianClaw',
  },
  { value: 'agent.error', label: 'Agent Error', description: 'Execution errors' },
  { value: 'execution.started', label: 'Execution Started', description: 'When execution begins' },
  {
    value: 'execution.completed',
    label: 'Execution Completed',
    description: 'When execution finishes',
  },
]

// Status badge component
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { className: string; icon: React.ReactNode }> = {
    success: { className: 'bg-green-500', icon: <CheckCircle2 className="h-3 w-3" /> },
    failed: { className: 'bg-red-500', icon: <XCircle className="h-3 w-3" /> },
    pending: { className: 'bg-yellow-500', icon: <Clock className="h-3 w-3" /> },
    retrying: { className: 'bg-blue-500', icon: <RotateCcw className="h-3 w-3" /> },
  }
  const variant = variants[status] || variants.pending
  return (
    <Badge className={cn('gap-1 text-xs', variant.className)}>
      {variant.icon}
      {status}
    </Badge>
  )
}

export function WebhooksPageClient() {
  const { agent, isDemo, refetch } = useAgent()

  // Loading states
  const [loadingWebhooks, setLoadingWebhooks] = useState(true)
  const [loadingEndpoints, setLoadingEndpoints] = useState(true)
  const [loadingDeliveries, setLoadingDeliveries] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([])
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])

  // Copy state
  const [copied, setCopied] = useState<string | null>(null)

  // Webhook dialogs
  const [createWebhookDialog, setCreateWebhookDialog] = useState(false)
  const [newWebhookName, setNewWebhookName] = useState('')
  const [newWebhookRateLimit, setNewWebhookRateLimit] = useState(60)
  const [creatingWebhook, setCreatingWebhook] = useState(false)
  const [showWebhookSecret, setShowWebhookSecret] = useState<WebhookWithSecret | null>(null)
  const [deleteWebhookId, setDeleteWebhookId] = useState<string | null>(null)
  const [deletingWebhook, setDeletingWebhook] = useState(false)

  // Endpoint dialogs
  const [createEndpointDialog, setCreateEndpointDialog] = useState(false)
  const [newEndpointName, setNewEndpointName] = useState('')
  const [newEndpointUrl, setNewEndpointUrl] = useState('')
  const [newEndpointEvents, setNewEndpointEvents] = useState<DeliveryEventType[]>([])
  const [creatingEndpoint, setCreatingEndpoint] = useState(false)
  const [showEndpointSecret, setShowEndpointSecret] = useState<EndpointWithSecret | null>(null)
  const [deleteEndpointId, setDeleteEndpointId] = useState<string | null>(null)
  const [deletingEndpoint, setDeletingEndpoint] = useState(false)
  const [testingEndpoint, setTestingEndpoint] = useState<string | null>(null)

  // Load webhooks
  const loadWebhooks = useCallback(async () => {
    if (!agent || isDemo) {
      setLoadingWebhooks(false)
      return
    }

    try {
      setLoadingWebhooks(true)
      const data = await webhooksApi.list(agent.id)
      setWebhooks(data)
    } catch (err) {
      console.error('Failed to load webhooks:', err)
      setError('Failed to load webhooks')
    } finally {
      setLoadingWebhooks(false)
    }
  }, [agent, isDemo])

  // Load endpoints
  const loadEndpoints = useCallback(async () => {
    if (!agent || isDemo) {
      setLoadingEndpoints(false)
      return
    }

    try {
      setLoadingEndpoints(true)
      const data = await endpointsApi.list(agent.id)
      setEndpoints(data)
    } catch (err) {
      console.error('Failed to load endpoints:', err)
      setError('Failed to load endpoints')
    } finally {
      setLoadingEndpoints(false)
    }
  }, [agent, isDemo])

  // Load deliveries
  const loadDeliveries = useCallback(async () => {
    if (!agent || isDemo) {
      setLoadingDeliveries(false)
      return
    }

    try {
      setLoadingDeliveries(true)
      const data = await endpointsApi.listDeliveries(agent.id, { limit: 50 })
      setDeliveries(data.deliveries)
    } catch (err) {
      console.error('Failed to load deliveries:', err)
    } finally {
      setLoadingDeliveries(false)
    }
  }, [agent, isDemo])

  // Initial load
  useEffect(() => {
    loadWebhooks()
    loadEndpoints()
    loadDeliveries()
  }, [loadWebhooks, loadEndpoints, loadDeliveries])

  // Copy helper with fallback
  const handleCopy = async (text: string, id: string) => {
    const success = await copyToClipboard(text)
    if (success) {
      setCopied(id)
      setTimeout(() => setCopied(null), 2000)
    } else {
      setError('Failed to copy to clipboard')
    }
  }

  // URL validation state
  const urlValidation = useMemo(() => {
    if (!newEndpointUrl) return { valid: false, error: undefined }
    return isValidWebhookUrl(newEndpointUrl)
  }, [newEndpointUrl])

  // Create webhook
  const handleCreateWebhook = async () => {
    if (!agent) return

    try {
      setCreatingWebhook(true)
      setError(null)

      const data: CreateWebhookInput = {
        name: newWebhookName || 'Default Webhook',
        rate_limit: newWebhookRateLimit,
      }

      const result = await webhooksApi.create(agent.id, data)
      setShowWebhookSecret(result)
      setCreateWebhookDialog(false)
      setNewWebhookName('')
      setNewWebhookRateLimit(60)
      await loadWebhooks()
    } catch (err: any) {
      console.error('Failed to create webhook:', err)
      setError(err.message || 'Failed to create webhook')
    } finally {
      setCreatingWebhook(false)
    }
  }

  // Toggle webhook active
  const handleToggleWebhook = async (webhook: Webhook) => {
    if (!agent) return

    try {
      await webhooksApi.update(agent.id, webhook.id, { is_active: !webhook.is_active })
      await loadWebhooks()
    } catch (err: any) {
      console.error('Failed to update webhook:', err)
      setError(err.message || 'Failed to update webhook')
    }
  }

  // Delete webhook
  const handleDeleteWebhook = async () => {
    if (!agent || !deleteWebhookId) return

    try {
      setDeletingWebhook(true)
      await webhooksApi.delete(agent.id, deleteWebhookId)
      setDeleteWebhookId(null)
      await loadWebhooks()
    } catch (err: any) {
      console.error('Failed to delete webhook:', err)
      setError(err.message || 'Failed to delete webhook')
    } finally {
      setDeletingWebhook(false)
    }
  }

  // Regenerate webhook secret
  const handleRegenerateWebhook = async (webhookId: string) => {
    if (!agent) return

    try {
      const result = await webhooksApi.regenerate(agent.id, webhookId)
      setShowWebhookSecret(result)
      await loadWebhooks()
    } catch (err: any) {
      console.error('Failed to regenerate webhook:', err)
      setError(err.message || 'Failed to regenerate webhook secret')
    }
  }

  // Create endpoint
  const handleCreateEndpoint = async () => {
    if (!agent || !newEndpointUrl) return

    try {
      setCreatingEndpoint(true)
      setError(null)

      const data: CreateEndpointInput = {
        name: newEndpointName || 'Default Endpoint',
        url: newEndpointUrl,
        event_types: newEndpointEvents.length > 0 ? newEndpointEvents : undefined,
      }

      const result = await endpointsApi.create(agent.id, data)
      setShowEndpointSecret(result)
      setCreateEndpointDialog(false)
      setNewEndpointName('')
      setNewEndpointUrl('')
      setNewEndpointEvents([])
      await loadEndpoints()
    } catch (err: any) {
      console.error('Failed to create endpoint:', err)
      setError(err.message || 'Failed to create endpoint')
    } finally {
      setCreatingEndpoint(false)
    }
  }

  // Toggle endpoint active
  const handleToggleEndpoint = async (endpoint: WebhookEndpoint) => {
    if (!agent) return

    try {
      await endpointsApi.update(agent.id, endpoint.id, { is_active: !endpoint.is_active })
      await loadEndpoints()
    } catch (err: any) {
      console.error('Failed to update endpoint:', err)
      setError(err.message || 'Failed to update endpoint')
    }
  }

  // Delete endpoint
  const handleDeleteEndpoint = async () => {
    if (!agent || !deleteEndpointId) return

    try {
      setDeletingEndpoint(true)
      await endpointsApi.delete(agent.id, deleteEndpointId)
      setDeleteEndpointId(null)
      await loadEndpoints()
    } catch (err: any) {
      console.error('Failed to delete endpoint:', err)
      setError(err.message || 'Failed to delete endpoint')
    } finally {
      setDeletingEndpoint(false)
    }
  }

  // Test endpoint
  const handleTestEndpoint = async (endpointId: string) => {
    if (!agent) return

    try {
      setTestingEndpoint(endpointId)
      const result = await endpointsApi.test(agent.id, endpointId)
      if (result.success) {
        // Reload deliveries to show the test
        await loadDeliveries()
      } else {
        setError(`Test failed: ${result.errorMessage || 'Unknown error'}`)
      }
    } catch (err: any) {
      console.error('Failed to test endpoint:', err)
      setError(err.message || 'Failed to test endpoint')
    } finally {
      setTestingEndpoint(null)
    }
  }

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading webhooks...</p>
        </div>
      </div>
    )
  }

  // Demo mode
  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <WebhookIcon className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Webhooks Not Available</h2>
          <p className="text-muted-foreground">
            Sign in to configure webhooks and endpoints for your agent.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-5xl py-8">
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <WebhookIcon className="text-claw-500 h-6 w-6" />
            Webhooks
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure inbound triggers and outbound deliveries
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

        <Tabs defaultValue="triggers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="triggers" className="flex items-center gap-2">
              <ArrowDownToLine className="h-4 w-4" />
              Inbound Triggers
            </TabsTrigger>
            <TabsTrigger value="endpoints" className="flex items-center gap-2">
              <ArrowUpFromLine className="h-4 w-4" />
              Outbound Endpoints
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Delivery History
            </TabsTrigger>
          </TabsList>

          {/* Inbound Triggers Tab */}
          <TabsContent value="triggers">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowDownToLine className="h-5 w-5" />
                      Inbound Webhooks
                    </CardTitle>
                    <CardDescription>
                      Receive triggers from external systems (Discord, Slack, etc.)
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadWebhooks}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCreateWebhookDialog(true)}
                      className="bg-claw-600 hover:bg-claw-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Webhook
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingWebhooks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                  </div>
                ) : webhooks.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <WebhookIcon className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No webhooks configured</p>
                    <p className="mt-1 text-sm">
                      Create a webhook to receive triggers from external systems
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {webhooks.map((webhook) => (
                      <div
                        key={webhook.id}
                        className={cn(
                          'rounded-lg border p-4',
                          webhook.is_active ? 'bg-card' : 'bg-muted/30 opacity-60'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium">{webhook.name}</h3>
                              <Badge variant={webhook.is_active ? 'default' : 'secondary'}>
                                {webhook.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {webhook.rate_limit} req/min
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <code className="bg-muted max-w-md truncate rounded px-2 py-1 font-mono text-xs">
                                {webhook.trigger_url}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopy(webhook.trigger_url, `url-${webhook.id}`)}
                              >
                                {copied === `url-${webhook.id}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            <div className="text-muted-foreground mt-2 text-xs">
                              Secret: {webhook.secret_prefix}...
                              {webhook.trigger_count > 0 && (
                                <span className="ml-4">
                                  {webhook.trigger_count} triggers
                                  {webhook.last_triggered_at && (
                                    <>
                                      {' '}
                                      | Last:{' '}
                                      {new Date(webhook.last_triggered_at).toLocaleDateString()}
                                    </>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={webhook.is_active}
                              onCheckedChange={() => handleToggleWebhook(webhook)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRegenerateWebhook(webhook.id)}
                              title="Regenerate secret"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteWebhookId(webhook.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outbound Endpoints Tab */}
          <TabsContent value="endpoints">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpFromLine className="h-5 w-5" />
                      Outbound Endpoints
                    </CardTitle>
                    <CardDescription>Send agent responses to external URLs</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadEndpoints}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setCreateEndpointDialog(true)}
                      className="bg-claw-600 hover:bg-claw-700"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Endpoint
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingEndpoints ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                  </div>
                ) : endpoints.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <Send className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No endpoints configured</p>
                    <p className="mt-1 text-sm">
                      Create an endpoint to deliver agent responses externally
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {endpoints.map((endpoint) => (
                      <div
                        key={endpoint.id}
                        className={cn(
                          'rounded-lg border p-4',
                          endpoint.is_active ? 'bg-card' : 'bg-muted/30 opacity-60'
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-medium">{endpoint.name}</h3>
                              <Badge variant={endpoint.is_active ? 'default' : 'secondary'}>
                                {endpoint.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {endpoint.retry_count} retries
                              </Badge>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <code className="bg-muted max-w-md truncate rounded px-2 py-1 font-mono text-xs">
                                {endpoint.url}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => handleCopy(endpoint.url, `epurl-${endpoint.id}`)}
                              >
                                {copied === `epurl-${endpoint.id}` ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {endpoint.event_types.length === 0 ? (
                                <span className="text-muted-foreground text-xs">All events</span>
                              ) : (
                                endpoint.event_types.map((et) => (
                                  <Badge key={et} variant="secondary" className="text-xs">
                                    {et}
                                  </Badge>
                                ))
                              )}
                            </div>
                            <div className="text-muted-foreground mt-2 text-xs">
                              {endpoint.delivery_count} deliveries ({endpoint.success_count}{' '}
                              success, {endpoint.failure_count} failed)
                              {endpoint.last_delivery_at && (
                                <span>
                                  {' '}
                                  | Last: {new Date(endpoint.last_delivery_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleTestEndpoint(endpoint.id)}
                              disabled={testingEndpoint === endpoint.id || !endpoint.is_active}
                            >
                              {testingEndpoint === endpoint.id ? (
                                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                              ) : (
                                <Play className="mr-1 h-4 w-4" />
                              )}
                              Test
                            </Button>
                            <Switch
                              checked={endpoint.is_active}
                              onCheckedChange={() => handleToggleEndpoint(endpoint)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeleteEndpointId(endpoint.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Delivery History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Delivery History
                    </CardTitle>
                    <CardDescription>Recent webhook delivery attempts</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadDeliveries}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDeliveries ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
                  </div>
                ) : deliveries.length === 0 ? (
                  <div className="text-muted-foreground py-8 text-center">
                    <Clock className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No delivery history</p>
                    <p className="mt-1 text-sm">
                      Deliveries will appear here after endpoints receive events
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliveries.map((delivery) => (
                      <div
                        key={delivery.id}
                        className="flex items-center justify-between rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center gap-4">
                          <StatusBadge status={delivery.status} />
                          <Badge variant="outline" className="text-xs">
                            {delivery.event_type}
                          </Badge>
                          <span className="text-muted-foreground">
                            Attempt {delivery.attempts}/{delivery.max_attempts}
                          </span>
                          {delivery.response_time_ms && (
                            <span className="text-muted-foreground">
                              {delivery.response_time_ms}ms
                            </span>
                          )}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-4">
                          {delivery.error_message && (
                            <span
                              className="text-destructive max-w-xs truncate text-xs"
                              title={delivery.error_message}
                            >
                              {delivery.error_message}
                            </span>
                          )}
                          <span className="text-xs">
                            {new Date(delivery.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Webhook Dialog */}
      <Dialog open={createWebhookDialog} onOpenChange={setCreateWebhookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Webhook Trigger</DialogTitle>
            <DialogDescription>
              Create a webhook to receive triggers from external systems. The secret will only be
              shown once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="webhookName">Name</Label>
              <Input
                id="webhookName"
                placeholder="e.g., Discord Bot, Slack Integration"
                value={newWebhookName}
                onChange={(e) => setNewWebhookName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhookRateLimit">Rate Limit (requests/min)</Label>
              <Input
                id="webhookRateLimit"
                type="number"
                min={1}
                max={1000}
                value={newWebhookRateLimit}
                onChange={(e) => setNewWebhookRateLimit(parseInt(e.target.value) || 60)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateWebhookDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWebhook}
              disabled={creatingWebhook}
              className="bg-claw-600 hover:bg-claw-700"
            >
              {creatingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Webhook Secret Dialog */}
      <Dialog open={!!showWebhookSecret} onOpenChange={() => setShowWebhookSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <WebhookIcon className="text-claw-500 h-5 w-5" />
              Webhook Created
            </DialogTitle>
            <DialogDescription>Copy the secret now - it will not be shown again!</DialogDescription>
          </DialogHeader>
          {showWebhookSecret && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  Store this secret securely
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Trigger URL</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-background flex-1 truncate rounded-md px-3 py-2 font-mono text-xs">
                      {showWebhookSecret.trigger_url}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(showWebhookSecret.trigger_url, 'new-url')}
                    >
                      {copied === 'new-url' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <Label className="text-muted-foreground text-xs">Secret (for HMAC signing)</Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-background flex-1 break-all rounded-md px-3 py-2 font-mono text-xs">
                      {showWebhookSecret.secret}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(showWebhookSecret.secret, 'new-secret')}
                    >
                      {copied === 'new-secret' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowWebhookSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Endpoint Dialog */}
      <Dialog open={createEndpointDialog} onOpenChange={setCreateEndpointDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Outbound Endpoint</DialogTitle>
            <DialogDescription>Configure where to deliver agent responses.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="endpointName">Name</Label>
              <Input
                id="endpointName"
                placeholder="e.g., Production Backend, Analytics"
                value={newEndpointName}
                onChange={(e) => setNewEndpointName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endpointUrl">URL</Label>
              <div className="relative">
                <Input
                  id="endpointUrl"
                  type="url"
                  placeholder="https://your-server.com/webhook"
                  value={newEndpointUrl}
                  onChange={(e) => setNewEndpointUrl(e.target.value)}
                  className={cn(
                    newEndpointUrl &&
                      (urlValidation.valid
                        ? 'border-green-500 focus-visible:ring-green-500'
                        : 'border-red-500 focus-visible:ring-red-500')
                  )}
                />
                {newEndpointUrl && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {urlValidation.valid ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                )}
              </div>
              {newEndpointUrl && urlValidation.error && (
                <p className="mt-1 text-xs text-red-500">{urlValidation.error}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Event Types (optional)</Label>
              <p className="text-muted-foreground mb-2 text-xs">
                Leave empty to receive all events
              </p>
              <div className="space-y-2">
                {EVENT_TYPE_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`event-${option.value}`}
                      checked={newEndpointEvents.includes(option.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewEndpointEvents([...newEndpointEvents, option.value])
                        } else {
                          setNewEndpointEvents(newEndpointEvents.filter((v) => v !== option.value))
                        }
                      }}
                      className="rounded"
                    />
                    <label htmlFor={`event-${option.value}`} className="text-sm">
                      {option.label}
                      <span className="text-muted-foreground ml-2 text-xs">
                        ({option.description})
                      </span>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateEndpointDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateEndpoint}
              disabled={creatingEndpoint || !urlValidation.valid}
              className="bg-claw-600 hover:bg-claw-700"
            >
              {creatingEndpoint && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show Endpoint Secret Dialog */}
      <Dialog open={!!showEndpointSecret} onOpenChange={() => setShowEndpointSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="text-claw-500 h-5 w-5" />
              Endpoint Created
            </DialogTitle>
            <DialogDescription>
              Copy the secret now - it will not be shown again! Use this to verify incoming webhooks
              from GuardianClaw.
            </DialogDescription>
          </DialogHeader>
          {showEndpointSecret && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm text-yellow-600">
                  <AlertCircle className="h-4 w-4" />
                  Store this secret securely
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">
                    Secret (for signature verification)
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="bg-background flex-1 break-all rounded-md px-3 py-2 font-mono text-xs">
                      {showEndpointSecret.secret}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopy(showEndpointSecret.secret, 'ep-secret')}
                    >
                      {copied === 'ep-secret' ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowEndpointSecret(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Webhook Confirmation */}
      <AlertDialog open={!!deleteWebhookId} onOpenChange={() => setDeleteWebhookId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the webhook and invalidate its trigger URL. Any systems
              using this webhook will no longer be able to trigger your agent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingWebhook}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteWebhook}
              disabled={deletingWebhook}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingWebhook && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Webhook
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Endpoint Confirmation */}
      <AlertDialog open={!!deleteEndpointId} onOpenChange={() => setDeleteEndpointId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Endpoint?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the endpoint. Pending deliveries to this endpoint will be
              cancelled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingEndpoint}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEndpoint}
              disabled={deletingEndpoint}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingEndpoint && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Endpoint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
