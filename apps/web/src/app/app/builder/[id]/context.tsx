'use client'

import { createContext, useContext } from 'react'
import { Agent } from '@/lib/api'

// Context for agent data
export interface AgentContextValue {
  agent: Agent | null
  isDemo: boolean
  loading: boolean
  error: string | null
  refetch: () => void
}

export const AgentContext = createContext<AgentContextValue>({
  agent: null,
  isDemo: false,
  loading: true,
  error: null,
  refetch: () => {},
})

export const useAgent = () => useContext(AgentContext)
