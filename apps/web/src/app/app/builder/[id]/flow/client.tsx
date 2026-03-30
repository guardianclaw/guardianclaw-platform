'use client'

import { useEffect, useCallback, useState, useRef } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Save, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BuilderCanvas } from '@/components/builder/builder-canvas'
import { PropertiesPanel } from '@/components/builder/properties-panel'
import { useFlowStore, useIsDirty, useIsSaving, FlowNode, FlowEdge } from '@/stores'
import { agentsApi } from '@/lib/api'
import { useAgent } from '../context'

export function FlowPageClient() {
  const { agent, isDemo, refetch } = useAgent()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const initializedRef = useRef(false)

  // Flow store
  const loadFlow = useFlowStore((state) => state.loadFlow)
  const nodes = useFlowStore((state) => state.nodes)
  const edges = useFlowStore((state) => state.edges)
  const isDirty = useIsDirty()
  const isSaving = useIsSaving()
  const markClean = useFlowStore((state) => state.markClean)
  const setSaving = useFlowStore((state) => state.setSaving)
  const reset = useFlowStore((state) => state.reset)

  // Set mounted after client-side hydration
  useEffect(() => {
    setMounted(true)
  }, [])

  // Load agent flow into store (only once after mount)
  useEffect(() => {
    if (agent && mounted && !initializedRef.current) {
      initializedRef.current = true

      const flowNodes = (agent.flow?.nodes || []) as FlowNode[]
      const flowEdges = (agent.flow?.edges || []) as FlowEdge[]

      // Load the flow into the store
      loadFlow(isDemo ? 'demo' : agent.id, agent.name, flowNodes, flowEdges)
    }
  }, [agent, isDemo, mounted, loadFlow])

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      reset()
      initializedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save handler
  const handleSave = useCallback(async () => {
    if (!agent || isDemo || !isDirty || isSaving) return

    try {
      setSaving(true)
      setSaveError(null)

      await agentsApi.update(agent.id, {
        flow: { nodes, edges },
      })

      markClean()
      // Refresh agent context so other tabs see the updated flow
      refetch()
    } catch (err) {
      console.error('Failed to save:', err)
      setSaveError('Failed to save changes')
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, isDemo, nodes, edges, isDirty, isSaving, markClean, setSaving])

  // Undo/redo
  const undo = useFlowStore((state) => state.undo)
  const redo = useFlowStore((state) => state.redo)

  // Keyboard shortcuts: save, undo, redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        redo()
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        undo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, undo, redo])

  if (!agent) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
          <p className="text-muted-foreground text-sm">Loading flow editor...</p>
        </div>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <div className="flex h-full w-full">
        {/* Canvas */}
        <div className="relative h-full flex-1">
          <BuilderCanvas />

          {/* Floating save button */}
          {!isDemo && (
            <div className="absolute right-4 top-4 flex items-center gap-2">
              {saveError && (
                <span className="text-destructive bg-background/90 rounded px-2 py-1 text-sm">
                  {saveError}
                </span>
              )}
              {isDirty && (
                <span className="text-muted-foreground bg-background/90 rounded px-2 py-1 text-sm">
                  Unsaved changes
                </span>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="bg-claw-600 hover:bg-claw-700"
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save
              </Button>
            </div>
          )}
        </div>

        {/* Properties panel */}
        <PropertiesPanel />
      </div>
    </ReactFlowProvider>
  )
}
