'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MetricCard } from '@/components/admin/metric-card'
import { Pagination } from '@/components/admin/pagination'
import { useAuditStats, useAuditLogs, type AuditLogEntry } from '@/hooks/use-admin-api'
import { useAuth } from '@/hooks/use-auth'
import {
  History,
  Clock,
  Users,
  FileText,
  Download,
  Search,
  X,
  Eye,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'

const ITEMS_PER_PAGE = 50

function formatDate(date: string): string {
  return format(parseISO(date), 'MMM d, yyyy HH:mm:ss')
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toLocaleString()
}

function getStatusBadge(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
        <CheckCircle className="mr-1 h-3 w-3" />
        {statusCode}
      </Badge>
    )
  } else if (statusCode >= 400 && statusCode < 500) {
    return (
      <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
        <AlertTriangle className="mr-1 h-3 w-3" />
        {statusCode}
      </Badge>
    )
  } else if (statusCode >= 500) {
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        <AlertCircle className="mr-1 h-3 w-3" />
        {statusCode}
      </Badge>
    )
  }
  return <Badge variant="outline">{statusCode}</Badge>
}

function getActionBadge(action: string) {
  const method = action.split(' ')[0]
  const variants: Record<string, string> = {
    GET: 'bg-blue-50 text-blue-700 border-blue-200',
    POST: 'bg-green-50 text-green-700 border-green-200',
    PATCH: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    PUT: 'bg-orange-50 text-orange-700 border-orange-200',
    DELETE: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <Badge variant="outline" className={variants[method] || ''}>
      {method}
    </Badge>
  )
}

const ACTION_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
]

const STATUS_OPTIONS = [
  { value: '200', label: '200 OK' },
  { value: '201', label: '201 Created' },
  { value: '400', label: '400 Bad Request' },
  { value: '401', label: '401 Unauthorized' },
  { value: '403', label: '403 Forbidden' },
  { value: '404', label: '404 Not Found' },
  { value: '500', label: '500 Server Error' },
]

