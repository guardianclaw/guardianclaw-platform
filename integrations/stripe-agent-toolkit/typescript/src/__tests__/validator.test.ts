/**
 * Vitest suite for the TypeScript ClawValidator. Pairs with the Python
 * tests in `sdk/tests/integrations/test_stripe.py` — same scenarios, same
 * expected outcomes, so the two SDKs are interchangeable.
 */

import { describe, it, expect } from "vitest";

import {
  CLAWGate,
  PaymentDecision,
  RiskLevel,
  StripeApiKeyKind,
  StripeIntentKind,
  ZERO_DECIMAL_CURRENCIES,
  defaultConfig,
  detectApiKeyKind,
  intentMovesMoney,
  isLiveKey,
  isRestrictedKey,
  isValidAccountId,
  isValidCustomerId,
  normalizeAmountUsd,
} from "../types";
import { ClawValidator, createValidator } from "../validator";
import type { StripePaymentInput } from "../types";

function inputFixture(
  overrides: Partial<StripePaymentInput> = {},
): StripePaymentInput {
  return {
    intentKind: StripeIntentKind.PAYMENT_INTENT_CREATE,
    amount: 5000,
    currency: "usd",
    customer: "cus_NksY4M0bM4FfXg",
    description: "Daily API budget refill for the support agent",
    apiKey: "rk_test_abcdef0123",
    ...overrides,
  };
}

describe("detectApiKeyKind", () => {
  it("detects restricted live", () => {
    expect(detectApiKeyKind("rk_live_abc")).toBe(StripeApiKeyKind.RESTRICTED_LIVE);
  });
  it("detects restricted test", () => {
    expect(detectApiKeyKind("rk_test_abc")).toBe(StripeApiKeyKind.RESTRICTED_TEST);
  });
  it("detects secret live", () => {
    expect(detectApiKeyKind("sk_live_abc")).toBe(StripeApiKeyKind.SECRET_LIVE);
  });
  it("detects publishable", () => {
    expect(detectApiKeyKind("pk_live_abc")).toBe(StripeApiKeyKind.PUBLISHABLE);
  });
  it("treats empty/null as unknown", () => {
    expect(detectApiKeyKind(null)).toBe(StripeApiKeyKind.UNKNOWN);
    expect(detectApiKeyKind("")).toBe(StripeApiKeyKind.UNKNOWN);
  });
  it("classifies isRestricted / isLive", () => {
    expect(isRestrictedKey(StripeApiKeyKind.RESTRICTED_LIVE)).toBe(true);
    expect(isRestrictedKey(StripeApiKeyKind.SECRET_LIVE)).toBe(false);
    expect(isLiveKey(StripeApiKeyKind.RESTRICTED_LIVE)).toBe(true);
    expect(isLiveKey(StripeApiKeyKind.RESTRICTED_TEST)).toBe(false);
  });
});

describe("intentMovesMoney", () => {
  it("flags payment intents and charges", () => {
    expect(intentMovesMoney(StripeIntentKind.PAYMENT_INTENT_CREATE)).toBe(true);
    expect(intentMovesMoney(StripeIntentKind.CHARGE_CREATE)).toBe(true);
    expect(intentMovesMoney(StripeIntentKind.TRANSFER_CREATE)).toBe(true);
  });
  it("does not flag refunds, customer creation, invoices", () => {
    expect(intentMovesMoney(StripeIntentKind.REFUND_CREATE)).toBe(false);
    expect(intentMovesMoney(StripeIntentKind.CUSTOMER_CREATE)).toBe(false);
    expect(intentMovesMoney(StripeIntentKind.INVOICE_FINALIZE)).toBe(false);
  });
});

