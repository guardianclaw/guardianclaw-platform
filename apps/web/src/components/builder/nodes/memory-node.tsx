'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import { Database, ScrollText, GitCommit } from 'lucide-react'
import { FlowNodeData } from '@/stores'
import { BaseNode } from './base-node'
import { SourceHandle, TargetHandle } from './custom-handle'

interface MemoryNodeProps {
  data: FlowNodeData
  selected?: boolean
}

const memoryTypeConfig = {
  buffer: {
    icon: ScrollText,
    title: 'Buffer Memory',
    subtitle: 'Stores recent conversations',
    badge: 'MEMORY',
  },
  vector: {
    icon: Database,
    title: 'Vector Memory',
    subtitle: 'Semantic search & retrieval',
    badge: 'MEMORY',
  },
  summary: {
    icon: GitCommit,
    title: 'Summary Memory',
    subtitle: 'Condenses long contexts',
    badge: 'MEMORY',
  },
}

function MemoryNodeComponent({ data, selected }: MemoryNodeProps) {
  const memoryType = data.memoryType || 'buffer'
  const config = memoryTypeConfig[memoryType] || memoryTypeConfig.buffer
  const Icon = config.icon

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="blue"
      badge={config.badge}
      handles={
        <>
          <TargetHandle position={Position.Left} category="memory" />
          <SourceHandle position={Position.Right} category="memory" />
        </>
      }
    >
      {/* Memory-specific configuration preview */}
      <div className="space-y-2">
        {memoryType === 'buffer' && (
          <div className="text-xs text-zinc-500">
            {data.config?.size ? `Max size: ${data.config.size} turns` : 'Configure size...'}
          </div>
        )}
        {memoryType === 'vector' && (
          <div className="text-xs text-zinc-500">
            {data.config?.collection
              ? `Collection: ${data.config.collection}`
              : 'Configure collection...'}
          </div>
        )}
        {memoryType === 'summary' && (
          <div className="text-xs text-zinc-500">
            {data.config?.llm ? `LLM: ${data.config.llm}` : 'Configure LLM...'}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const MemoryNode = memo(MemoryNodeComponent)
