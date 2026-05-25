/**
 * GuardianClaw validator for the Stripe Agent Toolkit.
 *
 * Mirrors the Python `StripeCLAWValidator` so an agent process can validate
 * Stripe operations from either runtime with identical outcomes.
 *
 * The TypeScript build deliberately does NOT import the Stripe SDK directly —
 * Stripe Agent Toolkit lives behind an optional peerDependency. The validator
 * takes a plain `StripePaymentInput` so any caller (raw fetch, agent toolkit,
 * AgentCore) can pipe its outgoing payload through here before signing.
 */

import {
  CLAWGate,
  ClawValidatorConfig,
  GateResult,
  PaymentDecision,
  RiskLevel,
  SafetyValidationResult,
  StripeAuditFacts,
  StripeApiKeyKind,
  StripeIntentKind,
  StripePaymentInput,
  SUSPICIOUS_URGENCY_TERMS,
  defaultConfig,
  detectApiKeyKind,
  intentMovesMoney,
  isLiveKey,
  isRestrictedKey,
  isValidAccountId,
  isValidCustomerId,
  normalizeAmountUsd,
  stripePaymentInputSchema,
} from "./types";

const ISO_4217_RE = /^[a-z]{3}$/;

interface ValidationContext {
  dailyTotalUsd: number;
  dailyTransactionCount: number;
  hourlyTransactionCount: number;
  customerHistory: Set<string>;
  destinationHistory: Set<string>;
}

const EMPTY_CONTEXT: ValidationContext = {
  dailyTotalUsd: 0,
  dailyTransactionCount: 0,
  hourlyTransactionCount: 0,
  customerHistory: new Set(),
  destinationHistory: new Set(),
};

export interface ClawValidatorOptions {
  config?: ClawValidatorConfig;
  /**
   * Returns the per-wallet rolling context. The validator never tracks
   * spending itself in TypeScript — the host is expected to wire this up
   * (the Python SDK has the analogous in-process tracker).
   */
  getContext?: (walletAddress: string) => ValidationContext | undefined;
}

// ============================================================================
// Main class
// ============================================================================

export class ClawValidator {
  private readonly config: ClawValidatorConfig;
  private readonly getContext: (walletAddress: string) => ValidationContext;

  constructor(options: ClawValidatorOptions = {}) {
    this.config = options.config ?? defaultConfig("standard");
    this.getContext = options.getContext
      ? (wallet) => options.getContext!(wallet) ?? EMPTY_CONTEXT
      : () => EMPTY_CONTEXT;
  }

  validate(rawInput: StripePaymentInput, walletAddress: string): SafetyValidationResult {
    // Parse-or-default the input so caller-supplied loose objects still
    // produce a deterministic shape.
    const parsed = stripePaymentInputSchema.safeParse(rawInput);
    const input: StripePaymentInput = parsed.success ? parsed.data : { ...rawInput, description: rawInput.description ?? "" };

    const context = this.getContext(walletAddress);

    const credibility = this.evaluateCredibility(input);
    const avoidance = this.evaluateAvoidance(input);
    const limits = this.evaluateLimits(input, context);
    const worth = this.evaluateWorth(input, context);

    const gates: Record<CLAWGate, GateResult> = {
      [CLAWGate.CREDIBILITY]: credibility,
      [CLAWGate.AVOIDANCE]: avoidance,
      [CLAWGate.LIMITS]: limits,
      [CLAWGate.WORTH]: worth,
    };

    const riskLevel = this.calculateRisk(gates, input);
    const decision = this.decideOutcome(riskLevel, input);

    return this.buildResult({ decision, riskLevel, gates, input });
  }

  // -------------------------------------------------------------------
  // Gate implementations
  // -------------------------------------------------------------------

