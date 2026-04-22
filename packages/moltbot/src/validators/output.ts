/**
 * @guardianclaw/moltbot - Output Validator
 *
 * Validates AI output content before sending to the user.
 * Checks for data leaks, harmful content, and compliance with injected instructions.
 *
 * Features:
 * - CLAW validation via @guardianclaw/core
 * - Sensitive data leak detection (API keys, passwords, etc.)
 * - Destructive command detection
 * - Extensible via pattern registry
 * - Full observability via logging and metrics
 *
 * @example
 * ```typescript
 * import { validateOutput } from './output';
 *
 * const result = await validateOutput(content, levelConfig);
 * if (result.shouldBlock) {
 *   // Block the output
 * }
 * ```
 */

import type {
  OutputValidationResult,
  LevelConfig,
  DetectedIssue,
  GateResults,
  RiskLevel,
} from '../types';
import {
  validateCLAW,
  SENSITIVE_DATA_PATTERNS,
  type CLAWResult,
  patternRegistry,
} from './patterns';
import { logger, logValidation, logError } from '../internal/logger';
import { metrics } from '../internal/metrics';

// =============================================================================
// Types
// =============================================================================

/**
 * Options for output validation.
 */
export interface OutputValidationOptions {
  /** Patterns to ignore during validation */
  ignorePatterns?: string[];
  /** Skip CLAW validation (for performance) */
  skipClaw?: boolean;
  /** Skip data leak detection */
  skipDataLeaks?: boolean;
  /** Skip destructive command detection */
  skipDestructive?: boolean;
}

// =============================================================================
// Main Validator
// =============================================================================

/**
 * Validate output content before sending.
 *
 * Performs the following checks:
 * 1. CLAW validation via @guardianclaw/core
 * 2. Sensitive data leak detection
 * 3. Destructive command detection
 *
 * @param content - The content to validate
 * @param levelConfig - Current level configuration
 * @param options - Additional validation options
 * @returns Validation result with issues and blocking decision
 */
export async function validateOutput(
  content: string,
  levelConfig: LevelConfig,
  options?: OutputValidationOptions
): Promise<OutputValidationResult> {
  const startTime = Date.now();

  try {
    // Handle empty/invalid content
    if (!content || typeof content !== 'string') {
      const result = createSafeResult(startTime);
      metrics.recordValidation('output', result.durationMs, true, false);
      return result;
    }

    // Apply ignore patterns
    const processedContent = applyIgnorePatterns(content, options?.ignorePatterns);

    // Run CLAW validation (unless skipped)
    const clawResult = options?.skipClaw
      ? createPassingClawResult()
      : runClawValidation(processedContent);

    // Detect issues
    const issues: DetectedIssue[] = [];

    // 1. Add CLAW violations
    addClawViolations(clawResult, issues);

    // 2. Check for data leaks (unless skipped)
    if (!options?.skipDataLeaks) {
      const dataLeakIssues = detectDataLeaks(processedContent);
      issues.push(...dataLeakIssues);
    }

    // 3. Check for destructive commands (unless skipped)
    if (!options?.skipDestructive) {
      const destructiveIssues = detectDestructiveCommands(processedContent);
      issues.push(...destructiveIssues);
    }

    // Convert CLAW result to gate results
    const gates = convertToGateResults(clawResult);

    // Calculate risk level
    const riskLevel = calculateRiskLevel(clawResult, issues);

    // Determine if safe
    const safe = issues.length === 0;

    // Determine if should block based on level config
    const shouldBlock = determineShouldBlock(issues, levelConfig);

    const durationMs = Date.now() - startTime;
    const result: OutputValidationResult = {
      safe,
      shouldBlock,
      issues,
      gates,
      riskLevel,
      durationMs,
    };

    // Record metrics
    metrics.recordValidation('output', durationMs, safe, shouldBlock);
    if (issues.length > 0) {
      metrics.recordIssues(issues);
    }

    // Log result
    logValidation('output', {
      safe,
      blocked: shouldBlock,
      issueCount: issues.length,
      riskLevel,
      durationMs,
    }, {
      contentLength: content.length,
    });

    return result;
  } catch (error) {
    // Log error and return safe result (fail open for output)
    logError('validateOutput', error instanceof Error ? error : String(error), {
      contentLength: content?.length,
    });
    metrics.recordError('validation');

    return createSafeResult(startTime);
  }
}

// =============================================================================
// CLAW Integration
// =============================================================================

/**
 * Run CLAW validation with error handling.
 */
function runClawValidation(content: string): CLAWResult {
  try {
    return validateCLAW(content);
  } catch (error) {
    logger.error('CLAW validation failed', {
      operation: 'runClawValidation',
      error: error instanceof Error ? error : String(error),
    });
    return createPassingClawResult();
  }
}

/**
 * Create a passing CLAW result (for when validation is skipped or fails).
 */
function createPassingClawResult(): CLAWResult {
  const passingGate = { passed: true, violations: [] as string[], score: 0 };
  return {
    overall: true,
    riskLevel: 'low' as const,
    summary: 'Validation skipped or failed',
    credibility: passingGate,
    avoidance: passingGate,
    limits: passingGate,
    worth: passingGate,
  };
}

