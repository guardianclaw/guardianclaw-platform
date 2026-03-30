'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Pagination } from '@/components/admin/pagination'
import { useAllAdjustments } from '@/hooks/use-admin-api'
import {
  ArrowLeft,
  RefreshCw,
  Search,
  X,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Info,
} from 'lucide-react'
// Format date without date-fns dependency
function formatDateStr(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(amount: number): string {
  const prefix = amount >= 0 ? '+' : ''
  return `${prefix}$${Math.abs(amount).toFixed(2)}`
}

const ADJUSTMENT_TYPES = [
  { value: 'refund', label: 'Refund', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  {
    value: 'courtesy',
    label: 'Courtesy',
    color: 'bg-green-500/10 text-green-500 border-green-500/20',
  },
  {
    value: 'correction',
    label: 'Correction',
    color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  },
  {
    value: 'bonus',
    label: 'Bonus',
    color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  { value: 'penalty', label: 'Penalty', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
] as const

function AdjustmentTypeBadge({ type }: { type: string }) {
  const config = ADJUSTMENT_TYPES.find((t) => t.value === type) || ADJUSTMENT_TYPES[0]
  return (
    <Badge variant="outline" className={config.color}>
      {config.label}
    </Badge>
  )
}

const ITEMS_PER_PAGE = 25

export default function AdminAdjustmentsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Filter state from URL
  const page = Number(searchParams.get('page')) || 1
  const typeFilter = searchParams.get('type') || ''
  const searchQuery = searchParams.get('q') || ''

  const [localSearch, setLocalSearch] = useState(searchQuery)

  // Build query params for API
  const queryParams = useMemo(() => {
    const params: {
      limit: number
      offset: number
      type?: 'refund' | 'courtesy' | 'correction' | 'bonus' | 'penalty'
    } = {
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
    }
    if (
      typeFilter &&
      ['refund', 'courtesy', 'correction', 'bonus', 'penalty'].includes(typeFilter)
    ) {
      params.type = typeFilter as 'refund' | 'courtesy' | 'correction' | 'bonus' | 'penalty'
    }
    return params
  }, [page, typeFilter])

  const { data, isLoading, error, mutate } = useAllAdjustments(queryParams)

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

      router.push(`/admin/credits/adjustments?${params.toString()}`)
    },
    [router, searchParams]
  )

  const handleSearch = useCallback(() => {
    updateFilters({ q: localSearch || null })
  }, [localSearch, updateFilters])

  const handleClearFilters = useCallback(() => {
    setLocalSearch('')
    router.push('/admin/credits/adjustments')
  }, [router])

  const adjustments = useMemo(() => data?.adjustments || [], [data?.adjustments])
  const pagination = data?.pagination

  // Filter adjustments by search query (client-side)
  const filteredAdjustments = useMemo(() => {
    if (!searchQuery) return adjustments
    const query = searchQuery.toLowerCase()
    return adjustments.filter(
      (a) =>
        (a.display_name ?? '').toLowerCase().includes(query) ||
        a.wallet_address.toLowerCase().includes(query) ||
        a.reason.toLowerCase().includes(query)
    )
  }, [adjustments, searchQuery])

  const hasActiveFilters = typeFilter || searchQuery

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const credits = filteredAdjustments.filter((a) => a.amount > 0)
    const debits = filteredAdjustments.filter((a) => a.amount < 0)
    return {
      totalCredits: credits.reduce((sum, a) => sum + a.amount, 0),
      totalDebits: Math.abs(debits.reduce((sum, a) => sum + a.amount, 0)),
      creditCount: credits.length,
      debitCount: debits.length,
    }
  }, [filteredAdjustments])

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
            <h2 className="text-2xl font-bold tracking-tight">All Adjustments</h2>
            <p className="text-muted-foreground">Platform-wide credit adjustments</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Credits</p>
                <p className="text-2xl font-bold text-green-500">
                  +${summaryStats.totalCredits.toFixed(2)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {summaryStats.creditCount} adjustments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Debits</p>
                <p className="text-2xl font-bold text-red-500">
                  -${summaryStats.totalDebits.toFixed(2)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {summaryStats.debitCount} adjustments
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
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
                  placeholder="Search by wallet or reason..."
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

            {/* Type Filter */}
            <Select
              value={typeFilter || 'all'}
              onValueChange={(value) => updateFilters({ type: value === 'all' ? null : value })}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {ADJUSTMENT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
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

      {/* Adjustments Table */}
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
              <p>Failed to load adjustments</p>
              <Button variant="outline" size="sm" onClick={() => mutate()} className="mt-4">
                Try Again
              </Button>
            </div>
          ) : filteredAdjustments.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <RefreshCw className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p>No adjustments found</p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={handleClearFilters} className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAdjustments.map((adj) => (
                    <TableRow key={adj.id}>
                      <TableCell>
                        <Link
                          href={`/admin/credits/user/${adj.wallet_address}`}
                          className="hover:underline"
                        >
                          <span className="font-medium">
                            {adj.display_name || `${adj.wallet_address.slice(0, 8)}...`}
                          </span>
                          <span className="text-muted-foreground block font-mono text-xs">
                            {adj.wallet_address.slice(0, 12)}...
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <AdjustmentTypeBadge type={adj.type} />
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${adj.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}
                      >
                        {formatCurrency(adj.amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {adj.balance_before !== undefined && adj.balance_after !== undefined ? (
                          <span className="text-muted-foreground">
                            ${adj.balance_before.toFixed(2)} → ${adj.balance_after.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-muted-foreground block cursor-help truncate text-sm">
                              {adj.reason}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[300px]">
                            <p>{adj.reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-sm">
                        {adj.reference_id ? (
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className="text-xs">
                              {adj.reference_type}
                            </Badge>
                            <span className="text-muted-foreground font-mono text-xs">
                              {adj.reference_id}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDateStr(new Date(adj.created_at))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}

          {/* Pagination */}
          {!isLoading && !error && pagination && pagination.total > ITEMS_PER_PAGE && (
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
        </CardContent>
      </Card>

      {/* Summary */}
      {data?.pagination && (
        <p className="text-muted-foreground text-center text-sm">
          Showing {filteredAdjustments.length} of {data.pagination.total} adjustments
        </p>
      )}
    </div>
  )
}
