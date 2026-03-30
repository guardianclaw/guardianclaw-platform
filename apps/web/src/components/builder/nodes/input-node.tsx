'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import { MessageSquare, Globe, Webhook, Play } from 'lucide-react'
import { FlowNodeData } from '@/stores'
import { BaseNode } from './base-node'
import { SourceHandle } from './custom-handle'

interface InputNodeProps {
  data: FlowNodeData
  selected?: boolean
}

const inputTypeConfig = {
  user_message: {
    icon: MessageSquare,
    title: 'User Message',
    subtitle: 'Text input from user',
  },
  api_call: {
    icon: Globe,
    title: 'API Input',
    subtitle: 'REST API endpoint',
  },
  webhook: {
    icon: Webhook,
    title: 'Webhook',
    subtitle: 'External trigger',
  },
}

function InputNodeComponent({ data, selected }: InputNodeProps) {
  const inputType = data.inputType || 'user_message'
  const config = inputTypeConfig[inputType] || inputTypeConfig.user_message
  const Icon = config.icon

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="blue"
      badge="TRIGGER"
      handles={<SourceHandle position={Position.Right} category="input" />}
    >
      {/* Input configuration preview */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Play className="h-3 w-3 text-blue-500" />
          <span className="text-muted-foreground">Type:</span>
          <span className="text-foreground/90 font-medium">{inputType.replace('_', ' ')}</span>
        </div>
        {inputType === 'api_call' && (data.config?.endpoint as string) && (
          <div className="text-muted-foreground bg-muted/50 truncate rounded px-2 py-1 font-mono text-xs">
            {data.config?.endpoint as string}
          </div>
        )}
        {inputType === 'webhook' && (data.config?.path as string) && (
          <div className="text-muted-foreground bg-muted/50 truncate rounded px-2 py-1 font-mono text-xs">
            POST {data.config?.path as string}
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const InputNode = memo(InputNodeComponent)
