'use client'

/**
 * ClawPay alerts — CRUD + manual test trigger + deliveries history.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Bell,
  History,
  Loader2,
  MoreVertical,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { AlertForm } from '@/components/clawpay/alert-form'
import { AlertDeliveriesModal } from '@/components/clawpay/alert-deliveries-modal'
import { EmptyState } from '@/components/clawpay/empty-state'
import { formatRelative } from '@/components/clawpay/format'

import {
  ApiError,
  clawpayAlertsApi,
  type Alert,
  type CreateAlertInput,
  type UpdateAlertInput,
} from '@/lib/clawpay-api'

import { toast } from 'sonner'

function describeCondition(condition: Alert['condition']): string {
  if (condition.kind === 'blocked_count_above') {
    const c = condition as { count?: number; window_minutes?: number }
    return `Blocked count ≥ ${c.count ?? '?'} in ${c.window_minutes ?? '?'}m`
  }
  if (condition.kind === 'blocked_value_above') {
    const c = condition as { amount_usd?: number; window_minutes?: number }
    return `Blocked value ≥ $${c.amount_usd ?? '?'} in ${c.window_minutes ?? '?'}m`
  }
  if (condition.kind === 'drainer_hit') {
    const c = condition as { severity_min?: string }
    return `Drainer hit at severity ≥ ${c.severity_min ?? '?'}`
  }
  return condition.kind
}

export default function ClawpayAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Alert | null>(null)
  const [deleting, setDeleting] = useState<Alert | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [viewingDeliveries, setViewingDeliveries] = useState<Alert | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await clawpayAlertsApi.list({ limit: 200 })
      setAlerts(result.alerts)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(
    () =>
      [...alerts].sort((a, b) =>
        b.active === a.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1
      ),
    [alerts]
  )

  const handleCreate = async (input: CreateAlertInput) => {
    await clawpayAlertsApi.create(input)
    toast.success('Alert created')
    await load()
  }

  const handleUpdate = async (id: string, input: UpdateAlertInput) => {
    await clawpayAlertsApi.update(id, input)
    toast.success('Alert updated')
    await load()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteSubmitting(true)
    try {
      await clawpayAlertsApi.remove(deleting.id)
      toast.success(`Alert "${deleting.name}" deleted`)
      setDeleting(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to delete alert')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  const handleTest = async (alert: Alert) => {
    setTestingId(alert.id)
    try {
      const result = await clawpayAlertsApi.test(alert.id)
      if (result.status === 'delivered') {
        toast.success(`Test delivered (HTTP ${result.http_status})`)
      } else {
        toast.error(`Test failed${result.http_status ? ` (HTTP ${result.http_status})` : ''}`)
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Test failed')
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Alerts</h2>
          <p className="text-muted-foreground text-sm">
            Webhook rules that fire when ClawPay decisions match your conditions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => void load()} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="bg-claw-600 hover:bg-claw-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            New alert
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <AlertCircle className="text-destructive mb-2 h-8 w-8" aria-hidden />
            <p className="text-destructive">{error}</p>
            <Button onClick={() => void load()} variant="outline" className="mt-3">
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex items-center justify-center py-16" role="status">
          <Loader2 className="text-claw-500 h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No alerts yet"
          description="Configure your first webhook rule so ClawPay can notify you when a payment is blocked or a threshold is crossed."
          action={
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="bg-claw-600 hover:bg-claw-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create first alert
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Webhook</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last fired</TableHead>
                  <TableHead className="sr-only w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">
                      <div>{alert.name}</div>
                      {alert.description ? (
                        <div className="text-muted-foreground line-clamp-1 text-xs">
                          {alert.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">{describeCondition(alert.condition)}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {alert.notification_target}
                    </TableCell>
                    <TableCell>
                      {alert.active ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        >
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inactive
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {alert.last_triggered_at
                        ? formatRelative(alert.last_triggered_at)
                        : `${alert.trigger_count} fires`}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Actions">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleTest(alert)}
                            disabled={testingId === alert.id}
                          >
                            {testingId === alert.id ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Testing…
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Fire test
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setViewingDeliveries(alert)}>
                            <History className="mr-2 h-4 w-4" />
                            Deliveries
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setEditing(alert)
                              setFormOpen(true)
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleting(alert)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertForm
        open={formOpen}
        onOpenChange={setFormOpen}
        existing={editing}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <AlertDeliveriesModal
        alert={viewingDeliveries}
        onOpenChange={(open) => !open && setViewingDeliveries(null)}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this alert?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  &ldquo;<strong>{deleting.name}</strong>&rdquo; and its delivery history will be
                  permanently removed. This cannot be undone.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