  private evaluateCredibility(input: StripePaymentInput): GateResult {
    const issues: string[] = [];
    const kind = detectApiKeyKind(input.apiKey);

    if (input.apiKey) {
      if (this.config.validation.requireRestrictedApiKey && !isRestrictedKey(kind)) {
        issues.push(
          `API key kind '${kind}' is not a restricted key (rk_*); agents should use restricted keys with scoped permissions.`,
        );
      }
      if (this.config.validation.sandboxOnly && isLiveKey(kind)) {
        issues.push("API key targets live mode but sandbox_only is enforced.");
      }
    }

    if (intentMovesMoney(input.intentKind)) {
      const currency = input.currency?.toLowerCase();
      if (!currency) {
        issues.push("Missing currency for a money-moving Stripe call.");
      } else if (!ISO_4217_RE.test(currency)) {
        issues.push(`Currency '${currency}' is not a valid ISO-4217 code.`);
      } else if (
        this.config.validation.allowedCurrencies.length > 0 &&
        !this.config.validation.allowedCurrencies
          .map((c) => c.toLowerCase())
          .includes(currency)
      ) {
        issues.push(
          `Currency '${currency}' is not in the allowed list (${this.config.validation.allowedCurrencies.join(
            ", ",
          )}).`,
        );
      }

      if (input.amount === undefined || input.amount === null) {
        issues.push("Missing amount for a money-moving Stripe call.");
      } else if (input.amount <= 0) {
        issues.push("Amount must be positive for a money-moving call.");
      }
    }

    if (input.customer !== undefined && !isValidCustomerId(input.customer)) {
      issues.push(`Customer ID '${input.customer}' is malformed (expected cus_*).`);
    }

    if (input.destination !== undefined && !isValidAccountId(input.destination)) {
      issues.push(`Destination '${input.destination}' is malformed (expected acct_*).`);
    }

    if (input.idempotencyKey !== undefined) {
      if (input.idempotencyKey.length === 0 || input.idempotencyKey.length > 255) {
        issues.push("Idempotency key must be 1–255 characters.");
      }
    }

    return {
      gate: CLAWGate.CREDIBILITY,
      passed: issues.length === 0,
      reason: issues.length === 0 ? null : issues.join("; "),
      details:
        issues.length === 0
          ? null
          : { issues, api_key_kind: kind as StripeApiKeyKind },
    };
  }

  private evaluateAvoidance(input: StripePaymentInput): GateResult {
    const issues: string[] = [];
    const riskFactors: string[] = [];

    if (input.customer && this.config.blockedCustomers.includes(input.customer)) {
      issues.push(`Customer '${input.customer}' is on the blocklist.`);
    }
    if (input.destination && this.config.blockedDestinations.includes(input.destination)) {
      issues.push(`Destination '${input.destination}' is on the blocklist.`);
    }

    const description = (input.description ?? "").toLowerCase();
    for (const term of this.config.blockedDescriptionTerms) {
      if (description.includes(term.toLowerCase())) {
        issues.push(`Description contains blocked term: '${term}'.`);
      }
    }

    for (const term of SUSPICIOUS_URGENCY_TERMS) {
      if (description.includes(term)) {
        riskFactors.push(`Description uses urgency phrasing: '${term}'.`);
        break;
      }
    }

    const details: Record<string, unknown> = {};
    if (issues.length > 0) details.issues = issues;
    if (riskFactors.length > 0) details.risk_factors = riskFactors;

    return {
      gate: CLAWGate.AVOIDANCE,
      passed: issues.length === 0,
      reason: issues.length === 0 ? null : issues.join("; "),
      details: Object.keys(details).length > 0 ? details : null,
    };
  }

