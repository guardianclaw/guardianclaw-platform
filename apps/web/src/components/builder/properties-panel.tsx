'use client'

import { useSelectedNode, useFlowStore } from '@/stores'
import { InputProperties } from './properties/input-properties'
import { ProcessProperties } from './properties/process-properties'
import { GuardianClawProperties } from './properties/claw-properties'
import { ToolProperties } from './properties/tool-properties'
import { OutputProperties } from './properties/output-properties'
import { FlowProperties } from './properties/flow-properties'
import { MemoryProperties } from './properties/memory-properties'
import { UtilityProperties } from './properties/utility-properties'
import { Settings, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Map node types to their property components
const propertyComponents: Record<string, React.ComponentType<PropertyComponentProps>> = {
  input: InputProperties,
  process: ProcessProperties,
  claw: GuardianClawProperties,
  tool: ToolProperties,
  output: OutputProperties,
  flow: FlowProperties,
  memory: MemoryProperties,
  utility: UtilityProperties,
}

export interface PropertyComponentProps {
  data: Record<string, unknown>
  onChange: (data: Record<string, unknown>) => void
}

export function PropertiesPanel() {
  const selectedNode = useSelectedNode()
  const updateNode = useFlowStore((state) => state.updateNode)
  const selectNode = useFlowStore((state) => state.selectNode)

  if (!selectedNode) {
    return (
      <div className="bg-muted/30 flex w-80 flex-col border-l">
        <div className="border-b p-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <Settings className="h-4 w-4" />
            Properties
          </h2>
        </div>
        <div className="flex flex-1 items-center justify-center p-4">
          <p className="text-muted-foreground text-center text-sm">
            Select a node to view and edit its properties
          </p>
        </div>
      </div>
    )
  }

  const PropertyComponent = propertyComponents[selectedNode.type || '']

  const handleChange = (data: Record<string, unknown>) => {
    updateNode(selectedNode.id, data)
  }

  const handleClose = () => {
    selectNode(null)
  }

  return (
    <div className="bg-background flex w-80 flex-col border-l">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="flex items-center gap-2 font-semibold">
          <Settings className="h-4 w-4" />
          Properties
        </h2>
        <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Node info */}
      <div className="space-y-3 border-b p-4">
        <div>
          <label className="text-muted-foreground text-xs font-medium uppercase">Node Type</label>
          <p className="font-medium capitalize">{selectedNode.type}</p>
        </div>
        <div>
          <label className="text-muted-foreground text-xs font-medium uppercase">Label</label>
          <p className="font-medium">{selectedNode.data.label as string}</p>
        </div>
        <div>
          <label className="text-muted-foreground text-xs font-medium uppercase">ID</label>
          <p className="text-muted-foreground truncate font-mono text-xs">{selectedNode.id}</p>
        </div>
      </div>

      {/* Property fields */}
      <div className="flex-1 overflow-y-auto p-4">
        {PropertyComponent ? (
          <PropertyComponent
            data={selectedNode.data as Record<string, unknown>}
            onChange={handleChange}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            No configurable properties for this node type.
          </p>
        )}
      </div>
    </div>
  )
}
