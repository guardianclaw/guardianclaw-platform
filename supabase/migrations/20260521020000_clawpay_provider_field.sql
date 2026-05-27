-- ClawPay Sprint 3 — provider field on clawpay_audit_events.
--
-- Sprint 2 wired the audit pipeline for x402 only. Sprint 3 adds Stripe
-- Agent Toolkit support, so audit rows must distinguish the payment surface
-- that produced them. We add a single column with a CHECK constraint
-- enumerating the supported providers; new providers (e.g. PayPal Agent
-- Pay) will require a new migration that extends the CHECK.
--
-- Why text + CHECK rather than a Postgres enum: the enum needs ALTER TYPE
-- to add values, which Supabase tooling handles awkwardly during automated
-- migrations. text + CHECK keeps each migration self-contained.
--
-- Default for legacy rows: 'x402'. Every row that existed before this
-- migration was inserted by the Coinbase x402 middleware, so backfilling
-- to 'x402' is correct, not a guess.

ALTER TABLE clawpay_audit_events
    ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'x402'
        CHECK (provider IN ('x402', 'stripe'));

COMMENT ON COLUMN clawpay_audit_events.provider IS
    'Payment surface that produced the audit row. ''x402'' = Coinbase HTTP 402 micropayments; ''stripe'' = Stripe Agent Toolkit operations. Default ''x402'' preserves backwards compatibility for rows inserted before Sprint 3 (2026-05-21).';

-- Hot path: "list this wallet's Stripe events, newest first".
CREATE INDEX IF NOT EXISTS clawpay_audit_events_wallet_provider_occurred
    ON clawpay_audit_events (wallet_address, provider, occurred_at DESC);
