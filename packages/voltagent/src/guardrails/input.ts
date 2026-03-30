/**
 * @guardianclaw/voltagent - Input Guardrail
 *
 * Creates VoltAgent-compatible input guardrails for AI safety validation.
 * Integrates CLAW, OWASP, and PII validators into the VoltAgent guardrail system.
 */

import type {
  GuardianClawGuardrailConfig,
  VoltAgentInputArgs,
  VoltAgentInputResult,
  GuardrailAction,
  FullValidationResult,
  RiskLevel,
} from '../types';
import { validateCLAW, quickCheck } from '../validators/claw';
import { validateOWASP, quickOWASPCheck } from '../validators/owasp';
import { detectPII, redactPII } from '../validators/pii';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_CONFIG: Required<
  Pick<
    GuardianClawGuardrailConfig,
    | 'blockUnsafe'
    | 'logChecks'
    | 'enableCLAW'
    | 'enableOWASP'
    | 'enablePII'
    | 'minBlockLevel'
    | 'maxContentLength'
    | 'timeout'
  >
> = {
  blockUnsafe: true,
  logChecks: false,
  enableCLAW: true,
  enableOWASP: true,
  enablePII: false, // PII detection typically more useful for output
  minBlockLevel: 'medium',
  maxContentLength: 100000,
  timeout: 5000,
};

// =============================================================================
// Input Guardrail Factory
// =============================================================================

/**
 * VoltAgent input guardrail interface.
 * Compatible with VoltAgent's InputGuardrail type.
 */
export interface GuardianClawInputGuardrail {
  /** Guardrail unique identifier */
  id?: string;
  /** Guardrail name */
  name: string;
  /** Guardrail description */
  description?: string;
  /** Optional tags for categorization */
  tags?: string[];
  /** Severity level */
  severity?: 'info' | 'warning' | 'critical';
  /** Additional metadata */
  metadata?: Record<string, unknown>;
  /** Handler function that performs validation */
  handler: (args: VoltAgentInputArgs) => Promise<VoltAgentInputResult>;
}

/**
 * Create a GuardianClaw input guardrail for VoltAgent.
 *
 * @param config - Guardrail configuration
 * @returns VoltAgent-compatible input guardrail
 *
 * @example
 * ```typescript
 * import { Agent } from "@voltagent/core";
 * import { createGuardianClawInputGuardrail } from "@guardianclaw/voltagent";
 *
 * const clawGuard = createGuardianClawInputGuardrail({
 *   enableCLAW: true,
 *   enableOWASP: true,
 *   blockUnsafe: true,
 * });
 *
 * const agent = new Agent({
 *   name: "safe-agent",
 *   inputGuardrails: [clawGuard],
 * });
 * ```
 */
export function createGuardianClawInputGuardrail(
  config: GuardianClawGuardrailConfig = {}
): GuardianClawInputGuardrail {
  // Merge with defaults
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  return {
    name: 'claw-input-guardrail',
    description: 'GuardianClaw AI safety validation: CLAW protocol, OWASP protection, and PII detection',
    tags: ['security', 'safety', 'claw', 'claw', 'owasp'],

    async handler(args: VoltAgentInputArgs): Promise<VoltAgentInputResult> {
      const startTime = Date.now();
      const { inputText } = args;

      // Handle empty or invalid input
      if (!inputText || typeof inputText !== 'string') {
        return createAllowResult('Empty input passed validation');
      }

      // Check content length
      if (inputText.length > mergedConfig.maxContentLength) {
        return createBlockResult(
          'Content exceeds maximum allowed length',
          { maxLength: mergedConfig.maxContentLength, actualLength: inputText.length }
        );
      }

      try {
        // Quick check first (fast path)
        if (mergedConfig.enableCLAW && !quickCheck(inputText)) {
          if (mergedConfig.blockUnsafe) {
            return createBlockResult('Critical safety pattern detected (quick check)');
          }
        }

        if (mergedConfig.enableOWASP && !quickOWASPCheck(inputText)) {
          if (mergedConfig.blockUnsafe) {
            return createBlockResult('Critical security pattern detected (quick check)');
          }
        }

        // Full validation
        const validationResult = await performFullValidation(inputText, mergedConfig);

        // Log if enabled
        if (mergedConfig.logChecks && mergedConfig.logger) {
          mergedConfig.logger('GuardianClaw input validation completed', {
            safe: validationResult.safe,
            action: validationResult.action,
            durationMs: Date.now() - startTime,
          });
        }

        // Determine result based on validation
        if (validationResult.safe) {
          return createAllowResult(validationResult.message, {
            claw: validationResult.metadata,
          });
        }

        // Content is unsafe
        if (mergedConfig.blockUnsafe && shouldBlock(validationResult, mergedConfig.minBlockLevel)) {
          return createBlockResult(validationResult.message, {
            claw: validationResult.metadata,
          });
        }

        // Allow with warning if not blocking
        return createAllowResult(`Warning: ${validationResult.message}`, {
          claw: {
            ...validationResult.metadata,
            warning: true,
          },
        });

      } catch (error) {
        // Handle validation errors
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        if (mergedConfig.logChecks && mergedConfig.logger) {
          mergedConfig.logger('GuardianClaw validation error', { error: errorMessage });
        }

        // Fail open or closed based on config
        if (mergedConfig.blockUnsafe) {
          return createBlockResult(`Validation error: ${errorMessage}`);
        }

        return createAllowResult('Validation skipped due to error', {
          claw: { error: errorMessage },
        });
      }
    },
  };
}

// =============================================================================
// Validation Logic
// =============================================================================

