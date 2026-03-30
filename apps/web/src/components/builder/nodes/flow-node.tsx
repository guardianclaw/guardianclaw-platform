'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import { GitFork, History, LayoutGrid } from 'lucide-react'
import { FlowNodeData } from '@/stores'
import { BaseNode } from './base-node'
import { SourceHandle, TargetHandle } from './custom-handle'
import { cn } from '@/lib/utils'

interface FlowNodeProps {
  data: FlowNodeData
  selected?: boolean
}

const flowTypeConfig = {
  router: {
    icon: GitFork,
    title: 'Router',
    subtitle: 'Conditional routing',
    badge: 'FLOW',
  },
  merge: {
    icon: LayoutGrid,
    title: 'Merge',
    subtitle: 'Combine flows',
    badge: 'FLOW',
  },
  loop: {
    icon: History,
    title: 'Loop',
    subtitle: 'Iterate process',
    badge: 'FLOW',
  },
}

function FlowNodeComponent({ data, selected }: FlowNodeProps) {
  const flowType = data.flowType || 'router'
  const config = flowTypeConfig[flowType] || flowTypeConfig.router
  const Icon = config.icon

  // Conditional handles for router node (like condition node)
  const routerHandles = (
    <>
      <SourceHandle position={Position.Right} category="flow" style={{ top: '30%' }} />
      <SourceHandle position={Position.Right} category="flow" style={{ top: '70%' }} />
    </>
  )

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="orange"
      badge={config.badge}
      handles={
        <>
          <TargetHandle position={Position.Left} category="flow" />
          {flowType === 'router' ? (
            routerHandles
          ) : (
            <SourceHandle position={Position.Right} category="flow" />
          )}
        </>
      }
    >
      {/* Flow-specific configuration preview */}
      <div className="space-y-2">
        {flowType === 'router' && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-zinc-400">Path A →</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-zinc-400">Path B →</span>
            </div>
            {!!data.config?.defaultPath && (
              <div className="flex items-center gap-2 text-xs">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <span className="text-zinc-400">Default →</span>
              </div>
            )}
          </div>
        )}

        {flowType === 'loop' && (
          <div className="text-xs text-zinc-500">
            {data.config?.iterations
              ? `Iterations: ${data.config.iterations}`
              : 'Configure loop...'}
          </div>
        )}

        {flowType === 'merge' && (
          <div className="text-xs text-zinc-500">Combines inputs into a single flow.</div>
        )}
      </div>
    </BaseNode>
  )
}

export const FlowNode = memo(FlowNodeComponent)
