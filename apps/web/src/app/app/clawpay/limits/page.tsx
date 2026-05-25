'use client'

/**
 * ClawPay spending limits — CRUD over wallet-scoped USD caps.
 *
 * Lists existing limits (active by default; toggle to include inactive) and
 * exposes a Dialog-based form to create / edit and a confirmation dialog for
 * soft-delete. The server enforces unique (wallet, agent, name, period) slots;
 * a 409 surfaces as an inline error pointing the user back to the edit flow.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, MoreVertical, Plus, RefreshCw, ShieldOff } from 'lucide-react'

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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { EmptyState } from '@/components/clawpay/empty-state'
import { SpendingLimitForm } from '@/components/clawpay/spending-limit-form'
import { formatDateShort, formatUsd } from '@/components/clawpay/format'

import {
  ApiError,
  clawpaySpendingLimitsApi,
  type CreateSpendingLimitInput,
  type SpendingLimit,
  type UpdateSpendingLimitInput,
} from '@/lib/clawpay-api'

import { toast } from 'sonner'

const PERIOD_LABELS: Record<SpendingLimit['period'], string> = {
  hourly: 'Hourly',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  lifetime: 'Lifetime',
}

export default function ClawpayLimitsPage() {
  const [limits, setLimits] = useState<SpendingLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeInactive, setIncludeInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<SpendingLimit | null>(null)
  const [deleting, setDeleting] = useState<SpendingLimit | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await clawpaySpendingLimitsApi.list({
        include_inactive: includeInactive,
        limit: 200,
      })
      setLimits(result.limits)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load spending limits')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(
    () =>
      [...limits].sort((a, b) =>
        b.active === a.active ? a.name.localeCompare(b.name) : a.active ? -1 : 1
      ),
    [limits]
  )

  const handleCreate = async (input: CreateSpendingLimitInput) => {
    await clawpaySpendingLimitsApi.create(input)
    toast.success('Spending limit created')
    await load()
  }

  const handleUpdate = async (id: string, input: UpdateSpendingLimitInput) => {
    await clawpaySpendingLimitsApi.update(id, input)
    toast.success('Spending limit updated')
    await load()
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleteSubmitting(true)
    try {
      await clawpaySpendingLimitsApi.remove(deleting.id)
      toast.success(`"${deleting.name}" disabled`)
      setDeleting(null)
      await load()
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to disable limit')
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Spending limits</h2>
          <p className="text-muted-foreground text-sm">
            Cap the value of approved payments over rolling windows.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={(checked) => setIncludeInactive(checked)}
            />
            <Label htmlFor="include-inactive" className="text-sm">
              Show inactive
            </Label>
          </div>
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
            New limit
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
          icon={ShieldOff}
          title="No spending limits yet"
          description="Add a limit so ClawPay blocks payments above your threshold automatically."
          action={
            <Button
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
              className="bg-claw-600 hover:bg-claw-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create first limit
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
                  <TableHead>Window</TableHead>
                  <TableHead className="text-right">Limit (USD)</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="sr-only w-12">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((limit) => (
                  <TableRow key={limit.id}>
                    <TableCell className="font-medium">
                      <div>{limit.name}</div>
                      {limit.description ? (
                        <div className="text-muted-foreground line-clamp-1 text-xs">
                          {limit.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>{PERIOD_LABELS[limit.period]}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUsd(limit.limit_usd)}
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground text-xs">
                        {limit.agent_id ? `Agent ${limit.agent_id.slice(0, 8)}` : 'All agents'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {limit.active ? (
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
                      {formatDateShort(limit.created_at)}
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
                            onClick={() => {
                              setEditing(limit)
                              setFormOpen(true)
                            }}
                          >
                            Edit
                          </DropdownMenuItem>
                          {limit.active ? (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setDeleting(limit)}
                            >
                              Disable
                            </DropdownMenuItem>
                          ) : null}
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

      <SpendingLimitForm
        open={formOpen}
        onOpenChange={setFormOpen}
        existing={editing}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
      />

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable this spending limit?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting ? (
                <>
                  &ldquo;<strong>{deleting.name}</strong>&rdquo; will stop applying to new payments.
                  Past audit events that reference this limit stay visible.
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
                  Disabling…
                </>
              ) : (
                'Disable'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
