/**
 * CLAW Heuristic Validator - Pattern-based validation through 5 gates
 *
 * Implements the CLAW Protocol (Credibility-Limits-Avoidance-Worth) with Jailbreak detection.
 * Uses patterns from patterns.ts which are synchronized with Python core.
 *
 * For semantic (LLM-based) validation, use the API client instead.
 *
 * @author GuardianClaw Team
 * @license MIT
 */

import {
  DECEPTION_PATTERNS,
  MISINFORMATION_INDICATORS,
  HARM_PATTERNS,
  HARM_KEYWORDS,
  SCOPE_PATTERNS,
  SCOPE_INDICATORS,
  PURPOSE_PATTERNS,
  PURPOSE_INDICATORS,
  INSTRUCTION_OVERRIDE_PATTERNS,
  ROLE_MANIPULATION_PATTERNS,
  PROMPT_EXTRACTION_PATTERNS,
  FILTER_BYPASS_PATTERNS,
  ROLEPLAY_MANIPULATION_PATTERNS,
  SYSTEM_INJECTION_PATTERNS,
  JAILBREAK_INDICATORS,
  SENSITIVE_DATA_PATTERNS,
} from './patterns';

// =============================================================================
// TYPES
// =============================================================================

export interface GateResult {
  passed: boolean;
  score: number;
  violations: string[];
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
  source?: 'user' | 'agent' | 'extension' | 'unknown';
  platform?: string;
  strictMode?: boolean;
}

// =============================================================================
// GATE IMPLEMENTATIONS
// =============================================================================

function checkPatterns(text: string, patterns: RegExp[]): string[] {
  const violations: string[] = [];
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      violations.push(`Pattern match: ${pattern.source.substring(0, 50)}...`);
    }
  }
  return violations;
}

function checkIndicators(text: string, indicators: string[]): string[] {
  const violations: string[] = [];
  const textLower = text.toLowerCase();
  for (const indicator of indicators) {
    if (textLower.includes(indicator)) {
      violations.push(`Indicator match: ${indicator}`);
    }
  }
  return violations;
}

/**
 * Credibility Gate: Checks for deception and misinformation
 */
function validateCredibility(text: string): GateResult {
  const violations: string[] = [];

  // Check deception patterns
  violations.push(...checkPatterns(text, DECEPTION_PATTERNS));

  // Check misinformation indicators
  violations.push(...checkIndicators(text, MISINFORMATION_INDICATORS));

  const score = Math.max(0, 100 - violations.length * 25);

  return {
    passed: violations.length === 0,
    score,
    violations,
  };
}

/**
 * Avoidance Gate: Checks for harmful content and sensitive data exposure
 */
function validateAvoidance(text: string): GateResult {
  const violations: string[] = [];

  // Check all avoidance pattern categories
  for (const [category, patterns] of Object.entries(HARM_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        violations.push(`Avoidance (${category}): ${pattern.source.substring(0, 40)}...`);
      }
    }
  }

  // Check sensitive data patterns (credentials, PII)
  for (const [category, patterns] of Object.entries(SENSITIVE_DATA_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        violations.push(`Sensitive data (${category}): detected`);
      }
    }
  }

  // Check avoidance keywords
  violations.push(...checkIndicators(text, HARM_KEYWORDS));

  const score = Math.max(0, 100 - violations.length * 30);

  return {
    passed: violations.length === 0,
    score,
    violations,
  };
}

/**
 * Limits Gate: Checks for boundary violations
 */
function validateLimits(text: string): GateResult {
  const violations: string[] = [];

  // Check limits pattern categories
  for (const [category, patterns] of Object.entries(SCOPE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        violations.push(`Limits (${category}): ${pattern.source.substring(0, 40)}...`);
      }
    }
  }

  // Check limits indicators
  violations.push(...checkIndicators(text, SCOPE_INDICATORS));

  const score = Math.max(0, 100 - violations.length * 25);

  return {
    passed: violations.length === 0,
    score,
    violations,
  };
}

/**
 * Worth Gate: Checks for lack of legitimate purpose
 * Now includes embodied AI patterns for physical actions without purpose
 */
function validateWorth(text: string): GateResult {
  const violations: string[] = [];

  // Check all worth pattern categories (including embodied actions)
  for (const [category, patterns] of Object.entries(PURPOSE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        violations.push(`Worth (${category}): ${pattern.source.substring(0, 40)}...`);
      }
    }
  }

  // Check worth indicators
  violations.push(...checkIndicators(text, PURPOSE_INDICATORS));

  const score = Math.max(0, 100 - violations.length * 25);

  return {
    passed: violations.length === 0,
    score,
    violations,
  };
}

/**
 * Jailbreak Gate: Checks for prompt injection and jailbreak attempts
 * This is the most critical gate for AI safety
 */
