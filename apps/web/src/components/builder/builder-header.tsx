'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Save,
  Play,
  Cloud,
  MoreVertical,
  Settings,
  Trash2,
  ChevronDown,
  Loader2,
  FileCode2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Agent, agentsApi } from '@/lib/api'
import { useFlowStore, useIsDirty, useIsSaving } from '@/stores'
import { ExportCodeDialog } from './export-code-dialog'

interface BuilderHeaderProps {
  agent: Agent
  isDemo?: boolean
}

const statusColors = {
  draft: 'bg-gray-500',
  testing: 'bg-yellow-500',
  deployed: 'bg-green-500',
  archived: 'bg-red-500',
}

export function BuilderHeader({ agent, isDemo = false }: BuilderHeaderProps) {
  const router = useRouter()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const isDirty = useIsDirty()
  const isSaving = useIsSaving()
  const markClean = useFlowStore((state) => state.markClean)
  const setSaving = useFlowStore((state) => state.setSaving)

  const handleSave = useCallback(async () => {
    if (!isDirty || isSaving) return

    try {
      setSaving(true)
      setSaveError(null)

      await agentsApi.update(agent.id, {
        flow: { nodes, edges },
      })

      markClean()
    } catch (err) {
      console.error('Failed to save:', err)
      setSaveError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }, [agent.id, nodes, edges, isDirty, isSaving, markClean, setSaving])

  const handleTest = useCallback(() => {
    // Navigate to test page
    if (isDemo) {
      router.push('/app/builder/demo/test')
    } else {
      router.push(`/app/builder/${agent.id}/test`)
    }
  }, [agent.id, isDemo, router])

  const handleDeploy = useCallback(async () => {
    // Save first if dirty
    if (isDirty) {
      await handleSave()
    }
    router.push(`/app/builder/${agent.id}/deploy`)
  }, [agent.id, isDirty, handleSave, router])

  const handleSettings = useCallback(() => {
    router.push(`/app/builder/${agent.id}/settings`)
  }, [agent.id, router])

  const handleBack = useCallback(() => {
    if (isDirty) {
      const confirm = window.confirm('You have unsaved changes. Are you sure you want to leave?')
      if (!confirm) return
    }
    router.push('/dashboard')
  }, [isDirty, router])

  // Keyboard shortcut for save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 flex h-14 items-center gap-4 border-b px-4 backdrop-blur">
      {/* Back button */}
      <Button variant="ghost" size="icon" onClick={handleBack} className="shrink-0">
        <ArrowLeft className="h-5 w-5" />
      </Button>

      {/* Agent name and status */}
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate font-semibold">{agent.name}</h1>
        <Badge variant="secondary" className={`${statusColors[agent.status]} shrink-0 text-white`}>
          {agent.status}
        </Badge>
        {isDirty && <span className="text-muted-foreground shrink-0 text-xs">Unsaved changes</span>}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Error message */}
      {saveError && <span className="text-destructive text-sm">{saveError}</span>}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {/* Save button - disabled in demo mode */}
        {!isDemo && (
          <Button variant="outline" size="sm" onClick={handleSave} disabled={!isDirty || isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save
          </Button>
        )}

        {/* Test button */}
        <Button variant="outline" size="sm" onClick={handleTest}>
          <Play className="mr-2 h-4 w-4" />
          Test
        </Button>

        {/* Deploy button - disabled in demo mode */}
        {!isDemo && (
          <Button size="sm" onClick={handleDeploy} className="bg-claw-600 hover:bg-claw-700">
            <Cloud className="mr-2 h-4 w-4" />
            Deploy
          </Button>
        )}

        {/* More options - hide in demo mode */}
        {!isDemo && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleSettings}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setExportDialogOpen(true)}>
                <FileCode2 className="mr-2 h-4 w-4" />
                Export Code
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this agent?')) {
                    agentsApi.delete(agent.id).then(() => router.push('/dashboard'))
                  }
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Export Code Dialog */}
      <ExportCodeDialog agent={agent} open={exportDialogOpen} onOpenChange={setExportDialogOpen} />
    </header>
  )
}
