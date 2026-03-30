'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import { Search, Terminal, Globe, Database, Clock, Zap } from 'lucide-react'
import { FlowNodeData } from '@/stores'
import { BaseNode } from './base-node'
import { SourceHandle, TargetHandle } from './custom-handle'

interface ToolNodeProps {
  data: FlowNodeData
  selected?: boolean
}

const toolTypeConfig = {
  web_search: {
    icon: Search,
    title: 'Web Search',
    subtitle: 'Search the internet',
    badge: 'SEARCH',
  },
  code_exec: {
    icon: Terminal,
    title: 'Code Execution',
    subtitle: 'Run code safely',
    badge: 'CODE',
  },
  api_request: {
    icon: Globe,
    title: 'API Request',
    subtitle: 'Call external APIs',
    badge: 'HTTP',
  },
  database: {
    icon: Database,
    title: 'Database',
    subtitle: 'Query databases',
    badge: 'SQL',
  },
}

function ToolNodeComponent({ data, selected }: ToolNodeProps) {
  const toolType = data.toolType || 'web_search'
  const config = toolTypeConfig[toolType] || toolTypeConfig.web_search
  const Icon = config.icon

  const timeout = data.config?.timeout as number | undefined
  const method = data.config?.method as string | undefined
  const url = data.config?.url as string | undefined

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="amber"
      badge={config.badge}
      handles={
        <>
          <TargetHandle position={Position.Left} category="tool" />
          <SourceHandle position={Position.Right} category="tool" />
        </>
      }
    >
      {/* Tool configuration preview */}
      <div className="space-y-2">
        {/* Tool type specific info */}
        {toolType === 'web_search' && (
          <div className="flex items-center gap-2 text-xs">
            <Zap className="h-3 w-3 text-amber-500" />
            <span className="text-zinc-400">Engine:</span>
            <span className="text-zinc-200">{(data.config?.engine as string) || 'DuckDuckGo'}</span>
          </div>
        )}

        {toolType === 'api_request' && (
          <>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-400">
                {method || 'GET'}
              </span>
              <span className="flex-1 truncate text-zinc-400">{url || 'Configure URL...'}</span>
            </div>
          </>
        )}

        {toolType === 'code_exec' && (
          <div className="rounded bg-zinc-800/50 px-2 py-1 font-mono text-xs text-zinc-500">
            {(data.config?.runtime as string) || 'Python 3.11'}
          </div>
        )}

        {toolType === 'database' && (
          <div className="flex items-center gap-2 text-xs">
            <Database className="h-3 w-3 text-amber-500" />
            <span className="text-zinc-400">Connection:</span>
            <span className="text-zinc-200">
              {(data.config?.connection as string) || 'Default'}
            </span>
          </div>
        )}

        {/* Timeout indicator */}
        {timeout && (
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="h-3 w-3" />
            <span>Timeout: {timeout / 1000}s</span>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const ToolNode = memo(ToolNodeComponent)