function validateJailbreak(text: string): GateResult {
  const violations: string[] = [];

  // Check instruction override patterns
  for (const pattern of INSTRUCTION_OVERRIDE_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Jailbreak (instruction_override): ${pattern.source.substring(0, 40)}...`);
    }
  }

  // Check role manipulation patterns
  for (const pattern of ROLE_MANIPULATION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Jailbreak (role_manipulation): ${pattern.source.substring(0, 40)}...`);
    }
  }

  // Check prompt extraction patterns
  for (const pattern of PROMPT_EXTRACTION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Jailbreak (prompt_extraction): ${pattern.source.substring(0, 40)}...`);
    }
  }

  // Check filter bypass patterns
  for (const pattern of FILTER_BYPASS_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Jailbreak (filter_bypass): ${pattern.source.substring(0, 40)}...`);
    }
  }

  // Check roleplay manipulation patterns
  for (const pattern of ROLEPLAY_MANIPULATION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Jailbreak (roleplay_manipulation): ${pattern.source.substring(0, 40)}...`);
    }
  }

  // Check system injection patterns
  for (const pattern of SYSTEM_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push(`Jailbreak (system_injection): ${pattern.source.substring(0, 40)}...`);
    }
  }

  // Check exact jailbreak indicators
  violations.push(
    ...checkIndicators(text, JAILBREAK_INDICATORS).map(
      (v) => v.replace('Indicator match:', 'Jailbreak indicator:')
    )
  );

  // Jailbreak violations are critical - heavy score penalty
  const score = Math.max(0, 100 - violations.length * 50);

  return {
    passed: violations.length === 0,
    score,
    violations,
  };
}

// =============================================================================
// MAIN VALIDATOR
// =============================================================================

/**
 * Validate text through all CLAW gates with Jailbreak detection
 *
 * @param text - Text to validate
 * @param context - Optional validation context
 * @returns CLAWResult with all gate results
 */
export function validateCLAW(text: string, _context?: ValidationContext): CLAWResult {
  // Handle null/undefined/non-string input
  if (!text || typeof text !== 'string') {
    return {
      credibility: { passed: false, score: 0, violations: ['Invalid input'] },
      avoidance: { passed: false, score: 0, violations: ['Invalid input'] },
      limits: { passed: false, score: 0, violations: ['Invalid input'] },
      worth: { passed: false, score: 0, violations: ['Invalid input'] },
      jailbreak: { passed: false, score: 0, violations: ['Invalid input'] },
      overall: false,
      summary: 'Invalid input: null, undefined, or non-string',
      riskLevel: 'critical',
    };
  }

  // Run all gates
  const jailbreak = validateJailbreak(text);
  const credibility = validateCredibility(text);
  const avoidance = validateAvoidance(text);
  const limits = validateLimits(text);
  const worth = validateWorth(text);

  // Overall passes only if ALL gates pass
  const overall = jailbreak.passed && credibility.passed && avoidance.passed && limits.passed && worth.passed;

  // Collect failed gates for summary
  const failedGates: string[] = [];
  if (!jailbreak.passed) failedGates.push('Jailbreak');
  if (!credibility.passed) failedGates.push('Credibility');
  if (!avoidance.passed) failedGates.push('Avoidance');
  if (!limits.passed) failedGates.push('Limits');
  if (!worth.passed) failedGates.push('Worth');

  // Calculate risk level based on failures
  let riskLevel: CLAWResult['riskLevel'] = 'low';
  if (!jailbreak.passed) {
    riskLevel = 'critical'; // Jailbreak attempts are always critical
  } else if (!avoidance.passed) {
    riskLevel = 'high';
  } else if (!credibility.passed || !limits.passed) {
    riskLevel = 'medium';
  } else if (!worth.passed) {
    riskLevel = 'low';
  }

  // Generate summary
  const summary = overall
    ? 'All gates passed'
    : `Failed gates: ${failedGates.join(', ')}`;

  return {
    credibility,
    avoidance,
    limits,
    worth,
    jailbreak,
    overall,
    summary,
    riskLevel,
  };
}

/**
 * Quick check - returns true if text passes all gates
 *
 * @param text - Text to validate
 * @returns true if safe, false if any gate fails
 */
export function quickCheck(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check jailbreak first (most common attack vector)
  const jailbreak = validateJailbreak(text);
  if (!jailbreak.passed) return false;

  // Check avoidance (most dangerous)
  const avoidance = validateAvoidance(text);
  if (!avoidance.passed) return false;

  // Check credibility
  const credibility = validateCredibility(text);
  if (!credibility.passed) return false;

  // Check limits
  const limits = validateLimits(text);
  if (!limits.passed) return false;

  // Check worth
  const worth = validateWorth(text);
  if (!worth.passed) return false;

  return true;
}

/**
 * Check specifically for jailbreak attempts
 *
 * @param text - Text to check
 * @returns GateResult with jailbreak detection results
 */
export function checkJailbreak(text: string): GateResult {
  if (!text || typeof text !== 'string') {
    return { passed: false, score: 0, violations: ['Invalid input'] };
  }
  return validateJailbreak(text);
}

/**
 * Check specifically for harmful content
 *
 * @param text - Text to check
 * @returns GateResult with avoidance detection results
 */
export function checkHarm(text: string): GateResult {
  if (!text || typeof text !== 'string') {
    return { passed: false, score: 0, violations: ['Invalid input'] };
  }
  return validateAvoidance(text);
}
