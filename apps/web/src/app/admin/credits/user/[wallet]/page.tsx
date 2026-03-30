'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MetricCard } from '@/components/admin/metric-card'
import { AdjustCreditsModal } from '@/components/admin/credits/adjust-credits-modal'
import { UserNotes } from '@/components/admin/credits/user-notes'
import { useUserCredits, useUserDeposits, useUserAdjustments } from '@/hooks/use-admin-api'
import {
  ArrowLeft,
  Wallet,
  TrendingUp,
  Activity,
  Clock,
  MoreVertical,
  Plus,
  Ban,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Coins,
  User,
  Copy,
  CheckCircle,
} from 'lucide-react'
// Date formatting functions
function formatDate(date: Date, style: 'short' | 'full' = 'short'): string {
  if (style === 'full') {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDistanceToNow(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return formatDate(date, 'full')
}

function formatCurrency(amount: number, decimals = 2): string {
  return `$${amount.toFixed(decimals)}`
}

function TokenBadge({ token }: { token: string }) {
  const colors: Record<string, string> = {
    SOL: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    USDC: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    GCLAW: 'bg-claw-500/10 text-claw-500 border-claw-500/20',
  }
  return (
    <Badge variant="outline" className={colors[token] || ''}>
      {token}
    </Badge>
  )
}

function AdjustmentTypeBadge({ type }: { type: string }) {
  const config: Record<string, { color: string; label: string }> = {
    refund: { color: 'bg-blue-500/10 text-blue-500', label: 'Refund' },
    courtesy: { color: 'bg-green-500/10 text-green-500', label: 'Courtesy' },
    correction: { color: 'bg-yellow-500/10 text-yellow-500', label: 'Correction' },
    bonus: { color: 'bg-purple-500/10 text-purple-500', label: 'Bonus' },
    penalty: { color: 'bg-red-500/10 text-red-500', label: 'Penalty' },
  }
  const { color, label } = config[type] || { color: '', label: type }
  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    active: { color: 'bg-green-500/10 text-green-500 border-green-500/20', label: 'Active' },
    suspended: { color: 'bg-red-500/10 text-red-500 border-red-500/20', label: 'Suspended' },
    unknown: { color: 'bg-gray-500/10 text-gray-500 border-gray-500/20', label: 'Unknown' },
  }
  const { color, label } = config[status] || config.unknown
  return (
    <Badge variant="outline" className={color}>
      {label}
    </Badge>
  )
}

export default function UserCreditsDetailPage() {
  const params = useParams()
  const router = useRouter()
  const walletAddress = params.wallet as string

  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [copied, setCopied] = useState(false)

  const {
    data: userData,
    isLoading: userLoading,
    error: userError,
    mutate: mutateUser,
  } = useUserCredits(walletAddress)

  const { data: depositsData, isLoading: depositsLoading } = useUserDeposits(walletAddress, {
    limit: 10,
  })

  const { data: adjustmentsData, isLoading: adjustmentsLoading } = useUserAdjustments(
    walletAddress,
    { limit: 10 }
  )

  const handleCopyWallet = async () => {
    await navigator.clipboard.writeText(walletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAdjustmentSuccess = () => {
    mutateUser()
  }

  const credits = userData?.credits
  const deposits = depositsData?.deposits || []
  const adjustments = adjustmentsData?.adjustments || []

  if (userError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="text-muted-foreground mb-4 h-12 w-12" />
        <h2 className="mb-2 text-xl font-semibold">User Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested user could not be found.</p>
        <Button variant="outline" onClick={() => router.push('/admin/credits')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Credits
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/credits">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-full">
                <User className="text-muted-foreground h-5 w-5" />
              </div>
              <div>
                <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                  {userLoading ? (
                    <Skeleton className="h-7 w-40" />
                  ) : (
                    userData?.display_name || 'Anonymous User'
                  )}
                  {userData?.status && <StatusBadge status={userData.status} />}
                </h2>
                <div className="text-muted-foreground flex items-center gap-2 text-sm">
                  <code className="font-mono">
                    {walletAddress.slice(0, 16)}...{walletAddress.slice(-8)}
                  </code>
                  <button onClick={handleCopyWallet} className="hover:bg-muted rounded p-1">
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
        </div>

        <div className="flex items-center gap-2">
          <Button variant="default" onClick={() => setShowAdjustModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Adjust Credits
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => mutateUser()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Data
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a
                  href={`https://solscan.io/account/${walletAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on Solscan
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Ban className="mr-2 h-4 w-4" />
                Suspend User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Current Balance"
          value={credits ? formatCurrency(credits.balance_usd, 4) : '-'}
          subtitle={
            credits
              ? `${credits.executions_remaining.toLocaleString()} executions remaining`
              : undefined
          }
          icon={Wallet}
          loading={userLoading}
        />
        <MetricCard
          title="Total Deposited"
          value={credits ? formatCurrency(credits.total_deposited) : '-'}
          subtitle={credits ? `${credits.deposits_count} deposits` : undefined}
          icon={TrendingUp}
          variant="success"
          loading={userLoading}
        />
        <MetricCard
          title="Total Spent"
          value={credits ? formatCurrency(credits.total_spent) : '-'}
          icon={Activity}
          loading={userLoading}
        />
        <MetricCard
          title="Last Deposit"
          value={
            credits?.last_deposit_at
              ? formatDistanceToNow(new Date(credits.last_deposit_at))
              : 'Never'
          }
          icon={Clock}
          loading={userLoading}
        />
      </div>

      {/* User Info Card */}
      {userData && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">User Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Plan</p>
                <p className="font-medium capitalize">{userData.plan || 'Free'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Member Since</p>
                <p className="font-medium">
                  {userData.member_since
                    ? formatDate(new Date(userData.member_since), 'full')
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Adjustments</p>
                <p className="font-medium">{credits?.adjustments_count || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* History Section - 2 columns */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="deposits" className="space-y-4">
            <TabsList>
              <TabsTrigger value="deposits">Deposits</TabsTrigger>
              <TabsTrigger value="adjustments">Adjustments</TabsTrigger>
            </TabsList>

            <TabsContent value="deposits">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Deposit History</CardTitle>
                  <CardDescription>Recent credit deposits</CardDescription>
                </CardHeader>
                <CardContent>
                  {depositsLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : deposits.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center">
                      <Coins className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      <p>No deposits yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Credits</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deposits.map(
                          (deposit: {
                            id: string
                            token: string
                            amount: number
                            credits_usd: number
                            bonus_applied: number
                            created_at: string
                          }) => (
                            <TableRow key={deposit.id}>
                              <TableCell>
                                <TokenBadge token={deposit.token} />
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {deposit.amount.toFixed(4)}
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-medium">
                                  {formatCurrency(deposit.credits_usd)}
                                </span>
                                {deposit.bonus_applied > 1 && (
                                  <span className="ml-1 text-xs text-green-500">
                                    +{((deposit.bonus_applied - 1) * 100).toFixed(0)}%
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatDate(new Date(deposit.created_at))}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adjustments">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Adjustment History</CardTitle>
                  <CardDescription>Manual credit adjustments</CardDescription>
                </CardHeader>
                <CardContent>
                  {adjustmentsLoading ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : adjustments.length === 0 ? (
                    <div className="text-muted-foreground py-8 text-center">
                      <RefreshCw className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      <p>No adjustments yet</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adjustments.map(
                          (adj: {
                            id: string
                            type: string
                            amount: number
                            reason: string
                            created_at: string
                          }) => (
                            <TableRow key={adj.id}>
                              <TableCell>
                                <AdjustmentTypeBadge type={adj.type} />
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium ${adj.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}
                              >
                                {adj.amount >= 0 ? '+' : ''}
                                {formatCurrency(adj.amount)}
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                                {adj.reason}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {formatDate(new Date(adj.created_at))}
                              </TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Notes Section - 1 column */}
        <div>
          <UserNotes walletAddress={walletAddress} />
        </div>
      </div>

      {/* Adjust Credits Modal */}
      <AdjustCreditsModal
        open={showAdjustModal}
        onOpenChange={setShowAdjustModal}
        walletAddress={walletAddress}
        displayName={userData?.display_name}
        currentBalance={credits?.balance_usd}
        onSuccess={handleAdjustmentSuccess}
      />
    </div>
  )
}
