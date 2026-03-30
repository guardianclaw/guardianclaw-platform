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
import {
  FrameworkBadge,
  AgentStatusBadge,
  AgentAnalyticsTable,
  GateBreakdown,
  SuspendAgentModal,
} from '@/components/admin/agents'
import {
  useAgentDetails,
  useAgentAnalytics,
  useAdminMutation,
  invalidateAdminCache,
} from '@/hooks/use-admin-api'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import {
  ArrowLeft,
  Bot,
  Activity,
  Shield,
  Clock,
  MoreVertical,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle,
  Ban,
  Play,
  Rocket,
  User,
  Settings,
  BarChart3,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'

// Helper functions
function formatDate(date: Date, style: 'short' | 'full' | 'datetime' = 'short'): string {
  if (style === 'full') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  if (style === 'datetime') {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string

  const { hasPermission } = useAdminAuth()
  const { mutateAsync } = useAdminMutation()

  const [copied, setCopied] = useState(false)
  const [showSuspendDialog, setShowSuspendDialog] = useState(false)

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const isValidId = uuidRegex.test(agentId)

  const {
    data: agentData,
    isLoading: agentLoading,
    error: agentError,
    mutate: mutateAgent,
  } = useAgentDetails(isValidId ? agentId : null)

  const { data: analyticsData, isLoading: analyticsLoading } = useAgentAnalytics(
    isValidId ? agentId : null,
    30
  )

  const canSuspendAgent = hasPermission('suspend_agent')

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(agentId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSuspendToggle = async (reason?: string) => {
    if (!agentData?.agent) return

    const isSuspending = !agentData.agent.is_suspended

    await mutateAsync('/admin/agents/' + agentId + '/status', {
      method: 'PATCH',
      data: {
        suspended: isSuspending,
        reason: reason,
      },
    })

    mutateAgent()
    invalidateAdminCache('/admin/agents')
  }

  const agent = agentData?.agent
  const analytics = analyticsData?.analytics || []
  const summary = analyticsData?.summary

  // Error state
  if (!isValidId) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">Invalid Agent ID</h2>
        <p className="text-muted-foreground mb-4">The agent ID format is invalid.</p>
        <Button variant="outline" onClick={() => router.push('/admin/agents')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Button>
      </div>
    )
  }

  if (agentError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="text-destructive mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">Agent Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The requested agent could not be found or you don't have permission to view it.
        </p>
        <Button variant="outline" onClick={() => router.push('/admin/agents')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Agents
        </Button>
      </div>
    )
  }

  // Loading state
  if (agentLoading) {
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

  if (!agent) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/agents">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-lg">
              <Bot className="text-muted-foreground h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold tracking-tight">{agent.name}</h2>
                <AgentStatusBadge status={agent.status} isSuspended={agent.is_suspended} />
                <FrameworkBadge framework={agent.framework} />
              </div>
              <div className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
                <code className="font-mono">
                  {agentId.slice(0, 8)}...{agentId.slice(-8)}
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
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canSuspendAgent && (
            <Button
              variant={agent.is_suspended ? 'default' : 'destructive'}
              onClick={() => setShowSuspendDialog(true)}
            >
              {agent.is_suspended ? (
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
              <DropdownMenuItem onClick={() => mutateAgent()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/admin/support/${agent.wallet_address}`}>
                  <User className="mr-2 h-4 w-4" />
                  View Owner
                </Link>
              </DropdownMenuItem>
              {agent.active_deployment_id && (
                <DropdownMenuItem asChild>
                  <Link href={`/admin/deployments/${agent.active_deployment_id}`}>
                    <Rocket className="mr-2 h-4 w-4" />
                    View Deployment
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <a
                  href={`https://solscan.io/account/${agent.wallet_address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Owner on Solscan
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Suspension Banner */}
      {agent.is_suspended && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="text-destructive mt-0.5 h-5 w-5" />
              <div>
                <p className="text-destructive font-medium">This agent is suspended</p>
                {agent.suspension_reason && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    Reason: {agent.suspension_reason}
                  </p>
                )}
                {agent.suspended_at && (
                  <p className="text-muted-foreground text-sm">
                    Suspended {formatDistanceToNow(new Date(agent.suspended_at))}
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
          title="Requests (30d)"
          value={summary ? formatNumber(summary.total_requests) : '-'}
          subtitle={agent.status === 'deployed' ? 'Active' : 'Inactive'}
          icon={Activity}
          loading={analyticsLoading}
        />
        <MetricCard
          title="Blocked (30d)"
          value={summary ? formatNumber(summary.total_blocks) : '-'}
          subtitle={summary ? `${formatPercentage(summary.block_rate)} block rate` : undefined}
          icon={Shield}
          variant={summary && summary.block_rate > 5 ? 'warning' : 'default'}
          loading={analyticsLoading}
        />
        <MetricCard
          title="Avg Latency"
          value={agent.avg_latency_ms ? formatLatency(agent.avg_latency_ms) : '-'}
          subtitle="Response time"
          icon={Clock}
          loading={agentLoading}
        />
        <MetricCard
          title="Deployments"
          value={agent.deployments_count}
          subtitle={agent.active_deployment_id ? 'Active deployment' : 'No active deployment'}
          icon={Rocket}
          variant={agent.active_deployment_id ? 'success' : 'default'}
          loading={agentLoading}
        />
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Agent Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bot className="h-4 w-4" />
                  Agent Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{agent.name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Framework</p>
                    <p className="font-medium capitalize">{agent.framework}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{agent.status}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Version</p>
                    <p className="font-medium">v{agent.version}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDate(new Date(agent.created_at), 'full')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p className="font-medium">{formatDistanceToNow(new Date(agent.updated_at))}</p>
                  </div>
                </div>
                {agent.description && (
                  <div>
                    <p className="text-muted-foreground text-sm">Description</p>
                    <p className="mt-1 text-sm">{agent.description}</p>
                  </div>
                )}
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
                    <p className="font-medium">{agent.owner_name || 'Anonymous User'}</p>
                    <p className="text-muted-foreground font-mono text-sm">
                      {agent.wallet_address.slice(0, 16)}...{agent.wallet_address.slice(-8)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/admin/support/${agent.wallet_address}`}>View User Profile</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild className="flex-1">
                    <Link href={`/admin/credits/user/${agent.wallet_address}`}>View Credits</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gate Breakdown */}
          {summary && summary.total_blocks > 0 && <GateBreakdown summary={summary} />}
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Daily Activity (Last 30 Days)
              </CardTitle>
              <CardDescription>Request and block trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              <AgentAnalyticsTable analytics={analytics} isLoading={analyticsLoading} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* GuardianClaw Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-4 w-4" />
                  GuardianClaw Configuration
                </CardTitle>
                <CardDescription>Safety layer configuration for this agent</CardDescription>
              </CardHeader>
              <CardContent>
                {agent.claw_config ? (
                  <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
                    {JSON.stringify(agent.claw_config, null, 2)}
                  </pre>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Shield className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p>No GuardianClaw configuration</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4" />
                  Agent Configuration
                </CardTitle>
                <CardDescription>General agent settings</CardDescription>
              </CardHeader>
              <CardContent>
                {agent.config ? (
                  <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
                    {JSON.stringify(agent.config, null, 2)}
                  </pre>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <Settings className="mx-auto mb-3 h-10 w-10 opacity-30" />
                    <p>No agent configuration</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Integration Configuration */}
          {agent.integration_config && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4" />
                  Integration Configuration
                </CardTitle>
                <CardDescription>External service integrations</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-4 text-xs">
                  {JSON.stringify(agent.integration_config, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Flow Configuration */}
          {agent.flow && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Flow Configuration
                </CardTitle>
                <CardDescription>Agent workflow definition</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted max-h-96 overflow-auto rounded-lg p-4 text-xs">
                  {JSON.stringify(agent.flow, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Suspend Modal */}
      <SuspendAgentModal
        open={showSuspendDialog}
        onOpenChange={setShowSuspendDialog}
        isSuspended={agent.is_suspended}
        agentName={agent.name}
        onConfirm={handleSuspendToggle}
      />
    </div>
  )
}
