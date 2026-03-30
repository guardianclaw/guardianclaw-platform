'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Webhook,
  Globe,
  Brain,
  GitBranch,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Search,
  Terminal,
  Database,
  Send,
  GitFork,
  History,
  LayoutGrid,
  List,
  FileText,
  Timer,
  File,
  Sparkles,
  Eye,
  Minus,
  Twitter,
  MessageCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NodeCategory {
  id: string
  label: string
  type: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  nodes: NodeDefinition[]
}

interface NodeDefinition {
  subtype: string
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  isDivider?: boolean // Visual separator in the palette
  disabled?: boolean // Prevent dragging
  comingSoon?: boolean // Show "Soon" badge
}

const nodeCategories: NodeCategory[] = [
  {
    id: 'input',
    label: 'Input',
    type: 'input',
    icon: MessageSquare,
    color: 'bg-blue-500',
    nodes: [
      {
        subtype: 'user_message',
        label: 'User Message',
        description: 'Receive input from users',
        icon: MessageSquare,
      },
      {
        subtype: 'api_call',
        label: 'API Input',
        description: 'Accept API requests',
        icon: Globe,
      },
      {
        subtype: 'webhook',
        label: 'Webhook',
        description: 'Trigger from external events',
        icon: Webhook,
      },
    ],
  },
  {
    id: 'process',
    label: 'Process',
    type: 'process',
    icon: Brain,
    color: 'bg-purple-500',
    nodes: [
      {
        subtype: 'llm_call',
        label: 'LLM Call',
        description: 'Call an AI model',
        icon: Brain,
      },
      {
        subtype: 'condition',
        label: 'Condition',
        description: 'Branch based on conditions',
        icon: GitBranch,
      },
    ],
  },
  {
    id: 'flow',
    label: 'Flow Control',
    type: 'flow',
    icon: GitBranch,
    color: 'bg-orange-500',
    nodes: [
      {
        subtype: 'router',
        label: 'Router',
        description: 'Route based on conditions',
        icon: GitFork,
      },
      {
        subtype: 'merge',
        label: 'Merge',
        description: 'Merge multiple branches',
        icon: LayoutGrid,
      },
      {
        subtype: 'loop',
        label: 'Loop',
        description: 'Iterate over a process',
        icon: History,
      },
    ],
  },
  {
    id: 'memory',
    label: 'Memory',
    type: 'memory',
    icon: Database,
    color: 'bg-cyan-500',
    nodes: [
      {
        subtype: 'buffer',
        label: 'Buffer',
        description: 'Short-term conversation memory',
        icon: Database,
      },
      {
        subtype: 'vector',
        label: 'Vector',
        description: 'Long-term semantic memory',
        icon: List,
      },
      {
        subtype: 'summary',
        label: 'Summary',
        description: 'Summarize conversation history',
        icon: FileText,
      },
    ],
  },
  {
    id: 'claw',
    label: 'GuardianClaw',
    type: 'claw',
    icon: Shield,
    color: 'bg-green-500',
    nodes: [
      // v2.25 Layer Architecture (Recommended)
      {
        subtype: 'input_validator',
        label: 'L1: Input Validator',
        description: 'Pre-AI attack detection (700+ patterns)',
        icon: ShieldCheck,
      },
      {
        subtype: 'seed_injection',
        label: 'L2: Seed Injection',
        description: 'Alignment via system prompt',
        icon: Sparkles,
      },
      {
        subtype: 'output_validator',
        label: 'L3: Output Validator',
        description: 'Post-AI heuristic validation',
        icon: ShieldAlert,
      },
      {
        subtype: 'observer',
        label: 'L4: Observer',
        description: 'LLM-based transcript analysis',
        icon: Eye,
      },
      // Visual divider
      {
        subtype: 'divider',
        label: 'Legacy Gates',
        description: '',
        icon: Minus,
        isDivider: true,
      },
      // Legacy CLAW Gates (v2.18 compatibility)
      {
        subtype: 'all',
        label: 'All Gates (CLAW)',
        description: 'Apply all four gates',
        icon: Shield,
      },
      {
        subtype: 'credibility',
        label: 'Credibility Gate',
        description: 'Verify factual accuracy',
        icon: Shield,
      },
      {
        subtype: 'avoidance',
        label: 'Avoidance Gate',
        description: 'Check for harmful content',
        icon: Shield,
      },
      {
        subtype: 'limits',
        label: 'Limits Gate',
        description: 'Verify appropriate boundaries',
        icon: Shield,
      },
      {
        subtype: 'worth',
        label: 'Worth Gate',
        description: 'Require beneficial purpose',
        icon: Shield,
      },
    ],
  },
  {
    id: 'tool',
    label: 'Tools',
    type: 'tool',
    icon: Terminal,
    color: 'bg-amber-500',
    nodes: [
      {
        subtype: 'web_search',
        label: 'Web Search',
        description: 'Search the web',
        icon: Search,
      },
      {
        subtype: 'code_exec',
        label: 'Code Execution',
        description: 'Execute code safely',
        icon: Terminal,
      },
      {
        subtype: 'api_request',
        label: 'API Request',
        description: 'Call external APIs',
        icon: Globe,
      },
      {
        subtype: 'database',
        label: 'Database',
        description: 'Query databases',
        icon: Database,
      },
    ],
  },
  {
    id: 'utility',
    label: 'Utility',
    type: 'utility',
    icon: Terminal,
    color: 'bg-gray-500',
    nodes: [
      {
        subtype: 'delay',
        label: 'Delay',
        description: 'Wait for a specified time',
        icon: Timer,
      },
      {
        subtype: 'log',
        label: 'Log',
        description: 'Log data to the console',
        icon: File,
      },
    ],
  },
  {
    id: 'output',
    label: 'Output',
    type: 'output',
    icon: Send,
    color: 'bg-red-500',
    nodes: [
      {
        subtype: 'response',
        label: 'Response',
        description: 'Send response to user',
        icon: Send,
      },
      {
        subtype: 'webhook',
        label: 'Webhook Out',
        description: 'Send to webhook',
        icon: Webhook,
      },
      {
        subtype: 'store',
        label: 'Store',
        description: 'Save to storage',
        icon: Database,
      },
      // Visual divider for social outputs
      {
        subtype: 'divider_social',
        label: 'Social',
        description: '',
        icon: Minus,
        isDivider: true,
      },
      {
        subtype: 'twitter_post',
        label: 'Twitter Post',
        description: 'Post to Twitter/X',
        icon: Twitter,
      },
      {
        subtype: 'discord_message',
        label: 'Discord Message',
        description: 'Send to Discord channel',
        icon: MessageCircle,
      },
      {
        subtype: 'telegram_message',
        label: 'Telegram Message',
        description: 'Send to Telegram chat',
        icon: Send,
      },
    ],
  },
]

