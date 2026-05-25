# Changelog

All notable changes to `@guardianclaw/stripe-agent-toolkit` will be
documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] – 2026-05-21 (initial release, ClawPay Sprint 3)

### Added

- First public release of the GuardianClaw Stripe Agent Toolkit safety layer.
- `ClawValidator` and `createValidator` factory implementing the four CLAW
  gates (Credibility · Limits · Avoidance · Worth) for Stripe payments.
- `StripePaymentInput` Zod schema covering Payment Intents, Charges,
  Transfers, Refunds, Payment Links, Subscriptions, Invoices and Customers.
- Currency normalization helper (`normalizeAmountUsd`) supporting
  zero-decimal currencies and a coarse fallback FX table for amounts that
  arrive without a `amountUsdHint`.
- Four security profiles (`permissive` / `standard` / `strict` / `paranoid`)
  matching the Python SDK presets.
- Vitest test suite covering type detection, currency conversion, ID
  validation, gate behavior, risk-level computation and decision logic.
- Sibling Python package: `guardianclaw.integrations.stripe` ships the
  matching middleware so an agent built in either runtime produces the same
  audit shape on the dashboard.
