/**
 * Integration Configuration Types
 *
 * Type definitions for framework-specific integration configurations.
 * These types match the structure stored in agent.integration_config in Supabase.
 */

// Common types used across integrations

export type SeedLevel = 'minimal' | 'standard' | 'full'
export type OnViolation = 'block' | 'log' | 'warn' | 'ignore'
export type RiskTolerance = 'low' | 'moderate' | 'high'

export interface CLAWGates {
  credibility: boolean
  avoidance: boolean
  limits: boolean
  worth: boolean
}

// Base configuration that all integrations share
export interface BaseIntegrationConfig {
  seed_level?: SeedLevel
  on_violation?: OnViolation
  inject_seed?: boolean
  log_validations?: boolean
  fail_closed?: boolean
  gates?: CLAWGates
}

// Spending limits (used by crypto integrations)
export interface SpendingLimits {
  max_single_transaction: number
  max_daily_total: number
  confirmation_threshold: number
}

// User context for fiduciary validation
export interface UserContext {
  goals: string[]
  risk_tolerance: RiskTolerance
  investment_horizon?: string
}

// Security profile for crypto integrations
export type SecurityProfile = 'permissive' | 'standard' | 'strict' | 'paranoid'

// Coinbase AgentKit configuration
export interface CoinbaseConfig extends BaseIntegrationConfig {
  security_profile?: SecurityProfile
  spending_limits?: SpendingLimits
  blocked_addresses?: string[]
  blocked_tokens?: string[]
  fiduciary_enabled?: boolean
  user_context?: UserContext
  validate_before_sign?: boolean
  block_unlimited_approvals?: boolean
}

// Solana Agent Kit configuration
export interface SolanaConfig extends BaseIntegrationConfig {
  spending_limits?: SpendingLimits
  blocked_addresses?: string[]
  fiduciary_enabled?: boolean
  user_context?: UserContext
  memory_integrity_check?: boolean
  memory_secret_key?: string
  slippage_tolerance?: number // percentage
  priority_fee_cap?: number // lamports
}

// OpenAI Agents SDK configuration
export interface OpenAIAgentsConfig extends BaseIntegrationConfig {
  guardrail_model?: string
  require_all_gates?: boolean
  skip_semantic_if_heuristic?: boolean
  validation_timeout_ms?: number
  max_output_tokens?: number
  block_on_violation?: boolean
  use_heuristic?: boolean
  fail_open?: boolean
}

// Google ADK configuration
export interface GoogleADKConfig extends BaseIntegrationConfig {
  block_on_failure?: boolean
  validate_inputs?: boolean
  validate_outputs?: boolean
  validate_tools?: boolean
  validate_tool_outputs?: boolean
  max_text_size?: number
  validation_timeout?: number
  blocked_message?: string
  tool_timeout_ms?: number
  log_violations?: boolean
}

// Virtuals Protocol configuration
export interface VirtualsConfig extends BaseIntegrationConfig {
  block_unsafe?: boolean
  max_transaction_amount?: number
  require_confirmation_above?: number
  require_purpose_for?: string[]
  memory_integrity_check?: boolean
  memory_secret_key?: string
  suspicious_patterns?: string[]
  allowed_functions?: string[]
  blocked_functions?: string[]
  fiduciary_enabled?: boolean
  strict_fiduciary?: boolean
  user_context?: UserContext
}

// Full integration config structure (stored in agent.integration_config)
export interface IntegrationConfig {
  coinbase?: CoinbaseConfig
  solana_agent_kit?: SolanaConfig
  openai_agents?: OpenAIAgentsConfig
  google_adk?: GoogleADKConfig
  virtuals?: VirtualsConfig
}

// Framework identifiers
export type Framework =
  | 'coinbase'
  | 'solana_agent_kit'
  | 'openai_agents'
  | 'google_adk'
  | 'virtuals'
  | 'custom'

// Props for integration property components
export interface IntegrationPropertiesProps<T = Record<string, unknown>> {
  config: T
  onChange: (config: T) => void
}

// Default configurations
export const DEFAULT_SPENDING_LIMITS: SpendingLimits = {
  max_single_transaction: 100,
  max_daily_total: 500,
  confirmation_threshold: 50,
}

export const DEFAULT_CLAW_GATES: CLAWGates = {
  credibility: true,
  avoidance: true,
  limits: true,
  worth: true,
}

export const DEFAULT_USER_CONTEXT: UserContext = {
  goals: ['Protect principal', 'Minimize fees'],
  risk_tolerance: 'moderate',
}

// Helper to get empty config for a framework
export function getDefaultConfig(framework: Framework): Record<string, unknown> {
  switch (framework) {
    case 'coinbase':
      return {
        spending_limits: DEFAULT_SPENDING_LIMITS,
        blocked_addresses: [],
        fiduciary_enabled: true,
        block_unlimited_approvals: true,
      }
    case 'solana_agent_kit':
      return {
        spending_limits: DEFAULT_SPENDING_LIMITS,
        blocked_addresses: [],
        fiduciary_enabled: true,
        memory_integrity_check: false,
        slippage_tolerance: 1.0,
      }
    case 'openai_agents':
      return {
        guardrail_model: 'gpt-4o-mini',
        require_all_gates: true,
        skip_semantic_if_heuristic: true,
        validation_timeout_ms: 30000,
      }
    case 'google_adk':
      return {
        seed_level: 'standard',
        block_on_failure: true,
        fail_closed: false,
        validate_inputs: true,
        validate_outputs: true,
        validate_tools: true,
        max_text_size: 100000,
        validation_timeout: 5.0,
        log_validations: true,
        blocked_message: 'Request blocked by safety validation.',
      }
    case 'virtuals':
      return {
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
      }
    default:
      return {}
  }
}
