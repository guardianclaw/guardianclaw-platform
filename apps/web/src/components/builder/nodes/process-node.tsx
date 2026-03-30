'use client'

import { memo } from 'react'
import { Position } from '@xyflow/react'
import { Brain, GitBranch, Sparkles, Thermometer } from 'lucide-react'
import { FlowNodeData } from '@/stores'
import { BaseNode } from './base-node'
import { SourceHandle, TargetHandle } from './custom-handle'
import { cn } from '@/lib/utils'

interface ProcessNodeProps {
  data: FlowNodeData
  selected?: boolean
}

const processTypeConfig = {
  llm_call: {
    icon: Brain,
    title: 'LLM Call',
    subtitle: 'AI model inference',
    badge: 'AI',
  },
  condition: {
    icon: GitBranch,
    title: 'Condition',
    subtitle: 'Branch logic',
    badge: 'IF/ELSE',
  },
}

const modelLabels: Record<string, string> = {
  'gpt-4o': 'GPT-4o',
  'gpt-4o-mini': 'GPT-4o Mini',
  'gpt-4-turbo': 'GPT-4 Turbo',
  'claude-3-opus': 'Claude 3 Opus',
  'claude-3-sonnet': 'Claude 3 Sonnet',
  'claude-3-haiku': 'Claude 3 Haiku',
}

function ProcessNodeComponent({ data, selected }: ProcessNodeProps) {
  const processType = data.processType || 'llm_call'
  const config = processTypeConfig[processType] || processTypeConfig.llm_call
  const Icon = config.icon

  const model = data.config?.model as string | undefined
  const temperature = data.config?.temperature as number | undefined
  const maxTokens = data.config?.maxTokens as number | undefined

  return (
    <BaseNode
      data={data}
      selected={selected}
      icon={<Icon className="h-5 w-5" />}
      title={data.label || config.title}
      subtitle={config.subtitle}
      color="purple"
      badge={config.badge}
      handles={
        <>
          <TargetHandle position={Position.Left} category="process" />
          {processType === 'condition' ? (
            <>
              <SourceHandle position={Position.Right} category="process" style={{ top: '30%' }} />
              <SourceHandle position={Position.Right} category="process" style={{ top: '70%' }} />
            </>
          ) : (
            <SourceHandle position={Position.Right} category="process" />
          )}
        </>
      }
    >
      {/* Process configuration preview */}
      <div className="space-y-2">
        {processType === 'llm_call' && (
          <>
            {/* Model */}
            <div className="flex items-center gap-2">
              <Sparkles className="h-3 w-3 text-purple-500" />
              <span className="text-muted-foreground text-xs">Model:</span>
              <span className="text-foreground/90 text-xs font-medium">
                {model ? modelLabels[model] || model : 'Not set'}
              </span>
            </div>

            {/* Temperature bar */}
            {temperature !== undefined && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Thermometer className="h-3 w-3" />
                    Temperature
                  </span>
                  <span className="text-foreground/80">{temperature}</span>
                </div>
                <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      temperature < 0.3 && 'bg-blue-500',
                      temperature >= 0.3 && temperature < 0.7 && 'bg-purple-500',
                      temperature >= 0.7 && 'bg-orange-500'
                    )}
                    style={{ width: `${temperature * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Max tokens */}
            {maxTokens && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Max tokens</span>
                <span className="text-foreground/80 font-mono">{maxTokens}</span>
              </div>
            )}
          </>
        )}

        {processType === 'condition' && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">True →</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">False →</span>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  )
}

export const ProcessNode = memo(ProcessNodeComponent)
