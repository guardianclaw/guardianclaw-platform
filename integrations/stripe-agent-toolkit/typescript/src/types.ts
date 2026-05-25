/**
 * Type definitions for @guardianclaw/stripe-agent-toolkit.
 *
 * Mirror of the Python `guardianclaw.integrations.stripe.types` module —
 * keep the two shapes in sync so the audit row a TS agent emits is
 * indistinguishable from one emitted by the Python SDK.
 */

import { z } from "zod";

// ============================================================================
// Risk + decision vocabularies
// ============================================================================

export enum RiskLevel {
  SAFE = "safe",
  CAUTION = "caution",
  HIGH = "high",
  CRITICAL = "critical",
  BLOCKED = "blocked",
}

export enum CLAWGate {
  CREDIBILITY = "credibility",
  LIMITS = "limits",
  AVOIDANCE = "avoidance",
  WORTH = "worth",
}

export enum PaymentDecision {
  APPROVE = "approve",
  REQUIRE_CONFIRMATION = "require_confirmation",
  REJECT = "reject",
  BLOCK = "block",
}

// ============================================================================
// Stripe-specific enums
// ============================================================================

export enum StripeApiKeyKind {
  RESTRICTED_LIVE = "restricted_live",
  RESTRICTED_TEST = "restricted_test",
  SECRET_LIVE = "secret_live",
  SECRET_TEST = "secret_test",
  PUBLISHABLE = "publishable",
  UNKNOWN = "unknown",
}

export function detectApiKeyKind(key: string | null | undefined): StripeApiKeyKind {
  if (!key) return StripeApiKeyKind.UNKNOWN;
  if (key.startsWith("rk_live_")) return StripeApiKeyKind.RESTRICTED_LIVE;
  if (key.startsWith("rk_test_")) return StripeApiKeyKind.RESTRICTED_TEST;
  if (key.startsWith("sk_live_")) return StripeApiKeyKind.SECRET_LIVE;
  if (key.startsWith("sk_test_")) return StripeApiKeyKind.SECRET_TEST;
  if (key.startsWith("pk_")) return StripeApiKeyKind.PUBLISHABLE;
  return StripeApiKeyKind.UNKNOWN;
}

export function isRestrictedKey(kind: StripeApiKeyKind): boolean {
  return (
    kind === StripeApiKeyKind.RESTRICTED_LIVE ||
    kind === StripeApiKeyKind.RESTRICTED_TEST
  );
}

export function isLiveKey(kind: StripeApiKeyKind): boolean {
  return (
    kind === StripeApiKeyKind.RESTRICTED_LIVE ||
    kind === StripeApiKeyKind.SECRET_LIVE
  );
}

export enum StripeIntentKind {
  PAYMENT_INTENT_CREATE = "payment_intent.create",
  PAYMENT_INTENT_CONFIRM = "payment_intent.confirm",
  CHARGE_CREATE = "charge.create",
  REFUND_CREATE = "refund.create",
  PAYMENT_LINK_CREATE = "payment_link.create",
  INVOICE_FINALIZE = "invoice.finalize",
  SUBSCRIPTION_CREATE = "subscription.create",
  TRANSFER_CREATE = "transfer.create",
  CUSTOMER_CREATE = "customer.create",
  UNKNOWN = "unknown",
}

const MONEY_MOVING: ReadonlySet<StripeIntentKind> = new Set([
  StripeIntentKind.PAYMENT_INTENT_CREATE,
  StripeIntentKind.PAYMENT_INTENT_CONFIRM,
  StripeIntentKind.CHARGE_CREATE,
  StripeIntentKind.TRANSFER_CREATE,
]);

export function intentMovesMoney(kind: StripeIntentKind): boolean {
  return MONEY_MOVING.has(kind);
}

// ============================================================================
// Currency normalization
// ============================================================================

/**
 * Stripe currencies whose `amount` field is already in the major unit
 * (no /100 conversion). See https://stripe.com/docs/currencies#zero-decimal.
 */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "ugx",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

/**
 * Coarse fallback FX rates against USD. Used only when the caller does not
 * supply `amountUsdHint`; real production code should pass `amountUsdHint`
 * derived from its own FX source. Numbers chosen mid-May 2026.
 */