  private evaluateLimits(
    input: StripePaymentInput,
    context: ValidationContext,
  ): GateResult {
    if (!this.config.validation.enableSpendingLimits) {
      return {
        gate: CLAWGate.LIMITS,
        passed: true,
        reason: null,
        details: { note: "Spending limits disabled." },
      };
    }
    if (!intentMovesMoney(input.intentKind)) {
      return {
        gate: CLAWGate.LIMITS,
        passed: true,
        reason: null,
        details: null,
      };
    }

    const issues: string[] = [];
    const warnings: string[] = [];
    const limits = this.config.spendingLimits;

    const amountUsd =
      input.amount !== undefined && input.amount !== null && input.currency
        ? normalizeAmountUsd(input.amount, input.currency, input.amountUsdHint)
        : 0;

    if (amountUsd > limits.maxSinglePayment) {
      issues.push(
        `Amount $${amountUsd.toFixed(2)} exceeds single payment limit $${limits.maxSinglePayment.toFixed(2)}.`,
      );
    }

    const projectedDaily = context.dailyTotalUsd + amountUsd;
    if (projectedDaily > limits.maxDailyTotal) {
      issues.push(
        `Payment would exceed daily limit: $${projectedDaily.toFixed(2)} > $${limits.maxDailyTotal.toFixed(2)}.`,
      );
    }
    if (context.dailyTransactionCount >= limits.maxTransactionsPerDay) {
      issues.push(
        `Daily transaction limit reached: ${context.dailyTransactionCount}.`,
      );
    } else if (
      context.dailyTransactionCount >= Math.floor(limits.maxTransactionsPerDay * 0.8)
    ) {
      warnings.push("Approaching daily transaction limit.");
    }
    if (this.config.validation.enableRateLimiting) {
      if (context.hourlyTransactionCount >= limits.maxTransactionsPerHour) {
        issues.push(
          `Hourly rate limit exceeded: ${context.hourlyTransactionCount} transactions.`,
        );
      } else if (
        context.hourlyTransactionCount >= Math.floor(limits.maxTransactionsPerHour * 0.8)
      ) {
        warnings.push("Approaching hourly rate limit.");
      }
    }

    return {
      gate: CLAWGate.LIMITS,
      passed: issues.length === 0,
      reason: issues.length === 0 ? null : issues.join("; "),
      details: {
        amount_usd: amountUsd,
        issues,
        warnings,
        limits: {
          max_single: limits.maxSinglePayment,
          max_daily: limits.maxDailyTotal,
        },
      },
    };
  }

  private evaluateWorth(
    input: StripePaymentInput,
    context: ValidationContext,
  ): GateResult {
    const MIN_DESC_LENGTH = 20;
    const MIN_DESC_WORDS = 3;

    const concerns: string[] = [];
    const flags: string[] = [];

    let isKnownCustomer = false;
    let isKnownDestination = false;
    if (input.customer && context.customerHistory.has(input.customer)) {
      isKnownCustomer = true;
    }
    if (input.destination && context.destinationHistory.has(input.destination)) {
      isKnownDestination = true;
    }

    if (input.customer && !isKnownCustomer) {
      flags.push("First payment to this customer.");
      if (!this.config.validation.allowUnknownCustomers) {
        concerns.push("Payment to unknown customer.");
      }
    }
    if (input.destination && !isKnownDestination) {
      flags.push("First payment to this destination account.");
      if (!this.config.validation.allowUnknownDestinations) {
        concerns.push("Payment to unknown destination.");
      }
    }

    const description = (input.description ?? "").trim();
    if (intentMovesMoney(input.intentKind)) {
      if (description.length < MIN_DESC_LENGTH) {
        concerns.push(
          `Description is too short (${description.length} chars; need ≥ ${MIN_DESC_LENGTH}) to justify a money-moving call.`,
        );
      } else {
        const wordCount = description.split(/\s+/).filter((w) => w.length > 0).length;
        if (wordCount < MIN_DESC_WORDS) {
          concerns.push(
            `Description has too few words (${wordCount}; need ≥ ${MIN_DESC_WORDS}); state the purpose explicitly.`,
          );
        }
      }
    }

    if (this.config.validation.strictMode) {
      concerns.push(...flags);
      flags.length = 0;
    }

    return {
      gate: CLAWGate.WORTH,
      passed: concerns.length === 0,
      reason: concerns.length === 0 ? null : concerns.join("; "),
      details: {
        concerns,
        flags,
        is_known_customer: isKnownCustomer,
        is_known_destination: isKnownDestination,
      },
    };
  }

  // -------------------------------------------------------------------
  // Decisioning
  // -------------------------------------------------------------------

