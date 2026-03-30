/**
 * @guardianclaw/voltagent - Bundle Function
 *
 * Provides preset configurations for common use cases.
 * Simplifies setup by bundling input and output guardrails together.
 */

import type { GuardianClawBundleConfig, GuardianClawGuardrailConfig } from '../types';
import { createGuardianClawInputGuardrail, type GuardianClawInputGuardrail } from './input';
import { createGuardianClawOutputGuardrail, type GuardianClawOutputGuardrail } from './output';

// =============================================================================
// Bundle Result Type
// =============================================================================

/**
 * Result of createGuardianClawGuardrails bundle function.
 */
export interface GuardianClawGuardrailBundle<T = unknown> {
  /** Array of input guardrails (for VoltAgent inputGuardrails property) */
  inputGuardrails: GuardianClawInputGuardrail[];
  /** Array of output guardrails (for VoltAgent outputGuardrails property) */
  outputGuardrails: GuardianClawOutputGuardrail<T>[];
  /** The resolved configuration used */
  config: GuardianClawGuardrailConfig;
}

// =============================================================================
// Preset Configurations
// =============================================================================

/**
 * Preset configurations for different security levels.
 */
const PRESET_CONFIGS: Record<'permissive' | 'standard' | 'strict', GuardianClawGuardrailConfig> = {
  permissive: {
    blockUnsafe: false,
    enableCLAW: true,
    enableOWASP: false,
    enablePII: false,
    logChecks: true,
  },
  standard: {
    blockUnsafe: true,
    enableCLAW: true,
    enableOWASP: true,
    enablePII: false,
    minBlockLevel: 'medium',
  },
  strict: {
    blockUnsafe: true,
    enableCLAW: true,
    enableOWASP: true,
    enablePII: true,
    minBlockLevel: 'low',
    redactPII: true,
  },
};

// =============================================================================
// Bundle Factory
// =============================================================================

/**
 * Create a complete set of GuardianClaw guardrails for VoltAgent.
 *
 * This is the recommended way to add GuardianClaw protection to a VoltAgent agent.
 * It provides preset configurations for common use cases and handles both
 * input and output guardrails.
 *
 * @param bundleConfig - Bundle configuration
 * @returns Object with inputGuardrails and outputGuardrails arrays
 *
 * @example
 * ```typescript
 * import { Agent } from "@voltagent/core";
 * import { createGuardianClawGuardrails } from "@guardianclaw/voltagent";
 *
 * // Simple usage with preset
 * const { inputGuardrails, outputGuardrails } = createGuardianClawGuardrails({
 *   level: "strict",
 * });
 *
 * const agent = new Agent({
 *   name: "safe-agent",
 *   inputGuardrails,
 *   outputGuardrails,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // With PII protection enabled
 * const guardrails = createGuardianClawGuardrails({
 *   level: "standard",
 *   enablePII: true,
 * });
 *
 * const agent = new Agent({
 *   ...guardrails,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Custom configuration
 * const guardrails = createGuardianClawGuardrails({
 *   custom: {
 *     enableCLAW: true,
 *     enableOWASP: true,
 *     enablePII: true,
 *     blockUnsafe: true,
 *     redactPII: true,
 *     piiTypes: ['EMAIL', 'PHONE', 'SSN'],
 *   },
 * });
 * ```
 */
export function createGuardianClawGuardrails<T = unknown>(
  bundleConfig: GuardianClawBundleConfig = {}
): GuardianClawGuardrailBundle<T> {
  // Resolve configuration
  const baseConfig = PRESET_CONFIGS[bundleConfig.level ?? 'standard'];
  const config: GuardianClawGuardrailConfig = {
    ...baseConfig,
    // Override PII if specified
    ...(bundleConfig.enablePII !== undefined && {
      enablePII: bundleConfig.enablePII,
      redactPII: bundleConfig.enablePII,
    }),
    // Apply custom overrides
    ...bundleConfig.custom,
  };

  // Create input guardrail
  const inputGuardrail = createGuardianClawInputGuardrail(config);

  // Create output guardrail with PII focus
  const outputConfig: GuardianClawGuardrailConfig = {
    ...config,
    // Output guardrails typically don't need CLAW
    enableCLAW: false,
    // But always check for sensitive data
    enableOWASP: true,
    // PII is the main concern for output
    enablePII: bundleConfig.enablePII ?? config.enablePII ?? false,
    redactPII: bundleConfig.enablePII ?? config.redactPII ?? false,
    // Output guardrails typically modify rather than block
    blockUnsafe: false,
  };

  const outputGuardrail = createGuardianClawOutputGuardrail<T>(outputConfig);

  return {
    inputGuardrails: [inputGuardrail],
    outputGuardrails: [outputGuardrail],
    config,
  };
}

// =============================================================================
// Specialized Bundle Functions
// =============================================================================

/**
 * Create guardrails optimized for chat applications.
 * Focuses on jailbreak prevention and safe content generation.
 */
export function createChatGuardrails<T = unknown>(): GuardianClawGuardrailBundle<T> {
  return createGuardianClawGuardrails<T>({
    level: 'standard',
    enablePII: true,
    custom: {
      // Focus on limits (jailbreak) and avoidance
      minBlockLevel: 'medium',
    },
  });
}

/**
 * Create guardrails optimized for agent applications.
 * Focuses on preventing dangerous tool calls and OWASP violations.
 */
export function createAgentGuardrails<T = unknown>(): GuardianClawGuardrailBundle<T> {
  return createGuardianClawGuardrails<T>({
    level: 'strict',
    enablePII: true,
    custom: {
      // Agents need stricter OWASP checks
      owaspChecks: [
        'SQL_INJECTION',
        'COMMAND_INJECTION',
        'PATH_TRAVERSAL',
        'SSRF',
        'PROMPT_INJECTION',
      ],
    },
  });
}

/**
 * Create guardrails for privacy-sensitive applications.
 * Focuses on PII detection and redaction.
 */
export function createPrivacyGuardrails<T = unknown>(): GuardianClawGuardrailBundle<T> {
  return createGuardianClawGuardrails<T>({
    level: 'standard',
    enablePII: true,
    custom: {
      // Enable all PII types
      piiTypes: [
        'EMAIL',
        'PHONE',
        'SSN',
        'CREDIT_CARD',
        'IP_ADDRESS',
        'DATE_OF_BIRTH',
        'API_KEY',
        'AWS_KEY',
        'PRIVATE_KEY',
        'JWT_TOKEN',
      ],
      redactPII: true,
    },
  });
}

/**
 * Create minimal guardrails for development/testing.
 * Only logs issues, doesn't block content.
 */
export function createDevelopmentGuardrails<T = unknown>(
  logger?: (message: string, data?: Record<string, unknown>) => void
): GuardianClawGuardrailBundle<T> {
  return createGuardianClawGuardrails<T>({
    level: 'permissive',
    custom: {
      blockUnsafe: false,
      logChecks: true,
      logger: logger ?? console.log,
    },
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the preset configuration for a security level.
 */
export function getPresetConfig(
  level: 'permissive' | 'standard' | 'strict'
): GuardianClawGuardrailConfig {
  return { ...PRESET_CONFIGS[level] };
}

/**
 * Get available security levels.
 */
export function getAvailableLevels(): Array<'permissive' | 'standard' | 'strict'> {
  return ['permissive', 'standard', 'strict'];
}