export function NodePalette() {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['input', 'process', 'claw'])
  )

  const toggleCategory = (categoryId: string) => {
    const next = new Set(expandedCategories)
    if (next.has(categoryId)) {
      next.delete(categoryId)
    } else {
      next.add(categoryId)
    }
    setExpandedCategories(next)
  }

  const onDragStart = (event: React.DragEvent, type: string, subtype: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', type)
    event.dataTransfer.setData('application/reactflow/subtype', subtype)
    event.dataTransfer.setData('application/reactflow/label', label)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="bg-background w-64 overflow-hidden rounded-lg border shadow-lg">
      <div className="border-b p-3">
        <h3 className="text-sm font-semibold">Node Palette</h3>
        <p className="text-muted-foreground mt-1 text-xs">Drag nodes to the canvas</p>
      </div>

      <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
        {nodeCategories.map((category) => (
          <div key={category.id} className="border-b last:border-b-0">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="hover:bg-muted/50 flex w-full items-center gap-2 p-3 text-left transition-colors"
            >
              <div
                className={cn('flex h-6 w-6 items-center justify-center rounded', category.color)}
              >
                <category.icon className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="flex-1 text-sm font-medium">{category.label}</span>
              {expandedCategories.has(category.id) ? (
                <ChevronDown className="text-muted-foreground h-4 w-4" />
              ) : (
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              )}
            </button>

            {/* Category nodes */}
            {expandedCategories.has(category.id) && (
              <div className="space-y-1 px-2 pb-2">
                {category.nodes.map((node) => {
                  // Render divider as non-draggable separator
                  if (node.isDivider) {
                    return (
                      <div key={node.subtype} className="flex items-center gap-2 px-1 py-2">
                        <div className="bg-border h-px flex-1" />
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">
                          {node.label}
                        </span>
                        <div className="bg-border h-px flex-1" />
                      </div>
                    )
                  }

                  // Render draggable node (or disabled if coming soon)
                  return (
                    <div
                      key={node.subtype}
                      draggable={!node.disabled}
                      onDragStart={(e) => {
                        if (node.disabled) {
                          e.preventDefault()
                          return
                        }
                        onDragStart(e, category.type, node.subtype, node.label)
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded p-2',
                        node.disabled
                          ? 'bg-muted/20 cursor-not-allowed opacity-50'
                          : 'bg-muted/30 hover:bg-muted cursor-grab active:cursor-grabbing',
                        'transition-colors'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-5 w-5 items-center justify-center rounded',
                          category.color,
                          'opacity-80'
                        )}
                      >
                        <node.icon className="h-3 w-3 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-medium">{node.label}</p>
                          {node.comingSoon && (
                            <span className="bg-muted-foreground/20 text-muted-foreground shrink-0 rounded px-1 py-0.5 text-[9px] font-medium leading-none">
                              Soon
                            </span>
                          )}
                        </div>
                        <p className="text-muted-foreground truncate text-xs">{node.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
