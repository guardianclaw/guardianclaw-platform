'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import { Clock, Terminal } from 'lucide-react'
import { FlowNodeData } from '@/stores'
import { BaseNode } from './base-node'
import { SourceHandle, TargetHandle } from './custom-handle'

interface UtilityNodeProps {
  data: FlowNodeData
  selected?: boolean
}

const utilityTypeConfig = {
  delay: {
    icon: Clock,
    title: 'Delay',
    subtitle: 'Pause execution',
    badge: 'UTILITY',
  },
  log: {
    icon: Terminal,
    title: 'Log',
    subtitle: 'Record events',
    badge: 'UTILITY',
  },
}

function UtilityNodeComponent({ data, selected }: UtilityNodeProps) {
  const utilityType = data.utilityType || 'delay'
  const config = utilityTypeConfig[utilityType] || utilityTypeConfig.delay
  const Icon = config.icon

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="gray"
      badge={config.badge}
      handles={
        <>
          <TargetHandle position={Position.Left} category="utility" />
          <SourceHandle position={Position.Right} category="utility" />
        </>
      }
    >
      {/* Utility-specific configuration preview */}
      <div className="space-y-2">
        {utilityType === 'delay' && (
          <div className="text-xs text-zinc-500">
            {data.config?.duration
              ? `Duration: ${data.config.duration} ms`
              : 'Configure duration...'}
          </div>
        )}
        {utilityType === 'log' && (
          <div className="text-xs text-zinc-500">
            {data.config?.message ? `Message: "${data.config.message}"` : 'Configure message...'}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const UtilityNode = memo(UtilityNodeComponent)