export default function AdminAuditPage() {
  const [page, setPage] = useState(0)
  const [actionPrefix, setActionPrefix] = useState('')
  const [targetType, setTargetType] = useState('')
  const [statusCode, setStatusCode] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [exporting, setExporting] = useState<'csv' | 'json' | null>(null)

  const { token } = useAuth()
  const { data: statsData, isLoading: statsLoading } = useAuditStats()
  const { data: logsData, isLoading: logsLoading } = useAuditLogs({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    action_prefix: actionPrefix || undefined,
    target_type: targetType || undefined,
    status_code: statusCode ? parseInt(statusCode) : undefined,
    start_date: startDate ? new Date(startDate).toISOString() : undefined,
    end_date: endDate ? new Date(endDate).toISOString() : undefined,
    order_by: 'created_at',
    order_dir: 'desc',
  })

  const stats = statsData?.stats
  const logs = logsData?.logs || []
  const total = logsData?.pagination?.total || 0

  const hasFilters = actionPrefix || targetType || statusCode || startDate || endDate

  const clearFilters = () => {
    setActionPrefix('')
    setTargetType('')
    setStatusCode('')
    setStartDate('')
    setEndDate('')
    setPage(0)
  }

  const handleExport = async (exportFormat: 'csv' | 'json') => {
    if (!token) {
      toast.error('Not authenticated')
      return
    }

    setExporting(exportFormat)

    try {
      const params = new URLSearchParams()
      params.set('format', exportFormat)
      if (actionPrefix) params.set('action_prefix', actionPrefix)
      if (targetType) params.set('target_type', targetType)
      if (statusCode) params.set('status_code', statusCode)
      if (startDate) params.set('start_date', new Date(startDate).toISOString())
      if (endDate) params.set('end_date', new Date(endDate).toISOString())

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'
      const response = await fetch(`${apiUrl}/admin/audit/export?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Export failed with status ${response.status}`)
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
      const filename =
        filenameMatch?.[1] || `audit_logs_${new Date().toISOString().split('T')[0]}.${exportFormat}`

      // Download the file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success(`Audit logs exported as ${exportFormat.toUpperCase()}`)
    } catch (error) {
      console.error('Failed to export audit logs:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to export audit logs')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Log</h2>
          <p className="text-muted-foreground">View and export admin activity logs</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
          >
            {exporting === 'csv' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
          >
            {exporting === 'json' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Export JSON
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Entries"
          value={stats ? formatNumber(stats.total_entries) : '-'}
          subtitle={`${stats?.entries_7d || 0} this week`}
          icon={FileText}
          loading={statsLoading}
        />
        <MetricCard
          title="Last 24 Hours"
          value={stats ? formatNumber(stats.entries_24h) : '-'}
          subtitle="Recent activity"
          icon={Clock}
          loading={statsLoading}
        />
        <MetricCard
          title="Last 30 Days"
          value={stats ? formatNumber(stats.entries_30d) : '-'}
          subtitle="Monthly activity"
          icon={History}
          loading={statsLoading}
        />
        <MetricCard
          title="Unique Admins"
          value={stats ? formatNumber(stats.unique_admins) : '-'}
          subtitle="Active administrators"
          icon={Users}
          loading={statsLoading}
        />
      </div>

      {/* Activity by Type */}
      {stats && Object.keys(stats.by_action_type).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Action Type</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.by_action_type).map(([action, count]) => (
                  <div key={action} className="flex items-center gap-2">
                    {getActionBadge(action)}
                    <span className="font-bold">{formatNumber(count as number)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">By Status Code</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                {Object.entries(stats.by_status_code).map(([code, count]) => (
                  <div key={code} className="flex items-center gap-2">
                    {getStatusBadge(parseInt(code))}
                    <span className="font-bold">{formatNumber(count as number)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Activity Log</CardTitle>
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
            <Select
              value={actionPrefix || 'all'}
              onValueChange={(v) => {
                setActionPrefix(v === 'all' ? '' : v)
                setPage(0)
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusCode || 'all'}
              onValueChange={(v) => {
                setStatusCode(v === 'all' ? '' : v)
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

            <Input
              type="text"
              placeholder="Target type..."
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value)
                setPage(0)
              }}
              className="w-[150px]"
            />

            <Input
              type="date"
              placeholder="Start date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                setPage(0)
              }}
              className="w-[150px]"
            />

            <Input
              type="date"
              placeholder="End date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value)
                setPage(0)
              }}
              className="w-[150px]"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center">
                    <div className="flex items-center justify-center">
                      <div className="border-primary h-6 w-6 animate-spin rounded-full border-b-2"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    No audit logs found
                    {hasFilters && ' matching your filters'}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">{formatDate(log.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getActionBadge(log.action)}
                        <span className="max-w-[200px] truncate font-mono text-sm">
                          {log.action.split(' ').slice(1).join(' ')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.target_type ? (
                        <div>
                          <Badge variant="outline" className="text-xs">
                            {log.target_type}
                          </Badge>
                          {log.target_id && (
                            <div className="text-muted-foreground max-w-[100px] truncate font-mono text-xs">
                              {log.target_id.substring(0, 8)}...
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.admin_wallet_hash.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{getStatusBadge(log.status_code)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

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

      {/* Log Details Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-muted-foreground text-sm font-medium">ID</label>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Timestamp</label>
                  <p className="text-sm">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Action</label>
                  <p className="font-mono text-sm">{selectedLog.action}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Status</label>
                  <p>{getStatusBadge(selectedLog.status_code)}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Admin</label>
                  <p className="font-mono text-sm">{selectedLog.admin_wallet_hash}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-sm font-medium">IP Hash</label>
                  <p className="font-mono text-sm">{selectedLog.ip_hash || '-'}</p>
                </div>
                {selectedLog.target_type && (
                  <>
                    <div>
                      <label className="text-muted-foreground text-sm font-medium">
                        Target Type
                      </label>
                      <p className="text-sm">{selectedLog.target_type}</p>
                    </div>
                    <div>
                      <label className="text-muted-foreground text-sm font-medium">Target ID</label>
                      <p className="font-mono text-sm">{selectedLog.target_id || '-'}</p>
                    </div>
                  </>
                )}
                {selectedLog.request_id && (
                  <div className="col-span-2">
                    <label className="text-muted-foreground text-sm font-medium">Request ID</label>
                    <p className="font-mono text-sm">{selectedLog.request_id}</p>
                  </div>
                )}
              </div>

              {Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <label className="text-muted-foreground text-sm font-medium">Details</label>
                  <pre className="bg-muted mt-1 max-h-60 overflow-auto rounded-md p-3 text-sm">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
