'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { MetricCard } from '@/components/admin/metric-card'
import { Pagination } from '@/components/admin/pagination'
import {
  useSystemConfig,
  useFeatureFlags,
  useMaintenanceWindows,
  useAdminMutation,
  invalidateAdminCache,
  type ConfigItem,
  type FeatureFlag,
  type MaintenanceWindow,
} from '@/hooks/use-admin-api'
import {
  Settings2,
  Flag,
  Wrench,
  Calendar,
  AlertTriangle,
  Check,
  X,
  Pencil,
  Trash2,
  Plus,
} from 'lucide-react'
import { format, parseISO, isBefore, isAfter } from 'date-fns'
import { toast } from 'sonner'

function formatDate(date: string): string {
  return format(parseISO(date), 'MMM d, yyyy HH:mm')
}

export default function AdminSystemPage() {
  const [activeTab, setActiveTab] = useState<'config' | 'flags' | 'maintenance'>('config')
  const [editingConfig, setEditingConfig] = useState<ConfigItem | null>(null)
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null)
  const [newMaintenance, setNewMaintenance] = useState(false)
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: '',
    description: '',
    starts_at: '',
    ends_at: '',
    show_banner: true,
    affects_services: [] as string[],
  })

  const { data: configData, isLoading: configLoading } = useSystemConfig()
  const { data: flagsData, isLoading: flagsLoading } = useFeatureFlags()
  const { data: maintenanceData, isLoading: maintenanceLoading } = useMaintenanceWindows()

  const { mutateAsync } = useAdminMutation()

  const handleUpdateConfig = async () => {
    if (!editingConfig) return

    try {
      await mutateAsync('/admin/system/config/' + editingConfig.key, {
        method: 'PATCH',
        data: { value: editingConfig.value },
      })
      invalidateAdminCache('/admin/system/config')
      setEditingConfig(null)
      toast.success('Configuration updated successfully')
    } catch (error) {
      console.error('Failed to update config:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update configuration')
    }
  }

  const handleUpdateFlag = async () => {
    if (!editingFlag) return

    try {
      await mutateAsync('/admin/system/flags/' + editingFlag.id, {
        method: 'PATCH',
        data: {
          is_enabled: editingFlag.is_enabled,
          rollout_percentage: editingFlag.rollout_percentage,
          conditions: editingFlag.conditions,
        },
      })
      invalidateAdminCache('/admin/system/flags')
      setEditingFlag(null)
      toast.success('Feature flag updated successfully')
    } catch (error) {
      console.error('Failed to update flag:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update feature flag')
    }
  }

  const handleToggleFlag = async (flag: FeatureFlag) => {
    try {
      await mutateAsync('/admin/system/flags/' + flag.id, {
        method: 'PATCH',
        data: {
          is_enabled: !flag.is_enabled,
          rollout_percentage: flag.rollout_percentage,
          conditions: flag.conditions,
        },
      })
      invalidateAdminCache('/admin/system/flags')
      toast.success(`Feature flag ${!flag.is_enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.error('Failed to toggle flag:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to toggle feature flag')
    }
  }

  // Convert local datetime-local value to ISO 8601 UTC
  const toISOString = (localDatetime: string): string => {
    if (!localDatetime) return ''
    // datetime-local returns "YYYY-MM-DDTHH:mm" in local timezone
    // Create a Date object and convert to ISO string (UTC)
    return new Date(localDatetime).toISOString()
  }

  const handleCreateMaintenance = async () => {
    // Validate form
    if (!maintenanceForm.title.trim()) {
      toast.error('Please enter a title')
      return
    }
    if (!maintenanceForm.starts_at || !maintenanceForm.ends_at) {
      toast.error('Please select start and end times')
      return
    }

    const startsAt = new Date(maintenanceForm.starts_at)
    const endsAt = new Date(maintenanceForm.ends_at)
    if (endsAt <= startsAt) {
      toast.error('End time must be after start time')
      return
    }

    try {
      await mutateAsync('/admin/system/maintenance', {
        method: 'POST',
        data: {
          ...maintenanceForm,
          starts_at: toISOString(maintenanceForm.starts_at),
          ends_at: toISOString(maintenanceForm.ends_at),
        },
      })
      invalidateAdminCache('/admin/system/maintenance')
      setNewMaintenance(false)
      setMaintenanceForm({
        title: '',
        description: '',
        starts_at: '',
        ends_at: '',
        show_banner: true,
        affects_services: [],
      })
      toast.success('Maintenance window scheduled successfully')
    } catch (error) {
      console.error('Failed to create maintenance window:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create maintenance window')
    }
  }

  const handleDeleteMaintenance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this maintenance window?')) return

    try {
      await mutateAsync('/admin/system/maintenance/' + id, {
        method: 'DELETE',
      })
      invalidateAdminCache('/admin/system/maintenance')
      toast.success('Maintenance window deleted')
    } catch (error) {
      console.error('Failed to delete maintenance window:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete maintenance window')
    }
  }

  const handleToggleMaintenance = async (id: string, isActive: boolean) => {
    try {
      await mutateAsync('/admin/system/maintenance/' + id, {
        method: 'PATCH',
        data: { is_active: !isActive },
      })
      invalidateAdminCache('/admin/system/maintenance')
      toast.success(`Maintenance window ${!isActive ? 'activated' : 'deactivated'}`)
    } catch (error) {
      console.error('Failed to toggle maintenance window:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to toggle maintenance window')
    }
  }

  const config = configData?.config || []
  const flags = flagsData?.flags || []
  const windows = maintenanceData?.windows || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">System Configuration</h2>
          <p className="text-muted-foreground">
            Manage platform settings, feature flags, and maintenance windows
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Config Keys"
          value={config.length}
          subtitle={`${configData?.categories?.length || 0} categories`}
          icon={Settings2}
          loading={configLoading}
        />
        <MetricCard
          title="Feature Flags"
          value={flagsData?.stats?.total || 0}
          subtitle={`${flagsData?.stats?.enabled || 0} enabled`}
          icon={Flag}
          variant={flagsData?.stats?.partial_rollout ? 'warning' : 'default'}
          loading={flagsLoading}
        />
        <MetricCard
          title="Active Maintenance"
          value={maintenanceData?.stats?.active || 0}
          subtitle={`${maintenanceData?.stats?.upcoming || 0} upcoming`}
          icon={Wrench}
          variant={maintenanceData?.stats?.active ? 'warning' : 'default'}
          loading={maintenanceLoading}
        />
        <MetricCard
          title="Total Windows"
          value={maintenanceData?.stats?.total || 0}
          subtitle={`${maintenanceData?.stats?.past || 0} past`}
          icon={Calendar}
          loading={maintenanceLoading}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b">
        <Button
          variant={activeTab === 'config' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('config')}
          className="rounded-b-none"
        >
          <Settings2 className="mr-2 h-4 w-4" />
          Configuration
        </Button>
        <Button
          variant={activeTab === 'flags' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('flags')}
          className="rounded-b-none"
        >
          <Flag className="mr-2 h-4 w-4" />
          Feature Flags
        </Button>
        <Button
          variant={activeTab === 'maintenance' ? 'default' : 'ghost'}
          onClick={() => setActiveTab('maintenance')}
          className="rounded-b-none"
        >
          <Wrench className="mr-2 h-4 w-4" />
          Maintenance
        </Button>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <Card>
          <CardHeader>
            <CardTitle>Platform Configuration</CardTitle>
            <CardDescription>Key-value settings for the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {config.map((item) => (
                  <TableRow key={item.key}>
                    <TableCell className="font-mono text-sm">{item.key}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-sm">
                      {item.is_sensitive ? '[REDACTED]' : JSON.stringify(item.value)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.updated_at ? formatDate(item.updated_at) : '-'}
                    </TableCell>
                    <TableCell>
                      {!item.is_sensitive && (
                        <Button variant="ghost" size="sm" onClick={() => setEditingConfig(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Feature Flags Tab */}
      {activeTab === 'flags' && (
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>Control feature availability and rollout</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Flag</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Rollout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flags.map((flag) => (
                  <TableRow key={flag.id}>
                    <TableCell>
                      <div className="font-medium">{flag.name}</div>
                      <div className="text-muted-foreground font-mono text-xs">{flag.id}</div>
                    </TableCell>
                    <TableCell className="max-w-[200px] text-sm">
                      {flag.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={flag.rollout_percentage === 100 ? 'default' : 'secondary'}>
                        {flag.rollout_percentage}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={flag.is_enabled}
                        onCheckedChange={() => handleToggleFlag(flag)}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => setEditingFlag(flag)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Maintenance Tab */}
      {activeTab === 'maintenance' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Maintenance Windows</CardTitle>
              <CardDescription>Schedule and manage maintenance periods</CardDescription>
            </div>
            <Button onClick={() => setNewMaintenance(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Schedule Maintenance
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {windows.map((window) => {
                  const now = new Date()
                  const startsAt = parseISO(window.starts_at)
                  const endsAt = parseISO(window.ends_at)
                  const isPast = isAfter(now, endsAt)
                  const isUpcoming = isBefore(now, startsAt)

                  return (
                    <TableRow key={window.id}>
                      <TableCell>
                        <div className="font-medium">{window.title}</div>
                        {window.description && (
                          <div className="text-muted-foreground max-w-[200px] truncate text-xs">
                            {window.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{formatDate(window.starts_at)}</div>
                        <div className="text-muted-foreground">to {formatDate(window.ends_at)}</div>
                      </TableCell>
                      <TableCell>
                        {window.affects_services.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {window.affects_services.map((service) => (
                              <Badge key={service} variant="outline" className="text-xs">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">All services</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {window.is_active ? (
                          <Badge variant="destructive">
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            Active
                          </Badge>
                        ) : isPast ? (
                          <Badge variant="secondary">Past</Badge>
                        ) : isUpcoming ? (
                          <Badge variant="outline">Scheduled</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={window.is_active}
                            onCheckedChange={() =>
                              handleToggleMaintenance(window.id, window.is_active)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteMaintenance(window.id)}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {windows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-8 text-center">
                      No maintenance windows scheduled
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Edit Config Modal */}
      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Key</label>
              <Input value={editingConfig?.key || ''} disabled className="font-mono" />
            </div>
            <div>
              <label className="text-sm font-medium">Value (JSON)</label>
              <Textarea
                value={JSON.stringify(editingConfig?.value, null, 2)}
                onChange={(e) => {
                  try {
                    const value = JSON.parse(e.target.value)
                    setEditingConfig((prev) => (prev ? { ...prev, value } : null))
                  } catch {
                    // Invalid JSON, don't update
                  }
                }}
                className="h-32 font-mono"
              />
            </div>
            {editingConfig?.description && (
              <p className="text-muted-foreground text-sm">{editingConfig.description}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateConfig}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Flag Modal */}
      <Dialog open={!!editingFlag} onOpenChange={() => setEditingFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Feature Flag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Flag ID</label>
              <Input value={editingFlag?.id || ''} disabled className="font-mono" />
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input value={editingFlag?.name || ''} disabled />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Enabled</label>
              <Switch
                checked={editingFlag?.is_enabled || false}
                onCheckedChange={(checked) =>
                  setEditingFlag((prev) => (prev ? { ...prev, is_enabled: checked } : null))
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">Rollout Percentage</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={editingFlag?.rollout_percentage || 0}
                onChange={(e) =>
                  setEditingFlag((prev) =>
                    prev ? { ...prev, rollout_percentage: parseInt(e.target.value) || 0 } : null
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFlag(null)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateFlag}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Maintenance Modal */}
      <Dialog open={newMaintenance} onOpenChange={setNewMaintenance}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={maintenanceForm.title}
                onChange={(e) => setMaintenanceForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Scheduled maintenance"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={maintenanceForm.description}
                onChange={(e) =>
                  setMaintenanceForm((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Description of the maintenance..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Start Time</label>
                <Input
                  type="datetime-local"
                  value={maintenanceForm.starts_at}
                  onChange={(e) =>
                    setMaintenanceForm((prev) => ({ ...prev, starts_at: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">End Time</label>
                <Input
                  type="datetime-local"
                  value={maintenanceForm.ends_at}
                  onChange={(e) =>
                    setMaintenanceForm((prev) => ({ ...prev, ends_at: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Show Banner</label>
              <Switch
                checked={maintenanceForm.show_banner}
                onCheckedChange={(checked) =>
                  setMaintenanceForm((prev) => ({ ...prev, show_banner: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewMaintenance(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateMaintenance}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