  private calculateRisk(
    gates: Record<CLAWGate, GateResult>,
    input: StripePaymentInput,
  ): RiskLevel {
    const failed = Object.values(gates).filter((g) => !g.passed);
    if (gates[CLAWGate.AVOIDANCE] && !gates[CLAWGate.AVOIDANCE].passed) {
      return RiskLevel.BLOCKED;
    }
    if (failed.length >= 2) return RiskLevel.CRITICAL;
    if (failed.length === 1) return RiskLevel.HIGH;

    const hasWarnings = Object.values(gates).some((g) => {
      const d = g.details;
      if (!d) return false;
      const w = (d.warnings as unknown[] | undefined)?.length ?? 0;
      const f = (d.flags as unknown[] | undefined)?.length ?? 0;
      const rf = (d.risk_factors as unknown[] | undefined)?.length ?? 0;
      return w + f + rf > 0;
    });

    if (intentMovesMoney(input.intentKind)) {
      const amountUsd =
        input.amount !== undefined && input.amount !== null && input.currency
          ? normalizeAmountUsd(input.amount, input.currency, input.amountUsdHint)
          : 0;
      if (amountUsd > this.config.confirmation.amountThreshold) {
        return RiskLevel.CAUTION;
      }
    }
    return hasWarnings ? RiskLevel.CAUTION : RiskLevel.SAFE;
  }

  private decideOutcome(riskLevel: RiskLevel, input: StripePaymentInput): PaymentDecision {
    if (riskLevel === RiskLevel.BLOCKED) return PaymentDecision.BLOCK;
    if (riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.HIGH) {
      return PaymentDecision.REJECT;
    }
    if (riskLevel === RiskLevel.CAUTION && intentMovesMoney(input.intentKind)) {
      return PaymentDecision.REQUIRE_CONFIRMATION;
    }
    return PaymentDecision.APPROVE;
  }

  // -------------------------------------------------------------------
  // Result assembly
  // -------------------------------------------------------------------

  private buildResult({
    decision,
    riskLevel,
    gates,
    input,
  }: {
    decision: PaymentDecision;
    riskLevel: RiskLevel;
    gates: Record<CLAWGate, GateResult>;
    input: StripePaymentInput;
  }): SafetyValidationResult {
    const issues: string[] = [];
    for (const gate of Object.values(gates)) {
      if (!gate.passed && gate.reason) {
        issues.push(`[${gate.gate}] ${gate.reason}`);
      }
    }

    const recommendations: string[] = [];
    let blockedReason: string | null = null;
    if (decision === PaymentDecision.BLOCK) {
      blockedReason = gates[CLAWGate.AVOIDANCE].reason ?? issues.join("; ");
    }
    if (decision === PaymentDecision.REJECT || decision === PaymentDecision.BLOCK) {
      recommendations.push(
        "Inspect the audit log for the specific gate failure before retrying.",
      );
    }

    const amountUsd =
      input.amount !== undefined && input.amount !== null && input.currency
        ? normalizeAmountUsd(input.amount, input.currency, input.amountUsdHint)
        : null;

    const facts: StripeAuditFacts = {
      intentKind: input.intentKind,
      amountUsd,
      currency: input.currency?.toLowerCase() ?? null,
      customer: input.customer ?? null,
      destination: input.destination ?? null,
      description: input.description ?? "",
      apiKeyKind: detectApiKeyKind(input.apiKey),
      idempotencyKey: input.idempotencyKey ?? null,
      referenceId: input.referenceId ?? null,
    };

    const requiresConfirmation = decision === PaymentDecision.REQUIRE_CONFIRMATION;

    return {
      decision,
      riskLevel,
      gates,
      facts,
      issues,
      recommendations,
      requiresConfirmation,
      blockedReason,
      get isApproved(): boolean {
        return (
          decision === PaymentDecision.APPROVE ||
          decision === PaymentDecision.REQUIRE_CONFIRMATION
        );
      },
      get allGatesPassed(): boolean {
        return Object.values(gates).every((g) => g.passed);
      },
    };
  }
}

/** Factory shortcut for the most common case. */
export function createValidator(profile: "permissive" | "standard" | "strict" | "paranoid" = "standard"): ClawValidator {
  return new ClawValidator({ config: defaultConfig(profile) });
}
