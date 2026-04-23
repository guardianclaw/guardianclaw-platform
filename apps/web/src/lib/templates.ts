/**
 * Agent Templates - Pre-configured agent templates based on guardianclaw SDK integrations.
 *
 * Each template defines:
 * - Integration type (OpenAI Agents, ElizaOS, Coinbase, etc.)
 * - Required configuration fields
 * - Default security modules
 * - Pre-built flow visualization
 */

export type TemplateCategory = 'frameworks' | 'defi' | 'specialized'

export interface ConfigField {
  type: 'text' | 'textarea' | 'select' | 'slider' | 'toggle' | 'number'
  label: string
  description?: string
  required?: boolean
  default?: string | number | boolean
  options?: { value: string; label: string }[]
  min?: number
  max?: number
  step?: number
}

export interface SecurityModule {
  id: string
  name: string
  description: string
  sdkClass: string
  enabled: boolean
  configurable: boolean
  config?: Record<string, ConfigField>
}

export interface FlowNode {
  id: string
  type: 'input' | 'claw' | 'llm' | 'module' | 'output' | 'memory'
  label: string
  data?: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  target: string
}

export type ExecutionMode = 'export' | 'platform'
export type RuntimeType = 'python' | 'nodejs'

export interface Template {
  id: string
  name: string
  description: string
  longDescription?: string
  icon: string
  logoUrl?: string
  category: TemplateCategory
  sdkIntegration: string
  requiredConfig: Record<string, ConfigField>
  securityModules: SecurityModule[]
  defaultFlow: {
    nodes: FlowNode[]
    edges: FlowEdge[]
  }
  documentation?: string
  tags: string[]
  // Integration-specific configuration (stored in agent.integration_config)
  integrationConfig?: Record<string, unknown>
  // Execution configuration
  executionMode?: ExecutionMode // 'export' = code export only, 'platform' = runs natively
  runtime?: RuntimeType // 'python' | 'nodejs'
}

// Security modules available for all templates
export const SECURITY_MODULES: SecurityModule[] = [
  {
    id: 'input_validator',
    name: 'Input Validator',
    description:
      'Validates user input before sending to AI. Blocks prompt injection, jailbreak attempts, and malicious content.',
    sdkClass: 'SemanticValidator',
    enabled: true,
    configurable: true,
    config: {
      strictMode: {
        type: 'toggle',
        label: 'Strict Mode',
        description: 'Block any suspicious content, even with low confidence',
        default: false,
      },
    },
  },
  {
    id: 'output_validator',
    name: 'Output Validator',
    description:
      'Validates AI responses before returning to user. Filters inappropriate, harmful, or off-topic content.',
    sdkClass: 'SemanticValidator',
    enabled: true,
    configurable: true,
    config: {
      strictMode: {
        type: 'toggle',
        label: 'Strict Mode',
        description: 'Apply stricter filtering to responses',
        default: false,
      },
    },
  },
  {
    id: 'llm_claw',
    name: 'LLM GuardianClaw',
    description:
      'Dedicated LLM that monitors the main AI for compliance with CLAW gates. Most thorough but adds latency.',
    sdkClass: 'SemanticValidator',
    enabled: false,
    configurable: true,
    config: {
      model: {
        type: 'select',
        label: 'GuardianClaw Model',
        description: 'LLM to use for semantic validation',
        default: 'gpt-4o-mini',
        options: [
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast)' },
          { value: 'gpt-4o', label: 'GPT-4o (Accurate)' },
          { value: 'claude-3-haiku', label: 'Claude 3 Haiku (Fast)' },
        ],
      },
    },
  },
  {
    id: 'memory_shield',
    name: 'Memory Shield',
    description:
      'Cryptographic protection for agent memory. Prevents memory injection attacks with HMAC verification.',
    sdkClass: 'MemoryIntegrityChecker',
    enabled: false,
    configurable: false,
  },
  {
    id: 'fiduciary',
    name: 'Fiduciary Guard',
    description:
      "Ensures AI acts in user's best interest. Detects conflicts of interest and validates duty of care.",
    sdkClass: 'FiduciaryValidator',
    enabled: false,
    configurable: true,
    config: {
      strictMode: {
        type: 'toggle',
        label: 'Strict Mode',
        description: 'Block any action that might not serve user interest',
        default: false,
      },
    },
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description:
      'Regulatory compliance checks. EU AI Act, OWASP LLM Top 10, and industry standards.',
    sdkClass: 'ComplianceChecker',
    enabled: false,
    configurable: true,
    config: {
      frameworks: {
        type: 'select',
        label: 'Compliance Framework',
        description: 'Which compliance standard to enforce',
        default: 'owasp_llm',
        options: [
          { value: 'owasp_llm', label: 'OWASP LLM Top 10' },
          { value: 'eu_ai_act', label: 'EU AI Act' },
          { value: 'owasp_agentic', label: 'OWASP Agentic Top 10' },
        ],
      },
    },
  },
]

