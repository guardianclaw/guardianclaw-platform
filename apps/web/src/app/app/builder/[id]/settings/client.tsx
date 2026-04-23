'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Settings,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Trash2,
  Bot,
  FileText,
  Tag,
  Layers,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { useAgent } from '../context'
import { agentsApi } from '@/lib/api'

// Framework options
const frameworks = [
  { value: 'openai_agents', label: 'OpenAI Agents', icon: '🤖' },
  { value: 'anthropic_sdk', label: 'Anthropic', icon: '🧠' },
  { value: 'coinbase_agentkit', label: 'Coinbase AgentKit', icon: '💰' },
  { value: 'solana_agent_kit', label: 'Solana Agent Kit', icon: '◎' },
  { value: 'google_adk', label: 'Google ADK', icon: '🔷' },
  { value: 'virtuals_protocol', label: 'Virtuals Protocol', icon: '🎮' },
  { value: 'elizaos', label: 'ElizaOS', icon: '💡' },
  { value: 'voltagent', label: 'VoltAgent', icon: '⚡' },
  { value: 'openclaw', label: 'OpenClaw', icon: '🛡️' },
  { value: 'custom', label: 'Custom', icon: '⚙️' },
]

// Status options
const statuses = [
  { value: 'draft', label: 'Draft', color: 'bg-gray-500', description: 'Work in progress' },
  { value: 'testing', label: 'Testing', color: 'bg-yellow-500', description: 'Under testing' },
  {
    value: 'deployed',
    label: 'Deployed',
    color: 'bg-green-500',
    description: 'Live in production',
  },
  { value: 'archived', label: 'Archived', color: 'bg-red-500', description: 'No longer active' },
]

// Common emoji icons for agents
const iconOptions = ['🤖', '🦜', '💰', '◎', '🔷', '🎮', '👥', '⚙️', '🛡️', '🧠', '💡', '🚀']

export function SettingsPageClient() {
  const router = useRouter()
  const { agent, isDemo, refetch } = useAgent()

  type AgentStatus = 'draft' | 'testing' | 'deployed' | 'archived'

  // Local state for editing
  const [name, setName] = useState(agent?.name || '')
  const [description, setDescription] = useState(agent?.description || '')
  const [icon, setIcon] = useState(agent?.icon || '🤖')
  const [status, setStatus] = useState<AgentStatus>(agent?.status || 'draft')

  // UI state
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Check if there are unsaved changes
  const hasChanges =
    agent &&
    (name !== agent.name ||
      description !== (agent.description || '') ||
      icon !== agent.icon ||
      status !== agent.status)

  // Validation
  const isValid = name.trim().length >= 2

  // Save changes
  const handleSave = useCallback(async () => {
    if (!agent || isDemo || !isValid) return

    try {
      setSaving(true)
      setError(null)
      setSuccess(false)

      await agentsApi.update(agent.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        icon,
        status: status as 'draft' | 'testing' | 'deployed' | 'archived',
      })

      setSuccess(true)
      refetch()

      // Clear success after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      console.error('Failed to save settings:', err)
      setError(err.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }, [agent, isDemo, isValid, name, description, icon, status, refetch])

  // Delete agent
  const handleDelete = useCallback(async () => {
    if (!agent || isDemo) return

    try {
      setDeleting(true)
      await agentsApi.delete(agent.id)
      router.push('/builder')
    } catch (err: any) {
      console.error('Failed to delete agent:', err)
      setError(err.message || 'Failed to delete agent')
      setDeleting(false)
    }
  }, [agent, isDemo, router])

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading settings...</p>
        </div>
      </div>
    )
  }

  // Demo mode notice
  if (isDemo) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="max-w-md text-center">
          <Settings className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
          <h2 className="mb-2 text-xl font-semibold">Settings Not Available</h2>
          <p className="text-muted-foreground">Sign in to configure your agent settings.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="container max-w-2xl py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Settings className="text-muted-foreground h-6 w-6" />
            Agent Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure basic settings for your agent</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-destructive/10 border-destructive/20 mb-6 rounded-lg border p-4">
            <p className="text-destructive flex items-center gap-2 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
            <p className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Settings saved successfully
            </p>
          </div>
        )}

        {/* Basic Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>Name and description for your agent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Agent Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setSuccess(false)
                }}
                placeholder="My AI Agent"
                className={cn(!isValid && name.length > 0 && 'border-destructive')}
              />
              {!isValid && name.length > 0 && (
                <p className="text-destructive text-xs">Name must be at least 2 characters</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setSuccess(false)
                }}
                placeholder="What does this agent do?"
                rows={3}
              />
              <p className="text-muted-foreground text-xs">
                A brief description of your agent&apos;s worth
              </p>
            </div>

            {/* Icon */}
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {iconOptions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setIcon(emoji)
                      setSuccess(false)
                    }}
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg text-xl',
                      'border-2 transition-colors',
                      icon === emoji
                        ? 'border-claw-500 bg-claw-50'
                        : 'border-border hover:border-muted-foreground'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Framework & Status */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Framework & Status
            </CardTitle>
            <CardDescription>Agent configuration and deployment status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Framework (read-only) */}
            <div className="space-y-2">
              <Label>Framework</Label>
              <div className="bg-muted flex items-center gap-3 rounded-lg p-3">
                <span className="text-xl">
                  {frameworks.find((f) => f.value === agent.framework)?.icon || '⚙️'}
                </span>
                <div>
                  <p className="font-medium">
                    {frameworks.find((f) => f.value === agent.framework)?.label || agent.framework}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Framework cannot be changed after creation
                  </p>
                </div>
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as AgentStatus)
                  setSuccess(false)
                }}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 rounded-full', s.color)} />
                        <span>{s.label}</span>
                        <span className="text-muted-foreground text-xs">({s.description})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Version info */}
            <div className="space-y-2">
              <Label>Version</Label>
              <div className="flex items-center gap-2">
                <Badge variant="outline">v{agent.version}</Badge>
                <span className="text-muted-foreground text-xs">
                  Created {new Date(agent.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50 mb-6">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>Irreversible actions that affect your agent</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-destructive/5 border-destructive/20 flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Delete Agent</p>
                <p className="text-muted-foreground text-sm">
                  Permanently delete this agent and all associated data
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteDialog(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-sm">
            {hasChanges ? (
              <span className="text-amber-600">You have unsaved changes</span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges || !isValid}
            className="bg-claw-600 hover:bg-claw-700"
          >
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save Settings
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{agent.name}</strong> and all associated data
              including API keys, deployments, and analytics. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete Agent
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