// =============================================================================
// Issue Detection
// =============================================================================

/**
 * Detect sensitive data leaks in content.
 * Uses both core patterns and registry patterns.
 */
function detectDataLeaks(content: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  try {
    // Check core patterns
    for (const [category, patterns] of Object.entries(SENSITIVE_DATA_PATTERNS)) {
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          issues.push({
            type: 'data_leak',
            description: `Potential ${formatCategory(category)} detected in output`,
            evidence: sanitizeEvidence(match[0]),
            severity: getSeverityForCategory(category),
            gate: 'avoidance',
          });
          break; // One issue per category is enough
        }
      }
    }

    // Check registry patterns
    const sensitiveData = patternRegistry.hasSensitiveData(content);
    if (sensitiveData && !issues.some(i => i.type === 'data_leak')) {
      issues.push({
        type: 'data_leak',
        description: sensitiveData.description ?? 'Sensitive data detected',
        evidence: '[REDACTED]',
        severity: (sensitiveData.severity ?? 'high') as RiskLevel,
        gate: 'avoidance',
      });
    }
  } catch (error) {
    logger.error('Data leak detection failed', {
      operation: 'detectDataLeaks',
      error: error instanceof Error ? error : String(error),
    });
  }

  return issues;
}

/**
 * Detect destructive commands in content.
 * Uses both hardcoded patterns and registry patterns.
 */