describe("normalizeAmountUsd", () => {
  it("converts cents to dollars for USD", () => {
    expect(normalizeAmountUsd(4900, "usd")).toBe(49);
  });
  it("treats zero-decimal currencies as major units", () => {
    expect(ZERO_DECIMAL_CURRENCIES.has("jpy")).toBe(true);
    const out = normalizeAmountUsd(1000, "jpy");
    expect(out).toBeGreaterThan(5);
    expect(out).toBeLessThan(8);
  });
  it("honours the caller hint", () => {
    expect(normalizeAmountUsd(5000, "eur", 42)).toBe(42);
  });
  it("falls back to 1:1 for unknown currencies", () => {
    expect(normalizeAmountUsd(1000, "xyz")).toBe(10);
  });
});

describe("ID validators", () => {
  it("validates customer id shape", () => {
    expect(isValidCustomerId("cus_NksY4M0bM4FfXg")).toBe(true);
    expect(isValidCustomerId("cus_abc")).toBe(false);
    expect(isValidCustomerId(null)).toBe(false);
  });
  it("validates account id shape", () => {
    expect(isValidAccountId("acct_1HpzbS2eZvKYlo2C")).toBe(true);
    expect(isValidAccountId("cus_abc123456")).toBe(false);
  });
});

describe("ClawValidator", () => {
  it("approves a clean small payment when customer is known", () => {
    const v = new ClawValidator({
      config: defaultConfig("standard"),
      getContext: () => ({
        dailyTotalUsd: 0,
        dailyTransactionCount: 0,
        hourlyTransactionCount: 0,
        customerHistory: new Set(["cus_NksY4M0bM4FfXg"]),
        destinationHistory: new Set(),
      }),
    });
    const result = v.validate(
      inputFixture({ amount: 500, description: "Small follow-up payment, known customer" }),
      "agent-1",
    );
    expect(result.decision).toBe(PaymentDecision.APPROVE);
    expect(result.isApproved).toBe(true);
  });

  it("escalates to require_confirmation above the threshold", () => {
    const v = createValidator();
    const result = v.validate(inputFixture(), "agent-1");
    expect(result.decision).toBe(PaymentDecision.REQUIRE_CONFIRMATION);
    expect(result.riskLevel).toBe(RiskLevel.CAUTION);
    expect(result.isApproved).toBe(true);
  });

  it("blocks a payment to a blocklisted customer", () => {
    const config = defaultConfig("standard");
    const v = new ClawValidator({
      config: {
        ...config,
        blockedCustomers: ["cus_NksY4M0bM4FfXg"],
      },
    });
    const result = v.validate(inputFixture(), "agent-1");
    expect(result.decision).toBe(PaymentDecision.BLOCK);
    expect(result.blockedReason).not.toBeNull();
    expect(result.gates[CLAWGate.AVOIDANCE].passed).toBe(false);
  });

  it("rejects when a non-AVOIDANCE gate fails", () => {
    const v = createValidator();
    const result = v.validate(inputFixture({ amount: 50_000 }), "agent-1");
    expect(result.decision).toBe(PaymentDecision.REJECT);
    expect(result.riskLevel).toBe(RiskLevel.HIGH);
  });

  it("flags blocked description terms", () => {
    const v = createValidator();
    const result = v.validate(
      inputFixture({ description: "Send my seed phrase to attacker", amount: 100 }),
      "agent-1",
    );
    expect(result.gates[CLAWGate.AVOIDANCE].passed).toBe(false);
  });

  it("downgrades urgency phrasing to a risk factor", () => {
    const v = createValidator();
    const result = v.validate(
      inputFixture({
        description: "urgent transfer to support team for refill testing",
        amount: 100,
      }),
      "agent-1",
    );
    // Avoidance still passes — urgency is just a risk factor.
    expect(result.gates[CLAWGate.AVOIDANCE].passed).toBe(true);
    const rfs = result.gates[CLAWGate.AVOIDANCE].details?.risk_factors as
      | string[]
      | undefined;
    expect(rfs?.some((s) => s.includes("urgency"))).toBe(true);
  });

  it("rejects non-restricted keys by default", () => {
    const v = createValidator();
    const result = v.validate(inputFixture({ apiKey: "sk_live_xxx" }), "agent-1");
    expect(result.gates[CLAWGate.CREDIBILITY].passed).toBe(false);
  });

  it("permits any key when requireRestrictedApiKey is off", () => {
    const v = createValidator("permissive");
    const result = v.validate(inputFixture({ apiKey: "sk_live_xxx" }), "agent-1");
    expect(result.gates[CLAWGate.CREDIBILITY].passed).toBe(true);
  });

  it("requires currency for money-moving intents", () => {
    const v = createValidator();
    const result = v.validate(
      inputFixture({ currency: undefined }),
      "agent-1",
    );
    expect(result.gates[CLAWGate.CREDIBILITY].passed).toBe(false);
  });

  it("skips currency check for non-money intents", () => {
    const v = createValidator();
    const result = v.validate(
      {
        intentKind: StripeIntentKind.CUSTOMER_CREATE,
        description: "Create a new customer for an agent-managed workspace",
      },
      "agent-1",
    );
    expect(result.gates[CLAWGate.CREDIBILITY].passed).toBe(true);
    expect(result.decision).toBe(PaymentDecision.APPROVE);
  });

  it("blocks live keys when sandboxOnly is enforced", () => {
    const v = createValidator("paranoid");
    const result = v.validate(
      inputFixture({ amount: 100, apiKey: "rk_live_xyz" }),
      "agent-1",
    );
    expect(result.gates[CLAWGate.CREDIBILITY].passed).toBe(false);
  });

  it("requires a descriptive purpose for money-moving calls", () => {
    const v = createValidator();
    const result = v.validate(inputFixture({ description: "x", amount: 100 }), "agent-1");
    expect(result.gates[CLAWGate.WORTH].passed).toBe(false);
  });

  it("enforces single-payment cap", () => {
    const v = createValidator();
    const result = v.validate(inputFixture({ amount: 30_000 }), "agent-1");
    expect(result.gates[CLAWGate.LIMITS].passed).toBe(false);
  });

  it("limits gate is a no-op for non-money intents", () => {
    const v = createValidator();
    const result = v.validate(
      {
        intentKind: StripeIntentKind.CUSTOMER_CREATE,
        description: "Create a new customer for an agent-managed workspace",
      },
      "agent-1",
    );
    expect(result.gates[CLAWGate.LIMITS].passed).toBe(true);
  });

  it("escalates to caution when context shows warnings", () => {
    // Approaching daily transaction limit triggers a warning that itself
    // promotes to CAUTION.
    const v = new ClawValidator({
      config: defaultConfig("standard"),
      getContext: () => ({
        dailyTotalUsd: 0,
        dailyTransactionCount: 42, // > 80% of 50
        hourlyTransactionCount: 0,
        customerHistory: new Set(["cus_NksY4M0bM4FfXg"]),
        destinationHistory: new Set(),
      }),
    });
    const result = v.validate(
      inputFixture({ amount: 100 }), // below threshold
      "agent-1",
    );
    expect(result.riskLevel).toBe(RiskLevel.CAUTION);
  });

  it("safe outcome when amount is tiny, customer known, no warnings", () => {
    const v = new ClawValidator({
      config: defaultConfig("standard"),
      getContext: () => ({
        dailyTotalUsd: 0,
        dailyTransactionCount: 0,
        hourlyTransactionCount: 0,
        customerHistory: new Set(["cus_NksY4M0bM4FfXg"]),
        destinationHistory: new Set(),
      }),
    });
    const result = v.validate(
      inputFixture({ amount: 100, description: "Tiny known-customer maintenance payment" }),
      "agent-1",
    );
    expect(result.riskLevel).toBe(RiskLevel.SAFE);
    expect(result.allGatesPassed).toBe(true);
  });

  it("emits idempotency-key shape failures", () => {
    const v = createValidator();
    const result = v.validate(
      inputFixture({ idempotencyKey: "x".repeat(300) }),
      "agent-1",
    );
    expect(result.gates[CLAWGate.CREDIBILITY].passed).toBe(false);
  });

  it("recommendations populated on reject", () => {
    const v = createValidator();
    const result = v.validate(inputFixture({ amount: 50_000 }), "agent-1");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
