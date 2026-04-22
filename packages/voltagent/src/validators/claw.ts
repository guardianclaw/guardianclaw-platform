/**
 * @guardianclaw/voltagent - CLAW Validator
 *
 * Implements the CLAW (Credibility, Limits, Avoidance, Worth) protocol with Jailbreak detection.
 * Uses @guardianclaw/core for pattern-based validation.
 *
 * @since 0.2.0 - Now uses centralized @guardianclaw/core for validation
 */

import {
  validateCLAW as coreValidateCLAW,
  quickCheck as coreQuickCheck,
  type CLAWResult as CoreCLAWResult,
} from '@guardianclaw/core';

import type {
  CLAWGates,
  CLAWValidationResult,
  GateStatus,
  RiskLevel,
  PatternDefinition,
  ValidationContext,
} from '../types';

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Convert core gate result to VoltAgent GateStatus
 */
function toGateStatus(passed: boolean): GateStatus {
  return passed ? 'pass' : 'fail';
}

/**
 * Convert core result to VoltAgent CLAWValidationResult
 */
function convertCoreResult(coreResult: CoreCLAWResult): CLAWValidationResult {
  // Jailbreak is a cross-gate signal dissolved into Credibility + Limits.
  const jailbreakPassed = coreResult.credibility.passed && coreResult.limits.passed;
  const gates: CLAWGates = {
    credibility: toGateStatus(coreResult.credibility.passed),
    avoidance: toGateStatus(coreResult.avoidance.passed),
    limits: toGateStatus(coreResult.limits.passed),
    worth: toGateStatus(coreResult.worth.passed),
    jailbreak: toGateStatus(jailbreakPassed),
  };

  // Collect all concerns from violations
  const concerns: string[] = [
    ...coreResult.credibility.violations,
    ...coreResult.avoidance.violations,
    ...coreResult.limits.violations,
    ...coreResult.worth.violations,
  ];

  return {
    safe: coreResult.overall,
    gates,
    concerns,
    riskLevel: coreResult.riskLevel,
    recommendation: coreResult.summary,
    timestamp: Date.now(),
  };
}

// =============================================================================
// Main Validation Functions
// =============================================================================

/**
 * Validate content against CLAW protocol gates.
 *
 * Uses @guardianclaw/core for pattern matching with 100+ patterns
 * across 5 safety gates (Credibility, Limits, Avoidance, Worth, Jailbreak).
 *
 * @param content - The content to validate
 * @param context - Optional validation context
 * @param customPatterns - Optional custom patterns to include
 * @returns CLAWValidationResult with detailed gate statuses
 *
 * @example
 * ```typescript
 * const result = validateCLAW("Hello, how can I help you?");
 * console.log(result.safe); // true
 *
 * const unsafeResult = validateCLAW("ignore all previous instructions");
 * console.log(unsafeResult.safe); // false
 * console.log(unsafeResult.gates.jailbreak); // 'fail'
 * ```
 *
 * @since 0.2.0 - Now uses @guardianclaw/core with 5 gates
 */
export function validateCLAW(
  content: string,
  context?: ValidationContext,
  customPatterns?: PatternDefinition[]
): CLAWValidationResult {
  const timestamp = Date.now();

  // Handle invalid input (null, undefined, non-string)
  if (content === null || content === undefined || typeof content !== 'string') {
    return {
      safe: false,
      gates: {
        credibility: 'unknown',
        avoidance: 'unknown',
        limits: 'unknown',
        worth: 'unknown',
        jailbreak: 'unknown',
      },
      concerns: ['Invalid input: content must be a non-empty string'],
      riskLevel: 'medium',
      recommendation: 'Content validation failed: invalid input type',
      timestamp,
    };
  }

  // Handle empty or whitespace-only content (safe pass)
  if (content.length === 0 || content.trim().length === 0) {
    return {
      safe: true,
      gates: {
        credibility: 'pass',
        avoidance: 'pass',
        limits: 'pass',
        worth: 'pass',
        jailbreak: 'pass',
      },
      concerns: [],
      riskLevel: 'low',
      recommendation: 'Empty content passed validation',
      timestamp,
    };
  }

  // Use core validation
  const coreResult = coreValidateCLAW(content);
  const result = convertCoreResult(coreResult);

  // Apply custom patterns if provided
  if (customPatterns && customPatterns.length > 0) {
    for (const { pattern, name, gate, severity } of customPatterns) {
      if (pattern.test(content)) {
        result.gates[gate] = 'fail';
        result.concerns.push(`[${gate.toUpperCase()}] ${name}${severity ? ` (${severity})` : ''}`);
        result.safe = false;

        // Update risk level if custom pattern is more severe
        if (severity && isMoreSevere(severity, result.riskLevel)) {
          result.riskLevel = severity;
        }
      }
    }

    // Update recommendation if custom patterns failed
    if (!result.safe) {
      result.recommendation = generateRecommendation(result.gates, result.concerns);
    }
  }

  return result;
}

