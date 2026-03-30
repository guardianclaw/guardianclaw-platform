'use client'

import { useEffect, useState } from 'react'
import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Workflow,
  Play,
  Cloud,
  BarChart3,
  Loader2,
  Webhook,
  ScrollText,
  Plug,
  Bell,
  User,
  Brain,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { agentsApi, Agent } from '@/lib/api'
import { AgentContext } from './context'

// Demo agent for /builder/demo/*
const DEMO_AGENT: Agent = {
  id: 'demo',
  wallet_address: 'demo',
  name: 'Demo Agent',
  description: 'Interactive demo of the GuardianClaw Agent Builder',
  icon: 'bot',
  framework: 'openai_agents',
  flow: {
    nodes: [
      {
        id: 'input_1',
        type: 'input',
        position: { x: 100, y: 200 },
        data: { label: 'User Message', inputType: 'user_message', config: {} },
      },
      {
        id: 'claw_1',
        type: 'claw',
        position: { x: 350, y: 100 },
        data: { label: 'Input Validation', gateType: 'all', config: { enabled: true } },
      },
      {
        id: 'process_1',
        type: 'process',
        position: { x: 600, y: 200 },
        data: { label: 'AI Response', processType: 'llm_call', config: { model: 'gpt-4o-mini' } },
      },
      {
        id: 'claw_2',
        type: 'claw',
        position: { x: 850, y: 100 },
        data: { label: 'Output Validation', gateType: 'all', config: { enabled: true } },
      },
      {
        id: 'output_1',
        type: 'output',
        position: { x: 1100, y: 200 },
        data: { label: 'Response', outputType: 'response', config: { format: 'text' } },
      },
    ],
    edges: [
      { id: 'e1', source: 'input_1', target: 'claw_1', type: 'smoothstep', animated: true },
      { id: 'e2', source: 'claw_1', target: 'process_1', type: 'smoothstep', animated: true },
      { id: 'e3', source: 'process_1', target: 'claw_2', type: 'smoothstep', animated: true },
      { id: 'e4', source: 'claw_2', target: 'output_1', type: 'smoothstep', animated: true },
    ],
  },
  config: {},
  claw_config: {
    protection_level: 'standard',
    gates: { credibility: true, avoidance: true, limits: true, worth: true },
    sdk_version: 'auto',
  },
  status: 'draft',
  version: 1,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
}

const tabs = [
  { id: 'flow', label: 'Flow', icon: Workflow, path: 'flow' },
  { id: 'character', label: 'Character', icon: User, path: 'character' },
  { id: 'test', label: 'Test', icon: Play, path: 'test' },
  { id: 'connectors', label: 'Connectors', icon: Plug, path: 'connectors' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, path: 'webhooks' },
  { id: 'deploy', label: 'Deploy', icon: Cloud, path: 'deploy' },
  { id: 'logs', label: 'Logs', icon: ScrollText, path: 'logs' },
  { id: 'memory', label: 'Memory', icon: Brain, path: 'memory' },
  { id: 'alerts', label: 'Alerts', icon: Bell, path: 'alerts' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, path: 'analytics' },
]

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  testing: 'bg-yellow-500',
  deployed: 'bg-green-500',
  archived: 'bg-red-500',
}

export default function AgentEditorLayout({ children }: { children: React.ReactNode }) {
  const params = useParams()
  const pathname = usePathname()
  const router = useRouter()
  const agentId = params.id as string
  const isDemo = agentId === 'demo'

  const [agent, setAgent] = useState<Agent | null>(isDemo ? DEMO_AGENT : null)
  const [loading, setLoading] = useState(!isDemo)
  const [error, setError] = useState<string | null>(null)

  const fetchAgent = async () => {
    if (isDemo) return

    setLoading(true)
    setError(null)

    try {
      const data = await agentsApi.get(agentId)
      setAgent(data)
    } catch (err) {
      console.error('Failed to load agent:', err)
      setError('Failed to load agent')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isDemo) {
      fetchAgent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, isDemo])

  // Get current tab from pathname
  const currentTab = tabs.find((tab) => pathname?.includes(`/${tab.path}`))?.id || 'flow'

  if (loading) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="text-claw-500 h-10 w-10 animate-spin" />
          <p className="text-muted-foreground">Loading agent...</p>
        </div>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="bg-background flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-2 text-xl font-semibold">Error</h2>
          <p className="text-muted-foreground mb-4">{error || 'Agent not found'}</p>
          <Button onClick={() => router.push('/app/builder')}>Back to Agents</Button>
        </div>
      </div>
    )
  }

  return (
    <AgentContext.Provider value={{ agent, isDemo, loading, error, refetch: fetchAgent }}>
      <div className="flex h-screen flex-col overflow-hidden">
        {/* Demo banner */}
        {isDemo && (
          <div className="shrink-0 bg-gradient-to-r from-amber-500/90 to-orange-500/90 px-4 py-2 text-center text-sm font-medium text-white">
            <span className="mr-2">Demo Mode</span>
            <span className="opacity-90">Explore the builder. Changes won&apos;t be saved.</span>
            <Link href="/app/builder" className="ml-4 underline hover:no-underline">
              Sign in to create your own agents →
            </Link>
          </div>
        )}

        {/* Header */}
        <header className="bg-background flex h-14 shrink-0 items-center gap-4 border-b px-4">
          {/* Back button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/app/builder')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          {/* Agent info */}
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate font-semibold">{agent.name}</h1>
            <Badge className={cn('shrink-0 text-white', statusColors[agent.status])}>
              {agent.status}
            </Badge>
          </div>

          {/* Tabs */}
          <nav className="flex flex-1 items-center justify-center gap-1">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id
              const href = `/app/builder/${agentId}/${tab.path}`
              const Icon = tab.icon

              // Disable certain tabs for demo mode
              const isDisabled =
                isDemo &&
                (tab.id === 'character' ||
                  tab.id === 'connectors' ||
                  tab.id === 'webhooks' ||
                  tab.id === 'deploy' ||
                  tab.id === 'logs' ||
                  tab.id === 'memory' ||
                  tab.id === 'alerts' ||
                  tab.id === 'analytics')

              if (isDisabled) {
                return (
                  <div
                    key={tab.id}
                    className="text-muted-foreground/50 flex cursor-not-allowed items-center gap-2 px-3 py-1.5 text-sm"
                    title="Not available in demo mode"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </div>
                )
              }

              return (
                <Link
                  key={tab.id}
                  href={href}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Spacer */}
          <div className="w-10" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
    </AgentContext.Provider>
  )
}
