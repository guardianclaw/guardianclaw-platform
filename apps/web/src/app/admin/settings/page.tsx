'use client'

import { useState } from 'react'
import { useAdminRoles, useAdminMutation, invalidateAdminCache } from '@/hooks/use-admin-api'
import { useAdminAuth } from '@/hooks/use-admin-auth'
import { AdminRoleBadge } from '@/components/admin'
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
  Settings,
  Users,
  Shield,
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  XCircle,
  RefreshCw,
  Crown,
  Eye,
  Headphones,
} from 'lucide-react'
import { addAdminSchema, validateForm, getFirstError } from '@/lib/validations/admin'

const ROLE_CONFIG = {
  super_admin: {
    label: 'Super Admin',
    icon: Crown,
    color: 'text-yellow-500',
    description: 'Full access to all dashboards and settings',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    color: 'text-blue-500',
    description: 'All dashboards, support actions, manage alerts',
  },
  support: {
    label: 'Support',
    icon: Headphones,
    color: 'text-green-500',
    description: 'Support, Operations, and Security dashboards',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    color: 'text-muted-foreground',
    description: 'Read-only access to all dashboards',
  },
}

export default function AdminSettingsPage() {
  const { hasPermission, role: currentRole } = useAdminAuth()
  const { data, isLoading, error: fetchError, mutate } = useAdminRoles()
  const { mutateAsync } = useAdminMutation()

  const [newWallet, setNewWallet] = useState('')
  const [newRole, setNewRole] = useState<string>('viewer')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const admins = data?.roles || []
  const canManageRoles = hasPermission('manage_roles')

  const handleAddAdmin = async () => {
    setFormError(null)
    setActionError(null)

    // Validate input
    const validation = validateForm(addAdminSchema, {
      wallet_address: newWallet.trim(),
      role: newRole,
    })

    if (!validation.success) {
      setFormError(getFirstError(validation.errors))
      return
    }

    setAdding(true)
    try {
      await mutateAsync('/admin/roles', {
        method: 'POST',
        data: validation.data,
      })

      setNewWallet('')
      setNewRole('viewer')
      invalidateAdminCache('/admin/roles')
      mutate()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add admin')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveAdmin = async (adminId: string) => {
    setActionError(null)
    setDeletingId(adminId)

    try {
      await mutateAsync(`/admin/roles/${adminId}`, {
        method: 'DELETE',
      })

      invalidateAdminCache('/admin/roles')
      mutate()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove admin')
    } finally {
      setDeletingId(null)
    }
  }

  const superAdminCount = admins.filter((a) => a.role === 'super_admin' && a.is_active).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage admin roles and permissions.</p>
        </div>
        <Button variant="outline" onClick={() => mutate()} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {/* Error States */}
      {(fetchError || actionError) && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <div className="text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              <span>{fetchError?.message || actionError}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Role Hierarchy Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Hierarchy
          </CardTitle>
          <CardDescription>Available admin roles and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {Object.entries(ROLE_CONFIG).map(([key, config]) => {
              const Icon = config.icon
              return (
                <div key={key} className="flex items-start gap-3 rounded-lg border p-3">
                  <Icon className={`mt-0.5 h-5 w-5 ${config.color}`} />
                  <div>
                    <p className="font-medium">{config.label}</p>
                    <p className="text-muted-foreground text-sm">{config.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add New Admin */}
      {canManageRoles && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Admin
            </CardTitle>
            <CardDescription>Grant admin access to a wallet address</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder="Wallet address (32-44 characters)..."
                  value={newWallet}
                  onChange={(e) => {
                    setNewWallet(e.target.value)
                    setFormError(null)
                  }}
                  className={`flex-1 font-mono ${formError ? 'border-destructive' : ''}`}
                />
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currentRole === 'super_admin' && (
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    )}
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="support">Support</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddAdmin}
                  disabled={adding || !newWallet.trim()}
                  className="bg-claw-600 hover:bg-claw-700"
                >
                  {adding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span className="ml-2">Add</span>
                </Button>
              </div>
              {formError && <p className="text-destructive text-sm">{formError}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admins List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Admin Users
          </CardTitle>
          <CardDescription>Current administrators with platform access</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : admins.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
              <h3 className="mb-1 font-medium">No admin users</h3>
              <p className="text-muted-foreground text-sm">Add your first admin to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {admins.map((admin) => {
                const isSuperAdmin = admin.role === 'super_admin'
                const isLastSuperAdmin = isSuperAdmin && superAdminCount === 1
                const shortWallet = `${admin.wallet_address.slice(0, 8)}...${admin.wallet_address.slice(-8)}`

                return (
                  <div
                    key={admin.id}
                    className={`flex items-center justify-between rounded-lg border p-4 ${
                      !admin.is_active ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-sm">{shortWallet}</code>
                        <AdminRoleBadge role={admin.role} />
                        {!admin.is_active && (
                          <Badge variant="outline" className="text-red-500">
                            Inactive
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        Added {new Date(admin.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    {canManageRoles && !isLastSuperAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deletingId === admin.id}
                          >
                            {deletingId === admin.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will revoke admin access for{' '}
                              <code className="font-mono">{shortWallet}</code>. They will no longer
                              be able to access the admin dashboard.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleRemoveAdmin(admin.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove Access
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {isLastSuperAdmin && (
                      <Badge variant="outline" className="text-yellow-500">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        Cannot remove
                      </Badge>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-yellow-500" />
            <div className="text-muted-foreground text-sm">
              <p className="mb-1 font-medium">Important Notes</p>
              <ul className="list-inside list-disc space-y-1">
                <li>At least one Super Admin must always exist</li>
                <li>All role changes are logged in the audit trail</li>
                <li>Super Admins can manage all roles including other Super Admins</li>
                <li>Admins can only assign Support and Viewer roles</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
