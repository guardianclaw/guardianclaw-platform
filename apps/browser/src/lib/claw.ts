/**
 * GuardianClaw Guard - CLAW Protocol
 *
 * Credibility-Limits-Avoidance-Worth validation for browser actions.
 * Uses @guardianclaw/core for validation, with browser-specific context.
 */

import {
  validateCLAW as coreValidateCLAW,
  quickCheck as coreQuickCheck,
  checkJailbreak as coreCheckJailbreak,
  type CLAWResult as CoreCLAWResult,
  type GateResult as CoreGateResult,
} from '@guardianclaw/core';

// =============================================================================
// BROWSER-SPECIFIC TYPES
// =============================================================================

export interface GateResult {
  passed: boolean;
  score: number;
  issues: string[];
}

export interface CLAWResult {
  credibility: GateResult;
  avoidance: GateResult;
  limits: GateResult;
  worth: GateResult;
  jailbreak: GateResult;
  overall: boolean;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ValidationContext {
  source: 'user' | 'extension' | 'page' | 'unknown';
  platform: string;
  action: 'send' | 'copy' | 'export' | 'share';
  userConfirmed?: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Convert core gate result to browser format
 */
function convertGateResult(coreGate: CoreGateResult): GateResult {
  return {
    passed: coreGate.passed,
    score: coreGate.score,
    issues: coreGate.violations,
  };
}

/**
 * Create a default context for validation
 */
function getDefaultContext(): ValidationContext {
  return {
    source: 'user',
    platform: 'generic',
    action: 'send',
    userConfirmed: false,
  };
}

/**
 * Create a failed gate result for invalid input
 */
function createFailedGate(reason: string): GateResult {
  return { passed: false, score: 0, issues: [reason] };
}

// =============================================================================
// BROWSER-SPECIFIC VALIDATION
// =============================================================================

/**
 * Apply browser-specific context validation
 * Adds checks that are only relevant in browser context
 */
function applyBrowserContextChecks(
  result: CLAWResult,
  context: ValidationContext
): CLAWResult {
  // Check source authenticity
  if (context.source === 'unknown') {
    result.limits.issues.push('Input source is unknown');
    result.limits.score = Math.max(0, result.limits.score - 20);
    if (result.limits.score < 50) {
      result.limits.passed = false;
    }
  } else if (context.source === 'extension') {
    result.limits.issues.push('Input originated from another extension');
    result.limits.score = Math.max(0, result.limits.score - 10);
  }

  // Check platform-action compatibility
  const platformActions: Record<string, string[]> = {
    chatgpt: ['send', 'copy', 'export'],
    claude: ['send', 'copy', 'export'],
    gemini: ['send', 'copy'],
    perplexity: ['send', 'copy'],
    default: ['send', 'copy'],
  };

  const allowedActions =
    platformActions[context.platform] || platformActions.default;
  if (!allowedActions.includes(context.action)) {
    result.limits.issues.push(
      `Action '${context.action}' not typical for ${context.platform}`
    );
    result.limits.score = Math.max(0, result.limits.score - 15);
    if (result.limits.score < 50) {
      result.limits.passed = false;
    }
  }

  // Recalculate overall after context checks
  result.overall =
    result.credibility.passed &&
    result.avoidance.passed &&
    result.limits.passed &&
    result.worth.passed &&
    result.jailbreak.passed;

  return result;
}

// =============================================================================
// MAIN VALIDATION FUNCTIONS
// =============================================================================

/**
 * Run full CLAW validation with browser context
 *
 * Uses @guardianclaw/core for pattern matching, then applies
 * browser-specific context validation on top.
 */
export function validateCLAW(
  input: string,
  context?: ValidationContext | null
): CLAWResult {
  // Handle null/undefined input
  if (!input || typeof input !== 'string') {
    const failedGate = createFailedGate('Invalid input: null or non-string');
    return {
      credibility: failedGate,
      avoidance: failedGate,
      limits: failedGate,
      worth: failedGate,
      jailbreak: failedGate,
      overall: false,
      summary: 'Validation failed: Invalid input provided',
      riskLevel: 'critical',
    };
  }

  // Handle null/undefined context
  const safeContext = context ?? getDefaultContext();

  // Use core validation
  const coreResult: CoreCLAWResult = coreValidateCLAW(input);

  // Convert to browser format
  const credibilityGate = convertGateResult(coreResult.credibility);
  const jailbreakGate = convertGateResult(coreResult.jailbreak);

  // For backwards compatibility: propagate jailbreak issues to credibility gate
  // Jailbreaks are fundamentally violations of truthfulness (pretending to be something else)
  if (!jailbreakGate.passed) {
    credibilityGate.passed = false;
    credibilityGate.score = Math.min(credibilityGate.score, jailbreakGate.score);
    credibilityGate.issues.push(...jailbreakGate.issues.map(i => i.replace('Jailbreak', 'Credibility/Override')));
  }

  let browserResult: CLAWResult = {
    credibility: credibilityGate,
    avoidance: convertGateResult(coreResult.avoidance),
    limits: convertGateResult(coreResult.limits),
    worth: convertGateResult(coreResult.worth),
    jailbreak: jailbreakGate,
    overall: coreResult.overall,
    summary: coreResult.summary,
    riskLevel: coreResult.riskLevel,
  };

  // Apply browser-specific context checks
  browserResult = applyBrowserContextChecks(browserResult, safeContext);

  // Update summary if needed
  if (!browserResult.overall) {
    const failedGates = [];
    if (!browserResult.credibility.passed) failedGates.push('Credibility');
    if (!browserResult.avoidance.passed) failedGates.push('Avoidance');
    if (!browserResult.limits.passed) failedGates.push('Limits');
    if (!browserResult.worth.passed) failedGates.push('Worth');
    if (!browserResult.jailbreak.passed) failedGates.push('Jailbreak');

    const allIssues = [
      ...browserResult.credibility.issues,
      ...browserResult.avoidance.issues,
      ...browserResult.limits.issues,
      ...browserResult.worth.issues,
      ...browserResult.jailbreak.issues,
    ];

    browserResult.summary = `Failed gates: ${failedGates.join(', ')}. Issues: ${allIssues.slice(0, 3).join('; ')}`;
  }

  return browserResult;
}

/**
 * Quick check - returns true if input is likely safe
 *
 * Uses core quick check for fast validation.
 */
export function quickCheck(input: string): boolean {
  // Handle null/undefined input - fail closed (return false = not safe)
  if (!input || typeof input !== 'string') {
    return false;
  }

  return coreQuickCheck(input);
}

/**
 * Check specifically for jailbreak attempts
 *
 * Exposes core jailbreak detection for components that need it.
 */
export function checkJailbreak(input: string): GateResult {
  if (!input || typeof input !== 'string') {
    return createFailedGate('Invalid input: null or non-string');
  }

  const coreResult = coreCheckJailbreak(input);
  return convertGateResult(coreResult);
}