function detectDestructiveCommands(content: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  try {
    // Hardcoded destructive command patterns
    const destructivePatterns = [
      { pattern: /\brm\s+-rf\s+\//i, desc: 'Recursive force delete from root' },
      { pattern: /\bsudo\s+rm\s+-rf/i, desc: 'Sudo recursive force delete' },
      { pattern: /\bformat\s+[a-zA-Z]:/i, desc: 'Disk format command' },
      { pattern: /DROP\s+TABLE/i, desc: 'SQL DROP TABLE' },
      { pattern: /DROP\s+DATABASE/i, desc: 'SQL DROP DATABASE' },
      { pattern: /TRUNCATE\s+TABLE/i, desc: 'SQL TRUNCATE TABLE' },
      { pattern: /\bshutdown\s+(-h|\/s|now)/i, desc: 'System shutdown command' },
      { pattern: />\s*\/dev\/sd[a-z]/i, desc: 'Write to disk device' },
      { pattern: /\bmkfs\./i, desc: 'Filesystem format command' },
      { pattern: /\bdd\s+.*\bof=\/dev\//i, desc: 'Direct disk write (dd)' },
      { pattern: /\binit\s+[06]/i, desc: 'System init level change' },
    ];

    for (const { pattern, desc } of destructivePatterns) {
      const match = content.match(pattern);
      if (match) {
        issues.push({
          type: 'destructive_command',
          description: desc,
          evidence: match[0],
          severity: 'high',
          gate: 'avoidance',
        });
      }
    }

    // Check registry patterns
    const dangerousCmd = patternRegistry.hasDangerousCommand(content);
    if (dangerousCmd && !issues.some(i => i.evidence === dangerousCmd.pattern?.toString())) {
      issues.push({
        type: 'destructive_command',
        description: dangerousCmd.description ?? 'Dangerous command detected',
        evidence: '[detected]',
        severity: (dangerousCmd.severity ?? 'high') as RiskLevel,
        gate: 'avoidance',
      });
    }
  } catch (error) {
    logger.error('Destructive command detection failed', {
      operation: 'detectDestructiveCommands',
      error: error instanceof Error ? error : String(error),
    });
  }

  return issues;
}

/**
 * Add violations from CLAW result to issues array.
 */
function addClawViolations(clawResult: CLAWResult, issues: DetectedIssue[]): void {
  try {
    // Jailbreak attempts surface as Credibility (identity deception) or Limits
    // (boundary violation) violations — tagged by the violation-string prefix.
    const jailbreakPrefixes = [
      'Role manipulation',
      'Roleplay manipulation',
      'Instruction override',
      'Prompt extraction',
      'Filter bypass',
      'System injection',
    ];
    const isJailbreakViolation = (v: string): boolean =>
      jailbreakPrefixes.some((p) => v.startsWith(p));

    const gates = [
      { result: clawResult.credibility, name: 'credibility' as const },
      { result: clawResult.avoidance, name: 'avoidance' as const },
      { result: clawResult.limits, name: 'limits' as const },
      { result: clawResult.worth, name: 'worth' as const },
    ];

    for (const { result, name } of gates) {
      if (!result.passed && result.violations.length > 0) {
        for (const violation of result.violations.slice(0, 3)) { // Limit to 3 per gate
          const jailbreak = isJailbreakViolation(violation);
          issues.push({
            type: jailbreak ? 'jailbreak_attempt' : 'unknown',
            description: jailbreak ? 'jailbreak attempt' : `${name} gate violation`,
            evidence: truncateString(violation, 100),
            severity: jailbreak ? 'critical' : 'medium',
            gate: jailbreak ? 'jailbreak' : name,
          });
        }
      }
    }
  } catch (error) {
    logger.error('CLAW violation processing failed', {
      operation: 'addClawViolations',
      error: error instanceof Error ? error : String(error),
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Apply ignore patterns to content.
 * Returns content with ignored sections replaced.
 */
function applyIgnorePatterns(content: string, patterns?: string[]): string {
  if (!patterns || patterns.length === 0) {
    return content;
  }

  let processed = content;
  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'gi');
      processed = processed.replace(regex, '[IGNORED]');
    } catch (error) {
      logger.warn('Invalid ignore pattern', {
        operation: 'applyIgnorePatterns',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return processed;
}

/**
 * Convert CLAW result to simplified gate results.
 */
function convertToGateResults(clawResult: CLAWResult): GateResults {
  // Jailbreak is a cross-gate signal dissolved into Credibility + Limits.
  // We expose a synthetic status that fails if either host gate failed.
  const jailbreakPassed = clawResult.credibility.passed && clawResult.limits.passed;
  return {
    credibility: clawResult.credibility.passed ? 'pass' : 'fail',
    avoidance: clawResult.avoidance.passed ? 'pass' : 'fail',
    limits: clawResult.limits.passed ? 'pass' : 'fail',
    worth: clawResult.worth.passed ? 'pass' : 'fail',
    jailbreak: jailbreakPassed ? 'pass' : 'fail',
  };
}

/**
 * Calculate risk level based on CLAW result and detected issues.
 */
function calculateRiskLevel(clawResult: CLAWResult, issues: DetectedIssue[]): RiskLevel {
  // Use CLAW risk level as base
  const clawRisk = clawResult.riskLevel;

  // Check for critical issues
  const hasCritical = issues.some(i => i.severity === 'critical');
  if (hasCritical || clawRisk === 'critical') {
    return 'critical';
  }

  // Check for high-severity issues
  const hasHigh = issues.some(i => i.severity === 'high');
  if (hasHigh || clawRisk === 'high') {
    return 'high';
  }

  // Check for medium-severity issues
  const hasMedium = issues.some(i => i.severity === 'medium');
  if (hasMedium || clawRisk === 'medium') {
    return 'medium';
  }

  // Check for any issues
  if (issues.length > 0) {
    return 'low';
  }

  return 'none';
}

/**
 * Determine if content should be blocked based on issues and level config.
 */
function determineShouldBlock(issues: DetectedIssue[], levelConfig: LevelConfig): boolean {
  // Never block if blocking is disabled
  if (!hasAnyBlockingEnabled(levelConfig)) {
    return false;
  }

  for (const issue of issues) {
    // Data leaks
    if (issue.type === 'data_leak' && levelConfig.blocking.dataLeaks) {
      return true;
    }

    // Destructive commands
    if (issue.type === 'destructive_command' && levelConfig.blocking.destructiveCommands) {
      return true;
    }

    // Injection compliance (AI following injected instructions)
    if (issue.type === 'injection_compliance' && levelConfig.blocking.injectionCompliance) {
      return true;
    }

    // Jailbreak attempts (always critical)
    if (issue.type === 'jailbreak_attempt' && levelConfig.blocking.injectionCompliance) {
      return true;
    }
  }

  return false;
}

/**
 * Check if any blocking is enabled in level config.
 */
function hasAnyBlockingEnabled(levelConfig: LevelConfig): boolean {
  const { blocking } = levelConfig;
  return (
    blocking.dataLeaks ||
    blocking.destructiveCommands ||
    blocking.systemPaths ||
    blocking.suspiciousUrls ||
    blocking.injectionCompliance
  );
}

/**
 * Create a safe (no issues) result.
 */
function createSafeResult(startTime: number): OutputValidationResult {
  return {
    safe: true,
    shouldBlock: false,
    issues: [],
    gates: {
      credibility: 'pass',
      avoidance: 'pass',
      limits: 'pass',
      worth: 'pass',
      jailbreak: 'pass',
    },
    riskLevel: 'none',
    durationMs: Date.now() - startTime,
  };
}

/**
 * Format category name for display.
 */
function formatCategory(category: string): string {
  return category
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/**
 * Get severity for a sensitive data category.
 */
function getSeverityForCategory(category: string): RiskLevel {
  switch (category) {
    case 'apiKeys':
    case 'passwords':
    case 'privateKeys':
      return 'critical';
    case 'ssn':
    case 'creditCard':
      return 'high';
    case 'email':
    case 'pii':
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Sanitize evidence for display (truncate and redact sensitive parts).
 */
function sanitizeEvidence(evidence: string): string {
  // Truncate long evidence
  const maxLength = 50;
  let sanitized = evidence.length > maxLength
    ? evidence.substring(0, maxLength) + '...'
    : evidence;

  // Redact middle part of potential secrets
  if (sanitized.length > 10) {
    const start = sanitized.substring(0, 4);
    const end = sanitized.substring(sanitized.length - 4);
    sanitized = `${start}****${end}`;
  }

  return sanitized;
}

/**
 * Truncate a string to a maximum length.
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}
