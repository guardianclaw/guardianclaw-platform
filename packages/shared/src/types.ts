// Database types

export interface Profile {
  wallet_address: string
  display_name: string | null
  avatar_url: string | null
  plan: 'free' | 'starter' | 'pro'
  plan_expires_at: string | null
  created_at: string
  updated_at: string
}

export interface Agent {
  id: string
  wallet_address: string
  name: string
  description: string | null
  icon: string
  framework: string
  flow: AgentFlow
  config: Record<string, unknown>
  claw_config: ClawConfig
  status: 'draft' | 'testing' | 'deployed' | 'archived'
  version: number
  created_at: string
  updated_at: string
}

export interface AgentFlow {
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

export interface ClawConfig {
  protection_level: 'minimal' | 'standard' | 'full'
  gates: {
    credibility: boolean
    avoidance: boolean
    limits: boolean
    worth: boolean
  }
  sdk_version: 'v2' | 'v3' | 'auto'
}

export interface Deployment {
  id: string
  agent_id: string
  version: number
  status: 'running' | 'stopped' | 'failed'
  config_snapshot: Record<string, unknown>
  endpoint_url: string | null
  created_at: string
  stopped_at: string | null
}

export interface ApiKey {
  id: string
  agent_id: string
  name: string
  key_prefix: string
  rate_limit: number
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

// API types

export interface AuthNonceResponse {
  nonce: string
  message: string
  expires_at: string
}

export interface AuthVerifyRequest {
  wallet: string
  signature: string
  nonce: string
}

export interface AuthVerifyResponse {
  token: string
  expires_at: string
  wallet: string
}

export interface ValidationResult {
  is_safe: boolean
  blocked: boolean
  confidence: number
  reason: string | null
  violations: string[]
  gate: string | null
  metadata: Record<string, unknown>
}
