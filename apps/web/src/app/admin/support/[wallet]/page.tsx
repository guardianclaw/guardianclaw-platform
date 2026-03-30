'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ChevronLeft,
  User,
  Bot,
  Activity,
  Calendar,
  AlertTriangle,
  Copy,
  Check,
  Ban,
  RefreshCw,
  Loader2,
  CreditCard,
  Clock,
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'

interface UserProfile {
  wallet_address: string
  display_name: string | null
  plan: string
  plan_expires_at: string | null
  api_calls_remaining: number
  created_at: string
  updated_at: string
}

interface UserAgent {
  id: string
  name: string
  status: string
  framework: string | null
  created_at: string
}

interface UserSubscription {
  id: string
  plan: string
  status: string
  started_at: string
  expires_at: string | null
}

interface UserUsage {
  period: string
  api_calls: number
  requests_blocked: number
}

interface UserDetails {
  profile: UserProfile
  agents: UserAgent[]
  subscriptions: UserSubscription[]
  usage: UserUsage[]
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleCopy} className="h-6 w-6">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </Button>
  )
}

function PlanBadge({ plan }: { plan: string }) {
  const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
    pro: 'default',
    starter: 'secondary',
    free: 'outline',
  }

  return (
    <Badge variant={variants[plan] || 'outline'} className="capitalize">
      {plan}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<
    string,
    { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }
  > = {
    deployed: { variant: 'default', label: 'Deployed' },
    draft: { variant: 'secondary', label: 'Draft' },
    testing: { variant: 'outline', label: 'Testing' },
    archived: { variant: 'destructive', label: 'Archived' },
    active: { variant: 'default', label: 'Active' },
    cancelled: { variant: 'destructive', label: 'Cancelled' },
    expired: { variant: 'outline', label: 'Expired' },
  }

  const { variant, label } = config[status] || { variant: 'outline', label: status }

  return <Badge variant={variant}>{label}</Badge>
}

export default function AdminUserDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { token } = useAuth()
  const { hasPermission } = useAdminAuth()
  const wallet = params.wallet as string

  const [userDetails, setUserDetails] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const canResetUsage = hasPermission('reset_usage')
  const canSuspendUser = hasPermission('suspend_user')

  const fetchUserDetails = useCallback(async () => {
    if (!token || !wallet) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/admin/users/${wallet}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found')
        }
        throw new Error('Failed to fetch user details')
      }

      const data = await response.json()
      setUserDetails(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [token, wallet])

  useEffect(() => {
    fetchUserDetails()
  }, [fetchUserDetails])

  const handleAction = async (action: string, endpoint: string, method = 'POST') => {
    if (!token) return

    setActionLoading(action)
    try {
      const response = await fetch(`${API_URL}/admin/users/${wallet}/${endpoint}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to ${action}`)
      }

      // Refresh user details after action
      await fetchUserDetails()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Card className="border-destructive">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="text-destructive mx-auto mb-4 h-12 w-12" />
            <h3 className="mb-1 font-medium">Error</h3>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchUserDetails}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!userDetails) {
    return null
  }

  const { profile, agents, subscriptions, usage } = userDetails
  const shortWallet = `${wallet.slice(0, 8)}...${wallet.slice(-8)}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/support">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold tracking-tight">
                {profile.display_name || 'Anonymous User'}
              </h2>
              <PlanBadge plan={profile.plan} />
            </div>
            <div className="text-muted-foreground flex items-center gap-1 font-mono text-sm">
              <span>{shortWallet}</span>
              <CopyButton text={wallet} />
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="flex gap-2">
          {canResetUsage && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={actionLoading === 'reset'}>
                  {actionLoading === 'reset' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Reset Usage
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset User Usage</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset the user's API call count for the current period. This action is
                    logged.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleAction('reset', 'reset-usage')}>
                    Reset Usage
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canSuspendUser && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={actionLoading === 'suspend'}>
                  {actionLoading === 'suspend' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="mr-2 h-4 w-4" />
                  )}
                  Suspend User
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Suspend User</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will suspend the user's account and disable all their agents. This action
                    is logged and reversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleAction('suspend', 'suspend')}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Suspend User
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Profile & Quick Stats */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-sm">Display Name</p>
                <p className="font-medium">{profile.display_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Plan</p>
                <p className="font-medium capitalize">{profile.plan}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Plan Expires</p>
                <p className="font-medium">
                  {profile.plan_expires_at
                    ? new Date(profile.plan_expires_at).toLocaleDateString()
                    : 'Never'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">API Calls Remaining</p>
                <p className="font-medium">{(profile.api_calls_remaining ?? 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Joined</p>
                <p className="font-medium">{new Date(profile.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Last Updated</p>
                <p className="font-medium">{new Date(profile.updated_at).toLocaleDateString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Bot className="text-claw-500 mx-auto mb-2 h-6 w-6" />
                <p className="text-2xl font-bold">{agents.length}</p>
                <p className="text-muted-foreground text-sm">Total Agents</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <CreditCard className="text-claw-500 mx-auto mb-2 h-6 w-6" />
                <p className="text-2xl font-bold">{subscriptions.length}</p>
                <p className="text-muted-foreground text-sm">Subscriptions</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Activity className="text-claw-500 mx-auto mb-2 h-6 w-6" />
                <p className="text-2xl font-bold">
                  {usage.reduce((sum, u) => sum + (u.api_calls ?? 0), 0).toLocaleString()}
                </p>
                <p className="text-muted-foreground text-sm">API Calls (All Time)</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <Clock className="text-claw-500 mx-auto mb-2 h-6 w-6" />
                <p className="text-2xl font-bold">
                  {usage.reduce((sum, u) => sum + (u.requests_blocked ?? 0), 0).toLocaleString()}
                </p>
                <p className="text-muted-foreground text-sm">Requests Blocked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Details */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">Agents ({agents.length})</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions ({subscriptions.length})</TabsTrigger>
          <TabsTrigger value="usage">Usage History ({usage.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="agents">
          <Card>
            <CardHeader>
              <CardTitle>User Agents</CardTitle>
              <CardDescription>All agents created by this user</CardDescription>
            </CardHeader>
            <CardContent>
              {agents.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <Bot className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No agents created</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {agents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agent.name}</span>
                          <StatusBadge status={agent.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">
                          {agent.framework || 'No framework'} • Created{' '}
                          {new Date(agent.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <code className="text-muted-foreground text-xs">{agent.id.slice(0, 8)}</code>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions">
          <Card>
            <CardHeader>
              <CardTitle>Subscription History</CardTitle>
              <CardDescription>All subscriptions for this user</CardDescription>
            </CardHeader>
            <CardContent>
              {subscriptions.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <CreditCard className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No subscription history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {subscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">{sub.plan}</span>
                          <StatusBadge status={sub.status} />
                        </div>
                        <p className="text-muted-foreground text-sm">
                          Started {new Date(sub.started_at).toLocaleDateString()}
                          {sub.expires_at && (
                            <> • Expires {new Date(sub.expires_at).toLocaleDateString()}</>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage History</CardTitle>
              <CardDescription>API usage by period</CardDescription>
            </CardHeader>
            <CardContent>
              {usage.length === 0 ? (
                <div className="text-muted-foreground py-8 text-center">
                  <Activity className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p>No usage data</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usage.map((u, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <span className="font-medium">{u.period}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{(u.api_calls ?? 0).toLocaleString()} calls</p>
                        <p className="text-muted-foreground text-sm">
                          {(u.requests_blocked ?? 0).toLocaleString()} blocked
                        </p>
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
  )
}
