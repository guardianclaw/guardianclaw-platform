'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MetricCard } from '@/components/admin/metric-card'
import { FrameworkBadge } from '@/components/admin/agents'
import {
  EnvironmentBadge,
  DeploymentStatusBadge,
  ExecutionLogs,
  ApiKeysTable,
  RateLimitModal,
  SuspendDeploymentModal,
} from '@/components/admin/deployments'
import {
  useDeploymentDetails,
  useDeploymentLogs,
  useDeploymentApiKeys,
  useAdminMutation,
  invalidateAdminCache,
} from '@/hooks/use-admin-api'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import {
  ArrowLeft,
  Rocket,
  Activity,
  Shield,
  MoreVertical,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle,
  Ban,
  Play,
  Bot,
  User,
  Settings,
  Key,
  AlertCircle,
  Gauge,
  Zap,
} from 'lucide-react'

// Helper functions
function formatDate(date: Date, style: 'short' | 'full' = 'short'): string {
  if (style === 'full') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return formatDate(date, 'full')
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

const LOGS_PER_PAGE = 20

export default function DeploymentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const deploymentId = params.id as string

  const { hasPermission } = useAdminAuth()
  const { mutateAsync } = useAdminMutation()

  const [copied, setCopied] = useState(false)
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)
  const [showRateLimitDialog, setShowRateLimitDialog] = useState(false)
  const [logsPage, setLogsPage] = useState(0)
  const [blockedOnly, setBlockedOnly] = useState(false)

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isValidId = uuidRegex.test(deploymentId)

  const {
    data: deploymentData,
    isLoading: deploymentLoading,
    error: deploymentError,
    mutate: mutateDeployment,
  } = useDeploymentDetails(isValidId ? deploymentId : null)

  const {
    data: logsData,
    isLoading: logsLoading,
    mutate: mutateLogs,
  } = useDeploymentLogs(isValidId ? deploymentId : null, {
    limit: LOGS_PER_PAGE,
    offset: logsPage * LOGS_PER_PAGE,
    blocked_only: blockedOnly || undefined,
  })

  const { data: keysData, isLoading: keysLoading } = useDeploymentApiKeys(
    isValidId ? deploymentId : null
  )

  const canSuspendDeployment = hasPermission('suspend_deployment')
  const canManageRateLimit = hasPermission('manage_ratelimit')

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(deploymentId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSuspendToggle = async (reason?: string) => {
    if (!deploymentData?.deployment) return

    const isSuspending = !deploymentData.deployment.is_suspended

    await mutateAsync('/admin/deployments/' + deploymentId + '/status', {
      method: 'PATCH',
      data: {
        suspended: isSuspending,
        reason: reason,
      },
    })

    mutateDeployment()
    invalidateAdminCache('/admin/deployments')
  }

  const handleRateLimitUpdate = async (limit: number | null) => {
    await mutateAsync('/admin/deployments/' + deploymentId + '/ratelimit', {
      method: 'PATCH',
      data: { rate_limit: limit },
    })

    mutateDeployment()
    invalidateAdminCache('/admin/deployments')
  }

  const deployment = deploymentData?.deployment
  const logs = logsData?.logs || []
  const logsTotal = logsData?.pagination?.total || 0
  const keys = keysData?.keys || []

  // Error state
  if (!isValidId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">Invalid Deployment ID</h2>
        <p className="text-muted-foreground mb-4">The deployment ID format is invalid.</p>
        <Button variant="outline" onClick={() => router.push('/admin/deployments')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Deployments
        </Button>
      </div>
    )
  }

  if (deploymentError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="text-destructive mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">Deployment Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The requested deployment could not be found or you don't have permission to view it.
        </p>
        <Button variant="outline" onClick={() => router.push('/admin/deployments')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Deployments
        </Button>
      </div>
    )
  }

  // Loading state
  if (deploymentLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!deployment) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/deployments">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg">
              <Rocket className="text-muted-foreground h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">{deployment.agent_name}</h2>
                <DeploymentStatusBadge
                  status={deployment.status}
                  isSuspended={deployment.is_suspended}
                  isActive={deployment.is_active}
                />
                <EnvironmentBadge environment={deployment.environment} />
              </div>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                <code className="font-mono">
                  {deploymentId.slice(0, 8)}...{deploymentId.slice(-8)}
                </code>
                <button
                  onClick={handleCopyId}
                  className="hover:bg-muted rounded p-1 transition-colors"
                >
                  {copied ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <span className="mx-1">|</span>
                <span>v{deployment.version}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canManageRateLimit && (
            <Button variant="outline" onClick={() => setShowRateLimitDialog(true)}>
              <Gauge className="mr-2 h-4 w-4" />
              Rate Limit
            </Button>
          )}
          {canSuspendDeployment && (
            <Button
              variant={deployment.is_suspended ? 'default' : 'destructive'}
              onClick={() => setShowSuspendDialog(true)}
            >
              {deployment.is_suspended ? (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Unsuspend
                </>
              ) : (
                <>
                  <Ban className="mr-2 h-4 w-4" />
                  Suspend
                </>
              )}
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => mutateDeployment()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/admin/agents/${deployment.agent_id}`}>
                  <Bot className="mr-2 h-4 w-4" />
                  View Agent
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/admin/support/${deployment.owner_wallet}`}>
                  <User className="mr-2 h-4 w-4" />
                  View Owner
                </Link>
              </DropdownMenuItem>
              {deployment.endpoint_url && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={deployment.endpoint_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Endpoint
                    </a>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Suspension Banner */}
      {deployment.is_suspended && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
              <div>
                <p className="text-destructive font-medium">This deployment is suspended</p>
                {deployment.suspension_reason && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    Reason: {deployment.suspension_reason}
                  </p>
                )}
                {deployment.suspended_at && (
                  <p className="text-muted-foreground text-sm">
                    Suspended {formatDistanceToNow(new Date(deployment.suspended_at))}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Requests (24h)"
          value={formatNumber(deployment.requests_24h)}
          subtitle={`${formatNumber(deployment.requests_7d)} in 7 days`}
          icon={Activity}
          loading={deploymentLoading}
        />
        <MetricCard
          title="Blocks (24h)"
          value={formatNumber(deployment.blocks_24h)}
          subtitle={
            deployment.requests_24h > 0
              ? `${((deployment.blocks_24h / deployment.requests_24h) * 100).toFixed(1)}% block rate`
              : 'No requests'
          }
          icon={Shield}
          variant={deployment.blocks_24h > 0 ? 'warning' : 'default'}
          loading={deploymentLoading}
        />
        <MetricCard
          title="API Keys"
          value={deployment.api_keys_count}
          subtitle="Active keys"
          icon={Key}
          loading={deploymentLoading}
        />
        <MetricCard
          title="Rate Limit"
          value={
            deployment.rate_limit_override !== null
              ? deployment.rate_limit_override === 0
                ? 'Unlimited'
                : `${deployment.rate_limit_override}/min`
              : 'Default'
          }
          subtitle={deployment.rate_limit_override !== null ? 'Custom limit' : 'Platform default'}
          icon={Gauge}
          loading={deploymentLoading}
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Execution Logs</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Deployment Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Rocket className="h-4 w-4" />
                  Deployment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Environment</p>
                    <p className="font-medium capitalize">{deployment.environment}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{deployment.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Version</p>
                    <p className="font-medium">v{deployment.version}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Active</p>
                    <p className="font-medium">{deployment.is_active ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">
                      {formatDate(new Date(deployment.created_at), 'full')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Stopped</p>
                    <p className="font-medium">
                      {deployment.stopped_at
                        ? formatDate(new Date(deployment.stopped_at), 'full')
                        : '-'}
                    </p>
                  </div>
                </div>
                {deployment.endpoint_url && (
                  <div>
                    <p className="text-muted-foreground text-sm">Endpoint URL</p>
                    <a
                      href={deployment.endpoint_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-mono text-sm text-blue-500 hover:underline"
                    >
                      {deployment.endpoint_url}
                    </a>
                  </div>
                )}
                {deployment.notes && (
                  <div>
                    <p className="text-muted-foreground text-sm">Notes</p>
                    <p className="mt-1 text-sm">{deployment.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4" />
                  Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
                    <Bot className="text-muted-foreground h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{deployment.agent_name}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <FrameworkBadge framework={deployment.agent_framework} />
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href={`/admin/agents/${deployment.agent_id}`}>View Agent Details</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Owner Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <User className="h-4 w-4" />
                  Owner
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                    <User className="text-muted-foreground h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{deployment.owner_name || 'Anonymous User'}</p>
                    <p className="text-muted-foreground font-mono text-sm">
                      {deployment.owner_wallet.slice(0, 16)}...{deployment.owner_wallet.slice(-8)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/admin/support/${deployment.owner_wallet}`}>View Profile</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/admin/credits/user/${deployment.owner_wallet}`}>
                      View Credits
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Deployed By */}
            {deployment.deployed_by && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Zap className="h-4 w-4" />
                    Deployed By
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground font-mono text-sm">
                    {deployment.deployed_by}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Execution Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <ExecutionLogs
            logs={logs}
            isLoading={logsLoading}
            page={logsPage}
            total={logsTotal}
            pageSize={LOGS_PER_PAGE}
            onPageChange={setLogsPage}
            blockedOnly={blockedOnly}
            onBlockedOnlyChange={(val) => {
              setBlockedOnly(val)
              setLogsPage(0)
            }}
            onRefresh={() => mutateLogs()}
          />
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="keys" className="space-y-4">
          <ApiKeysTable keys={keys} isLoading={keysLoading} />
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* GuardianClaw Snapshot */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  GuardianClaw Snapshot
                </CardTitle>
                <CardDescription>Safety configuration at time of deployment</CardDescription>
              </CardHeader>
              <CardContent>
                {deployment.claw_snapshot ? (
                  <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
                    {JSON.stringify(deployment.claw_snapshot, null, 2)}
                  </pre>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Shield className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p>No GuardianClaw snapshot</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Config Snapshot */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Config Snapshot
                </CardTitle>
                <CardDescription>Agent configuration at time of deployment</CardDescription>
              </CardHeader>
              <CardContent>
                {deployment.config_snapshot ? (
                  <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
                    {JSON.stringify(deployment.config_snapshot, null, 2)}
                  </pre>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Settings className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p>No config snapshot</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Flow Snapshot */}
          {deployment.flow_snapshot && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Flow Snapshot
                </CardTitle>
                <CardDescription>Workflow definition at time of deployment</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-xs">
                  {JSON.stringify(deployment.flow_snapshot, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Suspend Modal */}
      <SuspendDeploymentModal
        open={showSuspendDialog}
        onOpenChange={setShowSuspendDialog}
        isSuspended={deployment.is_suspended}
        deploymentName={deployment.agent_name}
        onConfirm={handleSuspendToggle}
      />

      {/* Rate Limit Modal */}
      <RateLimitModal
        open={showRateLimitDialog}
        onOpenChange={setShowRateLimitDialog}
        currentLimit={deployment.rate_limit_override}
        onConfirm={handleRateLimitUpdate}
      />
    </div>
  )
}
