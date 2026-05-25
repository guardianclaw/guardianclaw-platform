/**
 * @guardianclaw/stripe-agent-toolkit
 *
 * GuardianClaw safety validation for the Stripe Agent Toolkit. Implements
 * the same CLAW protocol (Credibility-Limits-Avoidance-Worth) as the Python
 * SDK so a TypeScript agent and a Python agent produce indistinguishable
 * audit rows.
 *
 * @packageDocumentation
 *
 * @example Basic usage with the Stripe Agent Toolkit
 * ```typescript
 * import Stripe from "stripe";
 * import { createValidator, StripeIntentKind } from "@guardianclaw/stripe-agent-toolkit";
 *
 * const validator = createValidator("standard");
 * const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
 *
 * const result = validator.validate(
 *   {
 *     intentKind: StripeIntentKind.PAYMENT_INTENT_CREATE,
 *     amount: 4900,
 *     currency: "usd",
 *     customer: "cus_NksY4M0bM4FfXg",
 *     description: "Daily API budget refill for the support agent",
 *     apiKey: process.env.STRIPE_SECRET_KEY,
 *   },
 *   "agent-1",
 * );
 *
 * if (!result.isApproved) {
 *   console.warn("Blocked:", result.blockedReason);
 *   return;
 * }
 *
 * await stripe.paymentIntents.create({
 *   amount: 4900,
 *   currency: "usd",
 *   customer: "cus_NksY4M0bM4FfXg",
 * });
 * ```
 */

export { ClawValidator, createValidator } from "./validator";
export type { ClawValidatorOptions } from "./validator";

export {
  CLAWGate,
  PaymentDecision,
  RiskLevel,
  StripeApiKeyKind,
  StripeIntentKind,
  ZERO_DECIMAL_CURRENCIES,
  DEFAULT_BLOCKED_DESCRIPTION_TERMS,
  SUSPICIOUS_URGENCY_TERMS,
  defaultConfig,
  detectApiKeyKind,
  intentMovesMoney,
  isLiveKey,
  isRestrictedKey,
  isValidAccountId,
  isValidChargeId,
  isValidCustomerId,
  isValidIntentId,
  normalizeAmountUsd,
  stripePaymentInputSchema,
} from "./types";

export type {
  ClawValidatorConfig,
  ConfirmationThresholds,
  GateResult,
  SafetyValidationResult,
  SecurityProfile,
  SpendingLimits,
  StripeAuditFacts,
  StripePaymentInput,
  ValidationConfig,
} from "./types";
