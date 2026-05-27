# @guardianclaw/stripe-agent-toolkit

GuardianClaw safety validation for the [Stripe Agent Toolkit](https://docs.stripe.com/agents).
TypeScript counterpart of the Python `guardianclaw.integrations.stripe`
module — same four CLAW gates (Credibility · Limits · Avoidance · Worth),
same audit shape, same risk vocabulary. Use whichever runtime fits your
agent.

## Why

The Stripe Agent Toolkit lets an AI agent call `paymentIntents.create`,
`refunds.create`, `transfers.create`, and more via function-calling. That is
extremely powerful and extremely easy to misuse — a prompt-injected agent can
move money on the user's behalf before anyone reviews it. This package is the
decision firewall that sits between the agent's outgoing payload and the
Stripe SDK.

## Install

```bash
npm install @guardianclaw/stripe-agent-toolkit
# or
pnpm add @guardianclaw/stripe-agent-toolkit
```

`@stripe/agent-toolkit` is an **optional** peer dependency — the validator
operates on a plain `StripePaymentInput` object, so any caller can use it
even without the toolkit installed.

## Quick start

```typescript
import Stripe from "stripe";
import {
  createValidator,
  StripeIntentKind,
} from "@guardianclaw/stripe-agent-toolkit";

const validator = createValidator("standard");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const result = validator.validate(
  {
    intentKind: StripeIntentKind.PAYMENT_INTENT_CREATE,
    amount: 4900,
    currency: "usd",
    customer: "cus_NksY4M0bM4FfXg",
    description: "Daily API budget refill for the support agent",
    apiKey: process.env.STRIPE_SECRET_KEY,
  },
  "agent-1", // wallet / agent identifier
);

if (!result.isApproved) {
  console.warn("ClawPay blocked:", result.blockedReason);
  return;
}

if (result.requiresConfirmation) {
  // Surface result.facts + result.gates to the human reviewer.
}

await stripe.paymentIntents.create({
  amount: 4900,
  currency: "usd",
  customer: "cus_NksY4M0bM4FfXg",
});
```

## What gets validated

| Gate | Checks |
|------|--------|
| **Credibility** | API key prefix (`rk_*` recommended), ISO-4217 currency, positive amount, `cus_*`/`acct_*` ID shape, idempotency-key length. |
| **Avoidance** | Static blocklists, suspicious description terms (`seed phrase`, `drain wallet`, …), urgency markers as risk factors. Drainer-intel lookup is wired on the Python side via the shared `DrainerLookup`; the TypeScript build keeps that hook as a future extension. |
| **Limits** | Single-payment USD cap + rolling daily / hourly counts. The caller supplies the rolling context via `getContext` — the validator never tracks spending itself. |
| **Worth** | Description ≥ 20 chars with at least 3 words for money-moving intents; flags first-time customers/destinations. Strict mode promotes flags to blocks. |

## Configuration profiles

| Profile | Single cap | Daily cap | Strict mode |
|---------|-----------|-----------|-------------|
| `permissive` | $1,000 | $5,000 | no |
| `standard` (default) | $100 | $500 | no |
| `strict` | $25 | $100 | yes |
| `paranoid` | $5 | $20 | yes, sandbox-only |

```typescript
import { ClawValidator, defaultConfig } from "@guardianclaw/stripe-agent-toolkit";

const config = {
  ...defaultConfig("standard"),
  blockedCustomers: ["cus_BAD0001", "cus_BAD0002"],
  spendingLimits: { ...defaultConfig("standard").spendingLimits, maxSinglePayment: 75 },
};
const validator = new ClawValidator({ config });
```

## License

MIT. Part of [GuardianClaw](https://guardianclaw.org).