const FALLBACK_USD_RATES: Record<string, number> = {
  usd: 1.0,
  eur: 1.08,
  gbp: 1.27,
  cad: 0.74,
  aud: 0.66,
  chf: 1.1,
  sek: 0.094,
  nok: 0.092,
  dkk: 0.144,
  jpy: 0.0065,
  krw: 0.00072,
  vnd: 0.00004,
  twd: 0.031,
  hkd: 0.128,
  sgd: 0.74,
  inr: 0.012,
  brl: 0.2,
  mxn: 0.058,
};

/**
 * Convert a Stripe `amount` in its smallest currency unit to USD-equivalent.
 *
 * @param amount Stripe `amount` (integer; cents for most currencies, major
 *               unit for zero-decimal currencies like JPY).
 * @param currency ISO-4217 alpha-3 currency code (case-insensitive).
 * @param amountUsdHint Caller-supplied USD amount. When provided, the
 *                      function returns it verbatim and skips FX lookup.
 */
export function normalizeAmountUsd(
  amount: number,
  currency: string,
  amountUsdHint?: number,
): number {
  if (amountUsdHint !== undefined && amountUsdHint !== null) {
    return amountUsdHint;
  }
  const lower = currency.toLowerCase();
  const base = ZERO_DECIMAL_CURRENCIES.has(lower) ? amount : amount / 100;
  const rate = FALLBACK_USD_RATES[lower] ?? 1.0;
  return base * rate;
}

// ============================================================================
// ID validators
// ============================================================================

export function isValidCustomerId(value: string | null | undefined): boolean {
  return typeof value === "string" && /^cus_[A-Za-z0-9]{6,}$/.test(value);
}

export function isValidAccountId(value: string | null | undefined): boolean {
  return typeof value === "string" && /^acct_[A-Za-z0-9]{6,}$/.test(value);
}

export function isValidIntentId(value: string | null | undefined): boolean {
  return typeof value === "string" && /^pi_[A-Za-z0-9]{6,}$/.test(value);
}

export function isValidChargeId(value: string | null | undefined): boolean {
  return typeof value === "string" && /^ch_[A-Za-z0-9]{6,}$/.test(value);
}

// ============================================================================
// Wire shape
// ============================================================================

export const stripePaymentInputSchema = z.object({
  intentKind: z
    .nativeEnum(StripeIntentKind)
    .default(StripeIntentKind.UNKNOWN),
  amount: z.number().int().nonnegative().optional(),
  currency: z.string().min(3).max(3).optional(),
  amountUsdHint: z.number().optional(),
  customer: z.string().optional(),
  paymentMethod: z.string().optional(),
  destination: z.string().optional(),
  description: z.string().default(""),
  metadata: z.record(z.unknown()).optional(),
  idempotencyKey: z.string().optional(),
  referenceId: z.string().optional(),
  /**
   * API key the caller intends to use. Treated as sensitive — the validator
   * only inspects the prefix and never stores the full value.
   */
  apiKey: z.string().optional(),
});

export type StripePaymentInput = z.infer<typeof stripePaymentInputSchema>;

// ============================================================================
// Gate result + final validation result
// ============================================================================

export interface GateResult {
  gate: CLAWGate;
  passed: boolean;
  reason: string | null;
  details: Record<string, unknown> | null;
}

export interface StripeAuditFacts {
  intentKind: string;
  amountUsd: number | null;
  currency: string | null;
  customer: string | null;
  destination: string | null;
  description: string;
  apiKeyKind: string;
  idempotencyKey: string | null;
  referenceId: string | null;
}

export interface SafetyValidationResult {
  decision: PaymentDecision;
  riskLevel: RiskLevel;
  gates: Record<CLAWGate, GateResult>;
  facts: StripeAuditFacts;
  issues: string[];
  recommendations: string[];
  requiresConfirmation: boolean;
  blockedReason: string | null;
  /** Convenience getter — true for APPROVE and REQUIRE_CONFIRMATION. */
  isApproved: boolean;
  /** True only when every gate.passed === true. */
  allGatesPassed: boolean;
}

// ============================================================================
// Config
// ============================================================================

export interface SpendingLimits {
  maxSinglePayment: number;
  maxDailyTotal: number;
  maxWeeklyTotal: number;
  maxMonthlyTotal: number;
  maxTransactionsPerDay: number;
  maxTransactionsPerHour: number;
}

