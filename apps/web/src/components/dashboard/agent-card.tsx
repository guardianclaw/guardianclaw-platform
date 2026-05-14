'use client'

import Link from 'next/link'
import { Bot, MoreVertical, Play, Settings, Trash2, ExternalLink, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn, formatDate } from '@/lib/utils'
import type { Agent } from '@/lib/api'

interface AgentCardProps {
  agent: Agent
  onDelete: (id: string) => void
}

const statusColors: Record<Agent['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  testing: 'bg-yellow-100 text-yellow-700',
  deployed: 'bg-claw-100 text-claw-700',
  archived: 'bg-red-100 text-red-700',
}

const frameworkLabels: Record<string, string> = {
  openai_agents: 'OpenAI Agents',
  anthropic_sdk: 'Anthropic',
  coinbase_agentkit: 'Coinbase',
  solana_agent_kit: 'Solana',
  google_adk: 'Google ADK',
  virtuals_protocol: 'Virtuals',
  elizaos: 'ElizaOS',
  voltagent: 'VoltAgent',
  openclaw: 'OpenClaw',
  custom: 'Custom',
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  const nodeCount = agent.flow?.nodes?.length || 0

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted rounded-lg p-2">
              <Bot className="text-muted-foreground h-5 w-5" />
            </div>
            <div>
              <Link href={`/app/builder/${agent.id}`} className="font-semibold hover:underline">
                {agent.name}
              </Link>
              <p className="text-muted-foreground text-sm">
                {frameworkLabels[agent.framework] || agent.framework}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="pointer-events-auto h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/app/builder/${agent.id}/flow`}>
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Flow
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/app/builder/${agent.id}/test`}>
                  <Play className="mr-2 h-4 w-4" />
                  Test Agent
                </Link>
              </DropdownMenuItem>
              {agent.status === 'deployed' && (
                <DropdownMenuItem asChild>
                  <Link href={`/app/builder/${agent.id}/deploy`}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    View API
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(agent.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent>
        {agent.description && (
          <p className="text-muted-foreground mb-4 line-clamp-2 text-sm">{agent.description}</p>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={cn('font-normal', statusColors[agent.status])}>
              {agent.status}
            </Badge>
            <div className="text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3" />
              <span>{agent.claw_config.protection_level}</span>
            </div>
          </div>

          <div className="text-muted-foreground flex items-center gap-4">
            <span>{nodeCount} nodes</span>
            <span>{formatDate(agent.updated_at)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