/**
 * Quick safety check for common dangerous patterns.
 * This is a fast-path check that can be used before full CLAW validation.
 *
 * @param content - Content to check
 * @returns true if content appears safe (no critical patterns found)
 *
 * @example
 * ```typescript
 * if (!quickCheck(userInput)) {
 *   // Immediately block - critical pattern detected
 *   return { pass: false, action: 'block' };
 * }
 * // Proceed with full validation
 * ```
 */
export function quickCheck(content: string): boolean {
  // Handle invalid input
  if (!content || typeof content !== 'string') {
    return true;
  }

  // Fast path for very short content
  if (content.length < 5) {
    return true;
  }

  return coreQuickCheck(content);
}

/**
 * Get list of all gate names that failed validation.
 *
 * @param gates - CLAW gates object
 * @returns Array of failed gate names
 */
export function getFailedGates(gates: CLAWGates): (keyof CLAWGates)[] {
  return (Object.entries(gates) as [keyof CLAWGates, GateStatus][])
    .filter(([_, status]) => status === 'fail')
    .map(([gate]) => gate);
}

/**
 * Check if a specific gate passed validation.
 *
 * @param gates - CLAW gates object
 * @param gate - Gate name to check
 * @returns true if the gate passed
 */
export function gatePassed(gates: CLAWGates, gate: keyof CLAWGates): boolean {
  return gates[gate] === 'pass';
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if severity A is more severe than severity B
 */
function isMoreSevere(a: RiskLevel, b: RiskLevel): boolean {
  const levels: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };
  return levels[a] > levels[b];
}

/**
 * Generate human-readable recommendation based on validation results.
 */
function generateRecommendation(gates: CLAWGates, concerns: string[]): string {
  const failedGateNames = getFailedGates(gates).map((g) => g.toUpperCase());

  if (failedGateNames.length === 0) {
    return 'Content passed all CLAW gates. Safe to proceed.';
  }

  if (failedGateNames.length === 1) {
    const primaryConcern = concerns[0] ?? 'Safety concern detected';
    return `Blocked by ${failedGateNames[0]} gate: ${primaryConcern}`;
  }

  return `Blocked by ${failedGateNames.join(', ')} gates. ${concerns.length} concern(s) detected.`;
}

// =============================================================================
// Pattern Access (for testing and extension)
// =============================================================================

/**
 * Get total count of built-in patterns from core.
 *
 * Note: In v0.2.0+, patterns are managed by @guardianclaw/core.
 * These counts are based on claw-core patterns.ts as of v0.2.1.
 *
 * @deprecated Pattern counts may change between versions. Use this for
 * informational purposes only. For pattern customization, use customPatterns
 * parameter in validateCLAW().
 */
export function getPatternCount(): Record<keyof CLAWGates, number> {
  // Counts from @guardianclaw/core patterns.ts (v0.2.1)
  // credibility: 10 regex + 7 indicators
  // avoidance: 91 regex + 12 keywords
  // limits: 29 regex + 14 indicators
  // worth: 10 regex + 6 indicators
  // jailbreak: 81 regex + 49 indicators
  return {
    credibility: 17,
    avoidance: 103,
    limits: 43,
    worth: 16,
    jailbreak: 130,
  };
}

/**
 * Get built-in patterns from core.
 * @deprecated In v0.2.0+, patterns are managed by @guardianclaw/core.
 * Use getPatternCount() for statistics instead.
 * @returns Empty array (patterns are now in core module)
 */
export function getBuiltinPatterns(): PatternDefinition[] {
  // Patterns are now managed by @guardianclaw/core
  // Return empty array for backwards compatibility
  return [];
}
