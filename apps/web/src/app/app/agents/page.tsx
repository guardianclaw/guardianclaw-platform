'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AgentList } from '@/components/dashboard/agent-list'
import { CreateAgentDialog } from '@/components/dashboard/create-agent-dialog'
import { useState } from 'react'

export default function DashboardPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Agents</h1>
          <p className="text-muted-foreground mt-1">
            Build and deploy AI agents with GuardianClaw protection
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Agent
        </Button>
      </div>

      {/* Agent List */}
      <AgentList />

      {/* Create Dialog */}
      <CreateAgentDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  )
}
