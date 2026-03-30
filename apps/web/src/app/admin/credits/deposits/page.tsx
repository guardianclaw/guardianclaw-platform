'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pagination } from '@/components/admin/pagination'
import { useAllDeposits } from '@/hooks/use-admin-api'
import {
  ArrowLeft,
  Coins,
  Search,
  X,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
} from 'lucide-react'
// Format date without date-fns dependency
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; icon: typeof CheckCircle; label: string }> = {
    confirmed: {
      color: 'bg-green-500/10 text-green-500 border-green-500/20',
      icon: CheckCircle,
      label: 'Confirmed',
    },
    pending: {
      color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      icon: Clock,
      label: 'Pending',
    },
    failed: {
      color: 'bg-red-500/10 text-red-500 border-red-500/20',
      icon: XCircle,
      label: 'Failed',
    },
  }

  const { color, icon: Icon, label } = config[status] || config.pending

  return (
    <Badge variant="outline" className={color}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  )
}

const ITEMS_PER_PAGE = 25

export default function AdminDepositsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Filter state from URL
  const page = Number(searchParams.get('page')) || 1
  const statusFilter = searchParams.get('status') || ''
  const tokenFilter = searchParams.get('token') || ''
  const searchQuery = searchParams.get('q') || ''

  const [localSearch, setLocalSearch] = useState(searchQuery)

  // Build query params for API
  const queryParams = useMemo(() => {
    const params: {
      limit: number
      offset: number
      status?: 'pending' | 'confirmed' | 'failed'
      token?: 'SOL' | 'USDC' | 'GCLAW'
    } = {
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
    }
    if (statusFilter && ['pending', 'confirmed', 'failed'].includes(statusFilter)) {
      params.status = statusFilter as 'pending' | 'confirmed' | 'failed'
    }
    if (tokenFilter && ['SOL', 'USDC', 'GCLAW'].includes(tokenFilter)) {
      params.token = tokenFilter as 'SOL' | 'USDC' | 'GCLAW'
    }
    return params
  }, [page, statusFilter, tokenFilter])

  const { data, isLoading, error, mutate } = useAllDeposits(queryParams)

  // Update URL with filters
  const updateFilters = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })

      // Reset to page 1 when filters change (except when changing page)
      if (!('page' in updates)) {
        params.delete('page')
      }

      router.push(`/admin/credits/deposits?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleSearch = useCallback(() => {
    updateFilters({ q: localSearch || null })
  }, [localSearch, updateFilters])

  const handleClearFilters = useCallback(() => {
    setLocalSearch('')
    router.push('/admin/credits/deposits')
  }, [router])

  const deposits = useMemo(() => data?.deposits || [], [data?.deposits])
  const pagination = data?.pagination

  // Filter deposits by search query (client-side for display name/wallet)
  const filteredDeposits = useMemo(() => {
    if (!searchQuery) return deposits
    const query = searchQuery.toLowerCase()
    return deposits.filter(
      (d) =>
        (d.display_name ?? '').toLowerCase().includes(query) ||
        d.wallet_address.toLowerCase().includes(query) ||
        d.tx_signature.toLowerCase().includes(query)
    )
  }, [deposits, searchQuery])

  const hasActiveFilters = statusFilter || tokenFilter || searchQuery

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/credits">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">All Deposits</h2>
            <p className="text-muted-foreground">Platform-wide deposit history</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="min-w-[200px] max-w-[300px] flex-1">
              <div className="relative">
                <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search by wallet or tx..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-9 pr-9"
                />
                {localSearch && (
                  <button
                    onClick={() => {
                      setLocalSearch('')
                      updateFilters({ q: null })
                    }}
                    className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter */}
            <Select
              value={statusFilter || 'all'}
              onValueChange={(value) => updateFilters({ status: value === 'all' ? null : value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {/* Token Filter */}
            <Select
              value={tokenFilter || 'all'}
              onValueChange={(value) => updateFilters({ token: value === 'all' ? null : value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Tokens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tokens</SelectItem>
                <SelectItem value="SOL">SOL</SelectItem>
                <SelectItem value="USDC">USDC</SelectItem>
                <SelectItem value="GCLAW">GCLAW</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Deposits Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-muted-foreground py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>Failed to load deposits</p>
              <Button variant="outline" size="sm" onClick={() => mutate()} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : filteredDeposits.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <Coins className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No deposits found</p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeposits.map((deposit) => (
                    <TableRow key={deposit.id}>
                      <TableCell>
                        <Link
                          href={`/admin/credits/user/${deposit.wallet_address}`}
                          className="hover:underline"
                        >
                          <span className="font-medium">
                            {deposit.display_name || `${deposit.wallet_address.slice(0, 8)}...`}
                          </span>
                          <span className="text-muted-foreground block font-mono text-xs">
                            {deposit.wallet_address.slice(0, 12)}...
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <TokenBadge token={deposit.token} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {deposit.amount.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(deposit.credits_usd)}
                      </TableCell>
                      <TableCell>
                        {deposit.bonus_applied > 1 ? (
                          <Badge variant="outline" className="bg-green-500/10 text-green-500">
                            +{((deposit.bonus_applied - 1) * 100).toFixed(0)}%
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={deposit.status} />
                      </TableCell>
                      <TableCell>
                        <a
                          href={`https://solscan.io/tx/${deposit.tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
                        >
                          <span className="font-mono">{deposit.tx_signature.slice(0, 8)}...</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(new Date(deposit.created_at))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.total > ITEMS_PER_PAGE && (
                <div className="border-t p-4">
                  <Pagination
                    page={page}
                    limit={ITEMS_PER_PAGE}
                    total={pagination.total}
                    onPageChange={(newPage) => updateFilters({ page: String(newPage) })}
                    showLimitSelector={false}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {data?.pagination && (
        <p className="text-muted-foreground text-center text-sm">
          Showing {filteredDeposits.length} of {data.pagination.total} deposits
        </p>
      )}
    </div>
  )
}
