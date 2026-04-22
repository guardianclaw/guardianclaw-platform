/**
 * @guardianclaw/core
 *
 * Core validation module for GuardianClaw - The canonical CLAW implementation.
 *
 * This package provides:
 * - Heuristic validation (pattern-based, offline)
 * - API client for semantic validation (LLM-based, online)
 * - All patterns synchronized from Python core
 *
 * Usage:
 *   import { validateCLAW, quickCheck } from '@guardianclaw/core';
 *
 *   // Heuristic validation (fast, offline)
 *   const result = validateCLAW("some text");
 *   if (!result.overall) {
 *     console.log("Blocked:", result.summary);
 *   }
 *
 *   // Quick check
 *   if (!quickCheck("some text")) {
 *     console.log("Text is not safe");
 *   }
 *
 *   // With API fallback
 *   import { validateWithFallback } from '@guardianclaw/core';
 *   const result = await validateWithFallback("some text");
 *
 * @author GuardianClaw Team
 * @license MIT
 */

// =============================================================================
// VALIDATOR EXPORTS (Heuristic/Offline)
// =============================================================================

export {
  validateCLAW,
  quickCheck,
  checkJailbreak,
  type GateResult,
  type CLAWResult,
  type ValidationContext,
} from './validator';

// =============================================================================
// API CLIENT EXPORTS (Semantic/Online)
// =============================================================================

export {
  configureApi,
  getApiConfig,
  validateViaApi,
  validateSemantic,
  validateWithFallback,
  checkApiHealth,
  type ApiConfig,
  type ValidateRequest,
  type ValidateResponse,
  type SemanticValidateRequest,
  type SemanticValidateResponse,
} from './api-client';

// =============================================================================
// PATTERN EXPORTS (For advanced usage)
// =============================================================================

export {
  // Credibility Gate
  DECEPTION_PATTERNS,
  MISINFORMATION_INDICATORS,
  // Limits Gate
  LIMITS_PATTERNS,
  AUTHORITY_INDICATORS,
  // Avoidance Gate
  AVOIDANCE_PATTERNS,
  AVOIDANCE_KEYWORDS,
  SYSTEM_ACCESS_INDICATORS,
  // Worth Gate
  WORTH_PATTERNS,
  WORTH_INDICATORS,
  // Jailbreak attack-type patterns (distributed across Credibility & Limits)
  INSTRUCTION_OVERRIDE_PATTERNS,
  ROLE_MANIPULATION_PATTERNS,
  PROMPT_EXTRACTION_PATTERNS,
  FILTER_BYPASS_PATTERNS,
  ROLEPLAY_MANIPULATION_PATTERNS,
  SYSTEM_INJECTION_PATTERNS,
  JAILBREAK_INDICATORS,
  // Sensitive Data
  SENSITIVE_DATA_PATTERNS,
  // Collections
  ALL_JAILBREAK_PATTERNS,
  ALL_LIMITS_PATTERNS,
  ALL_AVOIDANCE_PATTERNS,
  ALL_WORTH_PATTERNS,
} from './patterns';

// =============================================================================
// MEMORY INJECTION PATTERNS (For memory integrity validation)
// =============================================================================

export {
  // Version
  MEMORY_PATTERNS_VERSION,
  // Enum
  InjectionCategory,
  // Types
  type InjectionPattern,
  type CompiledInjectionPattern,
  type InjectionSeverity,
  // Severity mapping
  getCategorySeverity,
  // Pattern groups
  AUTHORITY_PATTERNS,
  INSTRUCTION_OVERRIDE_PATTERNS_MEMORY,
  ADDRESS_REDIRECTION_PATTERNS,
  AIRDROP_SCAM_PATTERNS,
  URGENCY_PATTERNS,
  TRUST_EXPLOITATION_PATTERNS,
  ROLE_MANIPULATION_PATTERNS_MEMORY,
  CONTEXT_POISONING_PATTERNS,
  CRYPTO_ATTACK_PATTERNS,
  // Combined patterns
  ALL_MEMORY_INJECTION_PATTERNS,
  COMPILED_MEMORY_INJECTION_PATTERNS,
  // Utilities
  compilePatterns,
  getPatternsByCategory,
  getHighConfidencePatterns,
  getPatternByName,
  getPatternStatistics,
} from './memory-patterns';

// =============================================================================
// VERSION
// =============================================================================

export const VERSION = '3.0.0-rc.1';