export interface ConfirmationThresholds {
  amountThreshold: number;
  unknownCustomerThreshold: number;
  newDestinationThreshold: number;
  highRiskThreshold: number;
}

export interface ValidationConfig {
  strictMode: boolean;
  requireRestrictedApiKey: boolean;
  sandboxOnly: boolean;
  allowedCurrencies: string[];
  allowUnknownCustomers: boolean;
  allowUnknownDestinations: boolean;
  enableSpendingLimits: boolean;
  enableRateLimiting: boolean;
  auditAllPayments: boolean;
}

export interface ClawValidatorConfig {
  spendingLimits: SpendingLimits;
  confirmation: ConfirmationThresholds;
  validation: ValidationConfig;
  blockedCustomers: ReadonlyArray<string>;
  blockedDestinations: ReadonlyArray<string>;
  blockedDescriptionTerms: ReadonlyArray<string>;
}

export const DEFAULT_BLOCKED_DESCRIPTION_TERMS: ReadonlyArray<string> = [
  "private key",
  "seed phrase",
  "mnemonic",
  "drain wallet",
  "transfer all funds",
  "send all balance",
  "empty account",
];

export const SUSPICIOUS_URGENCY_TERMS: ReadonlyArray<string> = [
  "urgent",
  "immediately",
  "right now",
  "asap",
  "verify now",
  "act fast",
];

export type SecurityProfile = "permissive" | "standard" | "strict" | "paranoid";

export function defaultConfig(
  profile: SecurityProfile = "standard",
): ClawValidatorConfig {
  const base: ClawValidatorConfig = {
    spendingLimits: {
      maxSinglePayment: 100,
      maxDailyTotal: 500,
      maxWeeklyTotal: 2_000,
      maxMonthlyTotal: 5_000,
      maxTransactionsPerDay: 50,
      maxTransactionsPerHour: 10,
    },
    confirmation: {
      amountThreshold: 10,
      unknownCustomerThreshold: 5,
      newDestinationThreshold: 5,
      highRiskThreshold: 1,
    },
    validation: {
      strictMode: false,
      requireRestrictedApiKey: true,
      sandboxOnly: false,
      allowedCurrencies: [],
      allowUnknownCustomers: true,
      allowUnknownDestinations: true,
      enableSpendingLimits: true,
      enableRateLimiting: true,
      auditAllPayments: true,
    },
    blockedCustomers: [],
    blockedDestinations: [],
    blockedDescriptionTerms: DEFAULT_BLOCKED_DESCRIPTION_TERMS,
  };

  if (profile === "permissive") {
    return {
      ...base,
      spendingLimits: {
        maxSinglePayment: 1_000,
        maxDailyTotal: 5_000,
        maxWeeklyTotal: 25_000,
        maxMonthlyTotal: 100_000,
        maxTransactionsPerDay: 200,
        maxTransactionsPerHour: 50,
      },
      validation: {
        ...base.validation,
        requireRestrictedApiKey: false,
      },
    };
  }
  if (profile === "strict") {
    return {
      ...base,
      spendingLimits: {
        maxSinglePayment: 25,
        maxDailyTotal: 100,
        maxWeeklyTotal: 500,
        maxMonthlyTotal: 1_000,
        maxTransactionsPerDay: 10,
        maxTransactionsPerHour: 3,
      },
      confirmation: {
        amountThreshold: 2,
        unknownCustomerThreshold: 1,
        newDestinationThreshold: 1,
        highRiskThreshold: 0.5,
      },
      validation: {
        ...base.validation,
        strictMode: true,
        allowUnknownCustomers: false,
        allowUnknownDestinations: false,
      },
    };
  }
  if (profile === "paranoid") {
    return {
      ...base,
      spendingLimits: {
        maxSinglePayment: 5,
        maxDailyTotal: 20,
        maxWeeklyTotal: 100,
        maxMonthlyTotal: 200,
        maxTransactionsPerDay: 5,
        maxTransactionsPerHour: 1,
      },
      confirmation: {
        amountThreshold: 0.5,
        unknownCustomerThreshold: 0.25,
        newDestinationThreshold: 0.25,
        highRiskThreshold: 0.1,
      },
      validation: {
        ...base.validation,
        strictMode: true,
        sandboxOnly: true,
        allowUnknownCustomers: false,
        allowUnknownDestinations: false,
      },
    };
  }
  return base;
}
