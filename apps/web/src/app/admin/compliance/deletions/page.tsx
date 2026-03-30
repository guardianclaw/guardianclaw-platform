'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/admin/pagination'
import { DeletionAuditTable } from '@/components/admin/compliance'
import { useDeletionAuditList } from '@/hooks/use-admin-api'
import { Trash2, X, Search, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const ITEMS_PER_PAGE = 20

export default function AdminComplianceDeletionsPage() {
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useDeletionAuditList({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    search: search || undefined,
    order_by: 'deletion_date',
    order_dir: 'desc',
  })

  const deletions = data?.deletions || []
  const total = data?.pagination.total || 0

  const hasFilters = !!search

  const clearFilters = () => {
    setSearch('')
    setPage(0)
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
          <h2 className="text-2xl font-bold tracking-tight">Deletion Audit</h2>
          <p className="text-muted-foreground">Immutable record of all data deletions</p>
        </div>
      </div>

      {/* Info Card */}
      <Card className="border-blue-500/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-500">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="mb-1 font-medium">Audit Trail</h3>
              <p className="text-muted-foreground text-sm">
                This page displays an immutable audit trail of all data deletions. Records cannot be
                modified or deleted to ensure GDPR compliance and provide proof of data removal when
                requested.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trash2 className="h-5 w-5" />
              Deletion Records
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
            <div className="relative min-w-[200px] max-w-md flex-1">
              <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Search by wallet hash..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(0)
                }}
                className="pl-9"
              />
            </div>
          </div>

          <DeletionAuditTable
            deletions={deletions}
            isLoading={isLoading}
            showFiltersHint={hasFilters}
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
    </div>
  )
}