// Template definitions
export const TEMPLATES: Template[] = [
  // OpenAI Agents Template
  {
    id: 'openai_agents',
    name: 'OpenAI Agents',
    description: "Use OpenAI's Agents SDK with CLAW guardrails",
    longDescription:
      'OpenAI Agents SDK provides a framework for building AI agents with tool use and multi-turn conversations. GuardianClaw adds semantic guardrails for safety.',
    icon: '🤖',
    logoUrl: '/images/ecosystem/openai-agents.svg',
    category: 'frameworks',
    sdkIntegration: 'guardianclaw.integrations.openai_agents',
    tags: ['popular', 'tool-use', 'multi-turn'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        required: true,
      },
      model: {
        type: 'select',
        label: 'Model',
        required: true,
        default: 'gpt-4o',
        options: [
          { value: 'gpt-4o', label: 'GPT-4o' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        ],
      },
      instructions: {
        type: 'textarea',
        label: 'Instructions',
        description: 'Agent instructions and behavior guidelines',
        required: true,
        default: 'You are a helpful assistant that can use tools to accomplish tasks.',
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator', 'llm_claw'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'User Input' },
        { id: 'claw-in', type: 'claw', label: 'Input Guardrail' },
        { id: 'llm-1', type: 'llm', label: 'OpenAI Agent' },
        { id: 'claw-out', type: 'claw', label: 'Output Guardrail' },
        { id: 'output-1', type: 'output', label: 'Response' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'llm-1' },
        { id: 'e3', source: 'llm-1', target: 'claw-out' },
        { id: 'e4', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/openai-agents',
    // Default integration configuration for OpenAI Agents SDK
    integrationConfig: {
      guardrail_model: 'gpt-4o-mini',
      require_all_gates: true,
      skip_semantic_if_heuristic: true,
      validation_timeout_ms: 30000,
      block_on_violation: true,
      use_heuristic: true,
      fail_open: false,
      log_validations: true,
    },
  },

  // Coinbase AgentKit Template
  {
    id: 'coinbase_agentkit',
    name: 'Coinbase AgentKit',
    description: 'DeFi agents with transaction validation and spending limits',
    longDescription:
      'Build AI agents that can interact with the Coinbase ecosystem safely. Includes transaction validation, spending limits, and DeFi risk assessment.',
    icon: '💰',
    logoUrl: '/images/ecosystem/coinbase.svg',
    category: 'defi',
    sdkIntegration: 'guardianclaw.integrations.coinbase',
    tags: ['defi', 'crypto', 'financial'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        required: true,
      },
      securityProfile: {
        type: 'select',
        label: 'Security Profile',
        description: 'Pre-configured security level',
        default: 'strict',
        options: [
          { value: 'permissive', label: 'Permissive (Low restrictions)' },
          { value: 'standard', label: 'Standard (Balanced)' },
          { value: 'strict', label: 'Strict (Maximum protection)' },
        ],
      },
      spendingLimit: {
        type: 'number',
        label: 'Daily Spending Limit (USD)',
        description: 'Maximum USD value agent can transact per day',
        default: 100,
        min: 1,
        max: 100000,
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      // Enable fiduciary for financial agents
      enabled: ['input_validator', 'output_validator', 'fiduciary'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'Transaction Request' },
        { id: 'claw-in', type: 'claw', label: 'Input Validator' },
        { id: 'fiduciary', type: 'module', label: 'Fiduciary Check' },
        { id: 'llm-1', type: 'llm', label: 'AgentKit Executor' },
        { id: 'claw-out', type: 'claw', label: 'Output Validator' },
        { id: 'output-1', type: 'output', label: 'Transaction Result' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'fiduciary' },
        { id: 'e3', source: 'fiduciary', target: 'llm-1' },
        { id: 'e4', source: 'llm-1', target: 'claw-out' },
        { id: 'e5', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/coinbase',
    // Phase 2: Integration-specific defaults
    integrationConfig: {
      security_profile: 'standard',
      spending_limits: {
        max_single_transaction: 100,
        max_daily_total: 500,
        confirmation_threshold: 50,
      },
      blocked_addresses: [],
      fiduciary_enabled: true,
      block_unlimited_approvals: true,
      validate_before_sign: true,
      log_validations: true,
    },
  },

  // Solana Agent Kit Template
  {
    id: 'solana_agent_kit',
    name: 'Solana Agent Kit',
    description: 'Solana blockchain agents with transaction validation',
    longDescription:
      'Build AI agents for Solana DeFi operations. Includes transaction validation, swap protection, and spending limits.',
    icon: '🌀',
    logoUrl: '/images/ecosystem/solana.svg',
    category: 'defi',
    sdkIntegration: 'guardianclaw.integrations.solana',
    tags: ['defi', 'crypto', 'solana'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        required: true,
      },
      spendingLimit: {
        type: 'number',
        label: 'Daily Spending Limit (USD)',
        description: 'Maximum USD value agent can transact per day',
        default: 500,
        min: 1,
        max: 100000,
      },
      slippageTolerance: {
        type: 'slider',
        label: 'Slippage Tolerance',
        description: 'Maximum acceptable slippage for swaps',
        default: 1.0,
        min: 0.1,
        max: 5,
        step: 0.1,
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator', 'fiduciary'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'Transaction Request' },
        { id: 'claw-in', type: 'claw', label: 'Input Validator' },
        { id: 'fiduciary', type: 'module', label: 'Fiduciary Check' },
        { id: 'llm-1', type: 'llm', label: 'Solana Agent' },
        { id: 'claw-out', type: 'claw', label: 'Output Validator' },
        { id: 'output-1', type: 'output', label: 'Transaction Result' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'fiduciary' },
        { id: 'e3', source: 'fiduciary', target: 'llm-1' },
        { id: 'e4', source: 'llm-1', target: 'claw-out' },
        { id: 'e5', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/solana',
    integrationConfig: {
      spending_limits: {
        max_single_transaction: 100,
        max_daily_total: 500,
        confirmation_threshold: 50,
      },
      blocked_addresses: [],
      fiduciary_enabled: true,
      slippage_tolerance: 1.0,
      priority_fee_cap: 10000,
      memory_integrity_check: false,
      log_validations: true,
    },
  },

  // Google ADK Template
  {
    id: 'google_adk',
    name: 'Google ADK',
    description: 'Google Agent Development Kit with multi-point validation',
    longDescription:
      "Build AI agents using Google's Agent Development Kit with GuardianClaw safety validation at all execution points. Supports input, output, and tool validation.",
    icon: '🌐',
    logoUrl: '/images/ecosystem/google-adk.svg',
    category: 'frameworks',
    sdkIntegration: 'guardianclaw.integrations.google_adk',
    tags: ['google', 'gemini', 'multi-agent'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        required: true,
      },
      model: {
        type: 'select',
        label: 'Model',
        default: 'gemini-2.0-flash',
        options: [
          { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
          { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
          { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
        ],
      },
      seedLevel: {
        type: 'select',
        label: 'Seed Level',
        description: 'Safety instruction limits',
        default: 'standard',
        options: [
          { value: 'minimal', label: 'Minimal (~2K tokens)' },
          { value: 'standard', label: 'Standard (Recommended)' },
          { value: 'full', label: 'Full (~8K tokens)' },
        ],
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'User Input' },
        { id: 'claw-in', type: 'claw', label: 'Input Validator' },
        { id: 'llm-1', type: 'llm', label: 'Google ADK Agent' },
        { id: 'claw-out', type: 'claw', label: 'Output Validator' },
        { id: 'output-1', type: 'output', label: 'Response' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'llm-1' },
        { id: 'e3', source: 'llm-1', target: 'claw-out' },
        { id: 'e4', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/google-adk',
    integrationConfig: {
      seed_level: 'standard',
      block_on_failure: true,
      fail_closed: false,
      validate_inputs: true,
      validate_outputs: true,
      validate_tools: true,
      max_text_size: 100000,
      validation_timeout: 5.0,
      log_validations: true,
    },
  },

  // Virtuals Protocol Template
  {
    id: 'virtuals_protocol',
    name: 'Virtuals Protocol',
    description: 'GAME SDK agents with CLAW validation and memory protection',
    longDescription:
      'Build AI agents using Virtuals Protocol GAME SDK with GuardianClaw safety validation. Includes CLAW gates, transaction limits, and memory integrity protection.',
    icon: '🎮',
    logoUrl: '/images/ecosystem/virtuals.svg',
    category: 'defi',
    sdkIntegration: 'guardianclaw.integrations.virtuals',
    tags: ['defi', 'crypto', 'gaming', 'virtuals'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        required: true,
      },
      maxTransactionAmount: {
        type: 'number',
        label: 'Max Transaction Amount (USD)',
        description: 'Maximum amount per transaction',
        default: 1000,
        min: 1,
        max: 100000,
      },
      confirmationThreshold: {
        type: 'number',
        label: 'Confirmation Threshold (USD)',
        description: 'Require confirmation above this amount',
        default: 100,
        min: 1,
        max: 10000,
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator', 'fiduciary', 'memory_shield'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'Action Request' },
        { id: 'claw-in', type: 'claw', label: 'CLAW Validator' },
        { id: 'fiduciary', type: 'module', label: 'Fiduciary Check' },
        { id: 'llm-1', type: 'llm', label: 'GAME Agent' },
        { id: 'claw-out', type: 'claw', label: 'Output Validator' },
        { id: 'output-1', type: 'output', label: 'Action Result' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'fiduciary' },
        { id: 'e3', source: 'fiduciary', target: 'llm-1' },
        { id: 'e4', source: 'llm-1', target: 'claw-out' },
        { id: 'e5', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/virtuals',
    integrationConfig: {
      block_unsafe: true,
      log_validations: true,
      max_transaction_amount: 1000,
      require_confirmation_above: 100,
      require_purpose_for: ['transfer', 'send', 'approve', 'swap', 'bridge', 'withdraw'],
      memory_integrity_check: false,
      blocked_functions: [
        'drain_wallet',
        'send_all_tokens',
        'approve_unlimited',
        'export_private_key',
        'reveal_seed_phrase',
      ],
      fiduciary_enabled: true,
      strict_fiduciary: false,
    },
  },

  // ElizaOS Template
  {
    id: 'elizaos',
    name: 'ElizaOS',
    description: 'Build personality-driven social agents with GuardianClaw safety',
    longDescription:
      'ElizaOS is the leading framework for autonomous AI agents on Twitter, Discord, and Telegram. ' +
      'This template integrates GuardianClaw CLAW validation and memory integrity protection for secure social interactions.',
    icon: '🤖',
    logoUrl: '/images/ecosystem/elizaos.svg',
    category: 'frameworks',
    sdkIntegration: '@guardianclaw/elizaos-plugin',
    tags: ['popular', 'social', 'twitter', 'discord', 'telegram'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        description: 'A unique name for your social agent',
        required: true,
      },
      personality: {
        type: 'textarea',
        label: 'Personality',
        description: "Define your agent's personality, tone, and behavior guidelines",
        required: true,
        default:
          'You are a helpful and friendly AI assistant. Be concise, engaging, and maintain a consistent personality.',
      },
      model: {
        type: 'select',
        label: 'LLM Model',
        description: 'The AI model to power your agent',
        required: true,
        default: 'gpt-4o-mini',
        options: [
          { value: 'gpt-4o', label: 'GPT-4o (Most capable)' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & affordable)' },
          { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
          { value: 'llama-3.1-70b', label: 'Llama 3.1 70B' },
        ],
      },
      seedLevel: {
        type: 'select',
        label: 'Seed Level',
        description: 'Safety instruction limits injected into the agent',
        default: 'standard',
        options: [
          { value: 'minimal', label: 'Minimal (~2K tokens)' },
          { value: 'standard', label: 'Standard (Recommended)' },
          { value: 'full', label: 'Full (~8K tokens)' },
        ],
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator', 'memory_shield'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'Social Input' },
        { id: 'claw-in', type: 'claw', label: 'Input Validator' },
        { id: 'llm-1', type: 'llm', label: 'ElizaOS Agent' },
        { id: 'claw-out', type: 'claw', label: 'Output Validator' },
        { id: 'output-1', type: 'output', label: 'Social Response' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'llm-1' },
        { id: 'e3', source: 'llm-1', target: 'claw-out' },
        { id: 'e4', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/elizaos',
    integrationConfig: {
      seedVersion: 'v2',
      seedVariant: 'standard',
      blockUnsafe: true,
      logChecks: true,
      memoryIntegrity: {
        enabled: true,
        verifyOnRead: true,
        signOnWrite: true,
        minTrustScore: 0.5,
      },
    },
    // ElizaOS runs natively on the GuardianClaw platform via Node.js runtime
    executionMode: 'platform',
    runtime: 'nodejs',
  },

  // Anthropic SDK Template
  {
    id: 'anthropic_sdk',
    name: 'Anthropic Claude',
    description: 'Direct Claude API integration with constitutional AI validation',
    longDescription:
      "Use Anthropic's Claude models directly with GuardianClaw validation. " +
      'Supports both sync and async clients with dual-layer validation (heuristic + semantic).',
    icon: '🟠',
    logoUrl: '/images/ecosystem/anthropic.svg',
    category: 'frameworks',
    sdkIntegration: 'guardianclaw.integrations.anthropic_sdk',
    tags: ['popular', 'claude', 'anthropic', 'conversational'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        description: 'A descriptive name for your Claude agent',
        required: true,
      },
      model: {
        type: 'select',
        label: 'Claude Model',
        description: 'The Claude model to power your agent',
        required: true,
        default: 'claude-3-5-sonnet-20241022',
        options: [
          { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (Latest)' },
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
          { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
        ],
      },
      systemPrompt: {
        type: 'textarea',
        label: 'System Prompt',
        description: "Instructions for Claude's behavior",
        required: true,
        default: 'You are a helpful AI assistant. Be concise, accurate, and helpful.',
      },
      validationModel: {
        type: 'select',
        label: 'Validation Model',
        description: 'Model used for semantic validation (L4 Observer)',
        default: 'claude-3-5-haiku-20241022',
        options: [
          { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku (Fast)' },
          { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Accurate)' },
        ],
      },
      maxTokens: {
        type: 'number',
        label: 'Max Tokens',
        description: 'Maximum tokens in response',
        default: 4096,
        min: 100,
        max: 8192,
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator', 'llm_claw'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'User Message' },
        { id: 'claw-in', type: 'claw', label: 'Input Validator' },
        { id: 'llm-1', type: 'llm', label: 'Claude' },
        { id: 'claw-out', type: 'claw', label: 'Output Validator' },
        { id: 'output-1', type: 'output', label: 'Response' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'llm-1' },
        { id: 'e3', source: 'llm-1', target: 'claw-out' },
        { id: 'e4', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/anthropic',
    integrationConfig: {
      validation_model: 'claude-3-5-haiku-20241022',
      use_heuristic_fallback: true,
      block_unsafe_output: true,
      fail_closed: false,
      validation_timeout: 30,
      max_text_size: 50000,
      enable_seed_injection: true,
    },
  },

  // VoltAgent Template
  {
    id: 'voltagent',
    name: 'VoltAgent',
    description: 'TypeScript AI agents with CLAW, OWASP, and PII protection',
    longDescription:
      'VoltAgent is a TypeScript framework for building AI agents. ' +
      'This template integrates @guardianclaw/voltagent for comprehensive safety validation ' +
      'including CLAW protocol, OWASP security patterns, and PII detection/redaction.',
    icon: '⚡',
    logoUrl: '/images/ecosystem/voltagent.svg',
    category: 'frameworks',
    sdkIntegration: '@guardianclaw/voltagent',
    tags: ['typescript', 'nodejs', 'streaming', 'pii'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        description: 'A descriptive name for your VoltAgent agent',
        required: true,
      },
      model: {
        type: 'select',
        label: 'LLM Model',
        description: 'The AI model to power your agent',
        required: true,
        default: 'gpt-4o-mini',
        options: [
          { value: 'gpt-4o', label: 'GPT-4o (Most capable)' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & affordable)' },
          { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
        ],
      },
      level: {
        type: 'select',
        label: 'Security Level',
        description: 'Preset security configuration',
        default: 'standard',
        options: [
          { value: 'permissive', label: 'Permissive (Log only)' },
          { value: 'standard', label: 'Standard (Recommended)' },
          { value: 'strict', label: 'Strict (Block all issues)' },
        ],
      },
      enablePII: {
        type: 'toggle',
        label: 'Enable PII Protection',
        description: 'Detect and redact personally identifiable information',
        default: false,
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'User Input' },
        { id: 'claw-in', type: 'claw', label: 'Input Guardrail' },
        { id: 'llm-1', type: 'llm', label: 'VoltAgent' },
        { id: 'claw-out', type: 'claw', label: 'Output Guardrail' },
        { id: 'output-1', type: 'output', label: 'Response' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-in' },
        { id: 'e2', source: 'claw-in', target: 'llm-1' },
        { id: 'e3', source: 'llm-1', target: 'claw-out' },
        { id: 'e4', source: 'claw-out', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/voltagent',
    integrationConfig: {
      // GuardianClawBundleConfig fields from SDK
      level: 'standard',
      enablePII: false,
      streamingPII: false,
      // GuardianClawGuardrailConfig fields
      blockUnsafe: true,
      logChecks: false,
      enableCLAW: true,
      enableOWASP: true,
      maxContentLength: 100000,
      timeout: 5000,
    },
    executionMode: 'platform',
    runtime: 'nodejs',
  },

  // OpenClaw Template
  {
    id: 'openclaw',
    name: 'OpenClaw',
    description: 'Personal AI agent with 5-layer safety guardrails and configurable protection',
    longDescription:
      'OpenClaw is a personal AI agent framework with defense-in-depth safety. ' +
      "This template integrates GuardianClaw's full 5-layer validation pipeline: input analysis, " +
      'seed injection, output validation, tool-call guarding, and session monitoring. ' +
      'Four configurable protection levels (off, watch, guard, shield) with escape hatches for user control.',
    icon: '\uD83E\uDD8E',
    logoUrl: '/images/ecosystem/openclaw.svg',
    category: 'frameworks',
    sdkIntegration: '@guardianclaw/openclaw',
    tags: ['personal-agent', 'safety', 'real-time', 'tool-validation'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        description: 'A name for your OpenClaw agent',
        required: true,
      },
      protectionLevel: {
        type: 'select',
        label: 'Protection Level',
        description: 'How aggressively to enforce safety. Watch monitors without blocking.',
        required: true,
        default: 'watch',
        options: [
          { value: 'off', label: 'Off (Debug only)' },
          { value: 'watch', label: 'Watch (Monitor, never blocks)' },
          { value: 'guard', label: 'Guard (Blocks critical threats)' },
          { value: 'shield', label: 'Shield (Maximum protection)' },
        ],
      },
      model: {
        type: 'select',
        label: 'LLM Model',
        description: 'The AI model to power your personal agent',
        required: true,
        default: 'gpt-4o-mini',
        options: [
          { value: 'gpt-4o', label: 'GPT-4o (Most capable)' },
          { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast & affordable)' },
          { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
          { value: 'claude-3-haiku', label: 'Claude 3 Haiku (Fast)' },
        ],
      },
      systemPrompt: {
        type: 'textarea',
        label: 'System Prompt',
        description: "Instructions that define your agent's behavior and personality",
        required: true,
        default:
          "You are a helpful personal AI assistant. Be concise, accurate, and always act in the user's best interest.",
      },
      alertsWebhook: {
        type: 'text',
        label: 'Alerts Webhook',
        description: 'Optional URL to receive security alert notifications',
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: ['input_validator', 'output_validator', 'memory_shield'].includes(m.id),
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'User Input' },
        { id: 'claw-l1', type: 'claw', label: 'L1 Input Analyzer' },
        { id: 'claw-l2', type: 'claw', label: 'L2 Seed Injector' },
        { id: 'llm-1', type: 'llm', label: 'OpenClaw Agent' },
        { id: 'claw-l3', type: 'claw', label: 'L3 Output Validator' },
        { id: 'tool-guard', type: 'module', label: 'Tool Guard' },
        { id: 'output-1', type: 'output', label: 'Response' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'claw-l1' },
        { id: 'e2', source: 'claw-l1', target: 'claw-l2' },
        { id: 'e3', source: 'claw-l2', target: 'llm-1' },
        { id: 'e4', source: 'llm-1', target: 'claw-l3' },
        { id: 'e5', source: 'claw-l3', target: 'tool-guard' },
        { id: 'e6', source: 'tool-guard', target: 'output-1' },
      ],
    },
    documentation: 'https://guardianclaw.org/docs/integrations/openclaw',
    integrationConfig: {
      level: 'watch',
      alerts: {
        enabled: false,
        webhook: '',
        minSeverity: 'high',
      },
      escapeHatches: {
        allowOnce: true,
        pause: true,
        trustTools: true,
      },
      trustedTools: [],
      ignorePatterns: [],
      validateInput: true,
      validateOutput: true,
      validateToolCalls: true,
      sessionMonitoring: true,
    },
    executionMode: 'platform',
    runtime: 'nodejs',
  },

  // Custom/Generic Template
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Start from scratch with full control over configuration',
    longDescription:
      'Build your own agent configuration with complete control over all settings. Ideal for advanced users who need specific customizations.',
    icon: '⚙️',
    category: 'frameworks',
    sdkIntegration: 'custom',
    tags: ['advanced', 'custom', 'flexible'],
    requiredConfig: {
      name: {
        type: 'text',
        label: 'Agent Name',
        required: true,
      },
      provider: {
        type: 'select',
        label: 'LLM Provider',
        default: 'openai',
        options: [
          { value: 'openai', label: 'OpenAI' },
          { value: 'anthropic', label: 'Anthropic' },
          { value: 'openrouter', label: 'OpenRouter' },
        ],
      },
      model: {
        type: 'text',
        label: 'Model Name',
        description: 'Model identifier (e.g., gpt-4o-mini)',
        default: 'gpt-4o-mini',
      },
      systemPrompt: {
        type: 'textarea',
        label: 'System Prompt',
        required: true,
      },
      temperature: {
        type: 'slider',
        label: 'Temperature',
        default: 0.7,
        min: 0,
        max: 2,
        step: 0.1,
      },
    },
    securityModules: SECURITY_MODULES.map((m) => ({
      ...m,
      enabled: false, // All disabled by default for custom
    })),
    defaultFlow: {
      nodes: [
        { id: 'input-1', type: 'input', label: 'Input' },
        { id: 'llm-1', type: 'llm', label: 'LLM' },
        { id: 'output-1', type: 'output', label: 'Output' },
      ],
      edges: [
        { id: 'e1', source: 'input-1', target: 'llm-1' },
        { id: 'e2', source: 'llm-1', target: 'output-1' },
      ],
    },
  },
]

// Helper functions
export function getTemplateById(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}

export function getTemplatesByCategory(category: TemplateCategory): Template[] {
  return TEMPLATES.filter((t) => t.category === category)
}

export function getPopularTemplates(): Template[] {
  return TEMPLATES.filter((t) => t.tags.includes('popular'))
}

export function getDefaultSecurityModules(): SecurityModule[] {
  return SECURITY_MODULES.map((m) => ({
    ...m,
    enabled: ['input_validator', 'output_validator'].includes(m.id),
  }))
}