/**
 * Perform full validation using all enabled validators.
 */
async function performFullValidation(
  content: string,
  config: GuardianClawGuardrailConfig
): Promise<FullValidationResult> {
  const startTime = Date.now();
  const validatorsRun: string[] = [];
  let overallSafe = true;
  const concerns: string[] = [];

  // CLAW Validation
  let clawResult;
  if (config.enableCLAW) {
    validatorsRun.push('claw');
    clawResult = validateCLAW(content, undefined, config.customPatterns);

    if (!clawResult.safe) {
      overallSafe = false;
      concerns.push(...clawResult.concerns);
    }
  }

  // OWASP Validation
  let owaspResult;
  if (config.enableOWASP) {
    validatorsRun.push('owasp');
    owaspResult = validateOWASP(content, config.owaspChecks, config.customOWASPPatterns);

    if (!owaspResult.safe) {
      overallSafe = false;
      concerns.push(...owaspResult.findings.map((f) => `[OWASP] ${f.description}`));
    }
  }

  // PII Detection
  let piiResult;
  if (config.enablePII) {
    validatorsRun.push('pii');
    piiResult = detectPII(content, config.piiTypes, config.customPIIPatterns);

    if (piiResult.detected) {
      concerns.push(`[PII] ${piiResult.count} PII instance(s) detected: ${piiResult.types.join(', ')}`);
      // PII detection alone doesn't make content unsafe, but should be noted
    }
  }

  // Determine action and message
  const action: GuardrailAction = overallSafe ? 'allow' : 'block';
  const message = overallSafe
    ? 'Content passed all safety checks'
    : `Safety concerns detected: ${concerns.slice(0, 3).join('; ')}${concerns.length > 3 ? '...' : ''}`;

  // Calculate overall risk level
  const riskLevel = calculateOverallRisk(clawResult, owaspResult);

  return {
    safe: overallSafe,
    action,
    message,
    claw: clawResult,
    owasp: owaspResult,
    pii: piiResult,
    metadata: {
      timestamp: Date.now(),
      durationMs: Date.now() - startTime,
      validatorsRun,
      config: {
        enableCLAW: config.enableCLAW,
        enableOWASP: config.enableOWASP,
        enablePII: config.enablePII,
        blockUnsafe: config.blockUnsafe,
      } as GuardianClawGuardrailConfig,
    },
  };
}

/**
 * Calculate overall risk level from validation results.
 */
function calculateOverallRisk(
  clawResult?: { riskLevel: RiskLevel },
  owaspResult?: { riskLevel: RiskLevel }
): RiskLevel {
  const levels: RiskLevel[] = [];

  if (clawResult) {
    levels.push(clawResult.riskLevel);
  }
  if (owaspResult) {
    levels.push(owaspResult.riskLevel);
  }

  // Return highest risk level
  const priority: RiskLevel[] = ['critical', 'high', 'medium', 'low'];
  for (const level of priority) {
    if (levels.includes(level)) {
      return level;
    }
  }

  return 'low';
}

/**
 * Determine if content should be blocked based on risk level.
 * Uses the highest risk level from all validators.
 */
function shouldBlock(result: FullValidationResult, minLevel: RiskLevel): boolean {
  const levelPriority: Record<RiskLevel, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  };

  // Get the highest risk level from all validators
  const clawLevel = result.claw?.riskLevel ?? 'low';
  const owaspLevel = result.owasp?.riskLevel ?? 'low';

  const highestLevel = levelPriority[clawLevel] > levelPriority[owaspLevel] ? clawLevel : owaspLevel;

  return levelPriority[highestLevel] >= levelPriority[minLevel];
}

// =============================================================================
// Result Helpers
// =============================================================================

/**
 * Create an allow result.
 */
function createAllowResult(
  message: string,
  metadata?: Record<string, unknown>
): VoltAgentInputResult {
  return {
    pass: true,
    action: 'allow',
    message,
    metadata,
  };
}

/**
 * Create a block result.
 */
function createBlockResult(
  message: string,
  metadata?: Record<string, unknown>
): VoltAgentInputResult {
  return {
    pass: false,
    action: 'block',
    message,
    metadata,
  };
}

// =============================================================================
// Additional Exports
// =============================================================================

/**
 * Create a strict input guardrail (all validations, block on any issue).
 */
export function createStrictInputGuardrail(): GuardianClawInputGuardrail {
  return createGuardianClawInputGuardrail({
    blockUnsafe: true,
    enableCLAW: true,
    enableOWASP: true,
    enablePII: true,
    minBlockLevel: 'low',
  });
}

/**
 * Create a permissive input guardrail (log only, don't block).
 */
export function createPermissiveInputGuardrail(
  logger?: (message: string, data?: Record<string, unknown>) => void
): GuardianClawInputGuardrail {
  return createGuardianClawInputGuardrail({
    blockUnsafe: false,
    enableCLAW: true,
    enableOWASP: true,
    enablePII: false,
    logChecks: true,
    logger,
  });
}

/**
 * Create a CLAW-only input guardrail.
 */
export function createCLAWOnlyGuardrail(): GuardianClawInputGuardrail {
  return createGuardianClawInputGuardrail({
    enableCLAW: true,
    enableOWASP: false,
    enablePII: false,
  });
}

/**
 * Create an OWASP-only input guardrail.
 */
export function createOWASPOnlyGuardrail(): GuardianClawInputGuardrail {
  return createGuardianClawInputGuardrail({
    enableCLAW: false,
    enableOWASP: true,
    enablePII: false,
  });
}
