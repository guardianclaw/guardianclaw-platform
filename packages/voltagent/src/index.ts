/**
 * @guardianclaw/voltagent
 *
 * AI safety guardrails for VoltAgent applications.
 *
 * This package provides VoltAgent-compatible guardrails that implement:
 * - CLAW Protocol: Credibility, Limits, Avoidance, Worth validation
 * - OWASP Protection: SQL injection, XSS, command injection, etc.
 * - PII Detection: Email, phone, SSN, credit cards, API keys, etc.
 *
 * @example Quick Start
 * ```typescript
 * import { Agent } from "@voltagent/core";
 * import { createGuardianClawGuardrails } from "@guardianclaw/voltagent";
 *
 * const { inputGuardrails, outputGuardrails } = createGuardianClawGuardrails({
 *   level: "strict",
 *   enablePII: true,
 * });
 *
 * const agent = new Agent({
 *   name: "safe-agent",
 *   inputGuardrails,
 *   outputGuardrails,
 * });
 * ```
 *
 * @see https://github.com/guardian-claw/guardianclaw/tree/main/packages/voltagent
 * @see https://voltagent.dev/docs/
 */

// =============================================================================
// Guardrail Factories (Primary API)
// =============================================================================

// Bundle function - recommended for most use cases
export {
  createGuardianClawGuardrails,
  createChatGuardrails,
  createAgentGuardrails,
  createPrivacyGuardrails,
  createDevelopmentGuardrails,
  getPresetConfig,
  getAvailableLevels,
  type GuardianClawGuardrailBundle,
} from './guardrails/bundle';

// Individual guardrail factories
export {
  // Input guardrails
  createGuardianClawInputGuardrail,
  createStrictInputGuardrail,
  createPermissiveInputGuardrail,
  createCLAWOnlyGuardrail,
  createOWASPOnlyGuardrail,
  type GuardianClawInputGuardrail,
  // Output guardrails
  createGuardianClawOutputGuardrail,
  createPIIOutputGuardrail,
  createStrictOutputGuardrail,
  createPermissiveOutputGuardrail,
  type GuardianClawOutputGuardrail,
  // Streaming handlers
  createGuardianClawPIIRedactor,
  createStrictStreamingRedactor,
  createPermissiveStreamingRedactor,
  createMonitoringStreamHandler,
  createStreamingState,
  type StreamingConfig,
} from './guardrails';

// =============================================================================
// Validators (For Advanced Use)
// =============================================================================

// CLAW Validator
export {
  validateCLAW,
  quickCheck,
  getFailedGates,
  gatePassed,
  getBuiltinPatterns,
  getCLAWPatternCount,
} from './validators';

// OWASP Validator
export {
  validateOWASP,
  quickOWASPCheck,
  hasViolation,
  getOWASPPatternsForType,
  getPatternStats,
  getOWASPPatternCount,
} from './validators';

// PII Validator
export {
  detectPII,
  hasPII,
  redactPII,
  maskPII,
  createStreamingRedactor,
  getPIIPatternsForType,
  getSupportedPIITypes,
  getPIIPatternCount,
} from './validators';

// =============================================================================
// Type Exports
// =============================================================================

export type {
  // Core types
  RiskLevel,
  GateStatus,
  GuardrailAction,
  CLAWGates,

  // Validation results
  CLAWValidationResult,
  OWASPValidationResult,
  OWASPViolationType,
  OWASPFinding,
  PIIDetectionResult,
  PIIType,
  PIIMatch,
  FullValidationResult,

  // Pattern definitions
  PatternDefinition,
  OWASPPatternDefinition,
  PIIPatternDefinition,

  // Configuration
  GuardianClawGuardrailConfig,
  GuardianClawBundleConfig,
  ValidationContext,

  // Streaming
  StreamingGuardrailState,
  StreamingChunkResult,
  TextStream,
  StreamHandler,

  // VoltAgent compatibility (re-exported from @voltagent/core)
  VoltAgentOperationType,
  VoltAgentInputArgs,
  VoltAgentInputResult,
  VoltAgentOutputArgs,
  VoltAgentOutputResult,
  VoltAgentTextStreamPart,
  VoltAgentOutputStreamArgs,
  VoltAgentOutputStreamResult,
  VoltAgentStreamHandler,
} from './types';

// =============================================================================
// Version & Metadata
// =============================================================================

/**
 * Package version.
 */
export const VERSION = '0.3.0';

/**
 * Package name.
 */
export const PACKAGE_NAME = '@guardianclaw/voltagent';

/**
 * Supported VoltAgent version range.
 */
export const VOLTAGENT_VERSION_RANGE = '>=2.0.0';
