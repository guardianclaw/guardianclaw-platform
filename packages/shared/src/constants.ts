// API URLs
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.guardianclaw.org'
export const STAGING_API_URL = 'https://staging-api.guardianclaw.org'

// Solana
export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || 'https://api.mainnet-beta.solana.com'
export const GCLAW_TOKEN_MINT = process.env.NEXT_PUBLIC_GCLAW_MINT || ''

// Rate limits
export const RATE_LIMITS = {
  free: 100,
  starter: 1000,
  pro: 10000,
} as const

// GuardianClaw protection levels
export const PROTECTION_LEVELS = {
  minimal: {
    name: 'Minimal',
    description: 'Basic protection with essential safety checks',
    tokens: '~600',
  },
  standard: {
    name: 'Standard',
    description: 'Balanced protection for most use cases',
    tokens: '~1.1K',
  },
  full: {
    name: 'Full',
    description: 'Maximum protection with comprehensive validation',
    tokens: '~2K',
  },
} as const

// Node types for agent builder
export const NODE_TYPES = {
  triggers: ['trigger_webhook', 'trigger_chat', 'trigger_schedule'],
  ai: ['ai_llm', 'ai_agent', 'ai_embedder'],
  claw: ['claw_input', 'claw_output', 'claw_full'],
  tools: ['tool_http', 'tool_sql', 'tool_code', 'tool_search'],
  output: ['output_response', 'output_webhook', 'output_stream'],
} as const
