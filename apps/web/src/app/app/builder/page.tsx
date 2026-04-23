'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Bot,
  Play,
  Settings,
  Trash2,
  MoreVertical,
  Clock,
  Shield,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/use-auth'
import { agentsApi, Agent } from '@/lib/api'

const statusColors = {
  draft: 'bg-gray-500',
  testing: 'bg-yellow-500',
  deployed: 'bg-green-500',
  archived: 'bg-red-500',
}

// Demo agent card for unauthenticated users
function DemoAgentCard() {
  return (
    <Card className="border-claw-500/50 bg-claw-500/5 hover:border-claw-500 border-2 border-dashed transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-claw-500 flex h-10 w-10 items-center justify-center rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Try Demo Mode</CardTitle>
              <CardDescription>Explore the builder without signing in</CardDescription>
            </div>
          </div>
          <Badge className="bg-claw-500">Demo</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4 text-sm">
          Drag nodes, connect them, and see how the visual builder works. Your changes won&apos;t be
          saved in demo mode.
        </p>
        <Link href="/app/builder/demo/flow">
          <Button className="bg-claw-600 hover:bg-claw-700 w-full">
            <Play className="mr-2 h-4 w-4" />
            Launch Demo Builder
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}

// Framework display names
const frameworkNames: Record<string, string> = {
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

// Agent card component
function AgentCard({ agent, onDelete }: { agent: Agent; onDelete: (id: string) => void }) {
  const router = useRouter()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  // Check if icon is an emoji or icon name
  const isEmoji = agent.icon && /\p{Emoji}/u.test(agent.icon)

  return (
    <Card className="hover:border-foreground/20 transition-colors">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-muted flex h-10 w-10 items-center justify-center rounded-lg">
              {isEmoji ? (
                <span className="text-xl">{agent.icon}</span>
              ) : (
                <Bot className="text-muted-foreground h-5 w-5" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{agent.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {agent.description || 'No description'}
              </CardDescription>
            </div>
          </div>
          <Badge className={statusColors[agent.status]}>{agent.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-muted-foreground mb-4 flex items-center gap-4 text-sm">
          <Badge variant="outline" className="text-xs">
            {frameworkNames[agent.framework] || agent.framework}
          </Badge>
          <div className="flex items-center gap-1">
            <Shield className="h-4 w-4" />
            <span>{agent.claw_config?.protection_level || 'standard'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{formatDate(agent.updated_at)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/app/builder/${agent.id}/flow`} className="flex-1">
            <Button variant="outline" className="w-full">
              Edit Flow
            </Button>
          </Link>
          <Link href={`/app/builder/${agent.id}/test`}>
            <Button variant="outline" size="icon">
              <Play className="h-4 w-4" />
            </Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/app/builder/${agent.id}/claw`)}>
                <Shield className="mr-2 h-4 w-4" />
                GuardianClaw Config
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push(`/app/builder/${agent.id}/deploy`)}>
                <Settings className="mr-2 h-4 w-4" />
                Deploy Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete agent?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete <strong>{agent.name}</strong> and all associated
                  data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => onDelete(agent.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BuilderListPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load agents when authenticated
  useEffect(() => {
    if (authLoading) return

    if (isAuthenticated) {
      setLoading(true)
      agentsApi
        .list()
        .then(setAgents)
        .catch((err) => {
          console.error('Failed to load agents:', err)
          setError('Failed to load agents')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, authLoading])

  const handleDelete = async (id: string) => {
    try {
      await agentsApi.delete(id)
      setAgents(agents.filter((a) => a.id !== id))
    } catch (err) {
      console.error('Failed to delete agent:', err)
    }
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Builder</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage your AI agents with visual flow builder
          </p>
        </div>
        {isAuthenticated && (
          <Link href="/app/builder/new">
            <Button className="bg-claw-600 hover:bg-claw-700">
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Button>
          </Link>
        )}
      </div>

      {/* Content */}
      {authLoading || loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-4">
            <div className="border-claw-500 h-10 w-10 animate-spin rounded-full border-4 border-t-transparent" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Demo card - always shown first for unauthenticated users */}
          {!isAuthenticated && <DemoAgentCard />}

          {/* User agents */}
          {isAuthenticated && agents.length === 0 ? (
            <Card className="col-span-full border-dashed">
              <CardContent className="py-12 text-center">
                <Bot className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h3 className="mb-2 text-lg font-semibold">No agents yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first AI agent with our visual builder
                </p>
                <Link href="/app/builder/new">
                  <Button className="bg-claw-600 hover:bg-claw-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Agent
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onDelete={handleDelete} />
            ))
          )}

          {/* Demo card for authenticated users too */}
          {isAuthenticated && <DemoAgentCard />}
        </div>
      )}
    </div>
  )
}
