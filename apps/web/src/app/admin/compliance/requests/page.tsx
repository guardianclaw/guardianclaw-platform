'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Pagination } from '@/components/admin/pagination'
import {
  GdprRequestsTable,
  UpdateRequestModal,
  REQUEST_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '@/components/admin/compliance'
import { useGdprRequestsList } from '@/hooks/use-admin-api'
import { useAuth } from '@/hooks/use-auth'
import { FileText, X, Search, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const ITEMS_PER_PAGE = 20

export default function AdminComplianceRequestsPage() {
  const { token } = useAuth()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [requestType, setRequestType] = useState<string>('')
  const [status, setStatus] = useState<string>('')

  const [selectedRequest, setSelectedRequest] = useState<{
    id: string
    type: string
    status: string
    wallet: string
  } | null>(null)

  const { data, isLoading, mutate } = useGdprRequestsList({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    search: search || undefined,
    request_type: requestType || undefined,
    status: status || undefined,
    order_by: 'created_at',
    order_dir: 'desc',
  })

  const requests = data?.requests || []
  const total = data?.pagination.total || 0

  const hasFilters = search || requestType || status

  const clearFilters = () => {
    setSearch('')
    setRequestType('')
    setStatus('')
    setPage(0)
  }

  const handleUpdateRequest = async (newStatus: string, notes: string) => {
    if (!selectedRequest) return

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/admin/compliance/requests/${selectedRequest.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
          notes: notes || undefined,
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to update request')
    }

    mutate()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin/compliance"
            className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-2 text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Compliance
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">GDPR Requests</h2>
          <p className="text-muted-foreground">Manage data subject requests</p>
        </div>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              All Requests
            </CardTitle>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by wallet..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={requestType || 'all'}
              onValueChange={(v) => {
                setRequestType(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Request Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {REQUEST_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={status || 'all'}
              onValueChange={(v) => {
                setStatus(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <GdprRequestsTable
            requests={requests}
            isLoading={isLoading}
            showFiltersHint={!!hasFilters}
          />

          {/* Pagination */}
          {total > ITEMS_PER_PAGE && (
            <div className="flex justify-center pt-4">
              <Pagination
                page={page}
                limit={ITEMS_PER_PAGE}
                total={total}
                onPageChange={setPage}
                showLimitSelector={false}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Update Request Modal */}
      {selectedRequest && (
        <UpdateRequestModal
          open={!!selectedRequest}
          onOpenChange={(open) => !open && setSelectedRequest(null)}
          requestType={selectedRequest.type}
          currentStatus={selectedRequest.status}
          walletAddress={selectedRequest.wallet}
          onConfirm={handleUpdateRequest}
        />
      )}
    </div>
  )
}
