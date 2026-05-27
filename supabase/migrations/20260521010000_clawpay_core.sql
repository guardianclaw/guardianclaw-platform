-- ClawPay Sprint 2.A — core schema: spending_limits + audit_events + alerts
-- + alert_deliveries.
--
-- Three resources backing the ClawPay dashboard and SDK:
--
--   1. clawpay_spending_limits    — per-agent (and/or per-wallet) configurable
--                                   USD caps for a defined time window. Used
--                                   by LimitsGateValidator at validation time
--                                   and surfaced as CRUD in the dashboard.
--   2. clawpay_audit_events       — immutable log of every payment validation
--                                   decision (CLAW gates outcome + any drainer
--                                   intel hits). Powers the audit log viewer
--                                   and the trigger-evaluation engine for
--                                   alerts.
--   3. clawpay_alerts             — per-wallet alert rules (e.g. "POST this
--                                   URL whenever a payment is blocked at
--                                   severity ≥ high"). Notification target is
--                                   a webhook URL, validated by the handler
--                                   via SSRF guard at write time.
--   4. clawpay_alert_deliveries   — append-only delivery log so the dashboard
--                                   can show "last delivery succeeded/failed
--                                   at <time>" without re-driving webhooks.
--
-- RLS strategy: JWT-claims (Frente B.1 pattern; mirrors mig 20260427100000).
-- All four tables are wallet-scoped; ownership flows through wallet_address
-- on the row directly (denormalized vs. JOIN through agents) to keep audit
-- queries cheap. Defense-in-depth: API handlers also pass `.eq('wallet_address',
-- wallet)` explicitly per the route conventions.

-- ============================================================================
-- 1. Enums
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE clawpay_period AS ENUM (
        'hourly', 'daily', 'weekly', 'monthly', 'lifetime'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE clawpay_event_kind AS ENUM (
        'payment_approved',
        'payment_blocked',
        'payment_confirmation_required',
        'payment_failed'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE clawpay_risk_level AS ENUM (
        'safe', 'caution', 'high', 'critical', 'blocked'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE clawpay_alert_status AS ENUM (
        'pending', 'delivered', 'failed', 'skipped'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. clawpay_spending_limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS clawpay_spending_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_address text NOT NULL,

    -- NULL agent_id means the limit applies to all payments under this wallet
    -- (catch-all). When set, the limit narrows to one agent.
    agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,

    name text NOT NULL,
    period clawpay_period NOT NULL,

    -- USD-equivalent cap. We normalize across stablecoins (USDC/USDT) and
    -- chains at validation time so this single field is the source of truth.
    limit_usd numeric(18, 6) NOT NULL CHECK (limit_usd > 0),

    active boolean NOT NULL DEFAULT true,
    description text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- One active limit per (wallet, agent, name, period) — prevents accidental
-- duplicate rules. The dashboard CRUD reuses (name, period) for the slot
-- identity; users update an existing limit instead of stacking duplicates.
-- agent_id NULL maps to '' for dedup (treat catch-all as a stable slot).
CREATE UNIQUE INDEX IF NOT EXISTS clawpay_spending_limits_slot_unique
    ON clawpay_spending_limits (
        wallet_address,
        COALESCE(agent_id::text, ''),
        name,
        period
    )
    WHERE active;

-- Hot path: validator looks up "give me all active limits for this wallet
-- (optionally narrowed to an agent)".
CREATE INDEX IF NOT EXISTS clawpay_spending_limits_wallet_active
    ON clawpay_spending_limits (wallet_address, agent_id)
    WHERE active;

COMMENT ON TABLE clawpay_spending_limits IS
    'ClawPay per-agent/per-wallet USD spending caps (Sprint 2). Active rows are queried by LimitsGateValidator at payment-validation time. The handler enforces unique slots via the active-only unique index.';
COMMENT ON COLUMN clawpay_spending_limits.agent_id IS
    'NULL = catch-all limit covering every payment from this wallet. Non-NULL = limit applies only to the named agent.';
COMMENT ON COLUMN clawpay_spending_limits.period IS
    'Rolling window for the cap. The validator subtracts now() - interval(period) and sums approved payments in that window against limit_usd.';

-- ============================================================================
-- 3. clawpay_audit_events
-- ============================================================================
--
-- Append-only. Updates are NOT expected; we never rewrite a decision.

CREATE TABLE IF NOT EXISTS clawpay_audit_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_address text NOT NULL,

    -- NULL when the SDK is invoked standalone (no Cloudflare agent record).
    agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,

    event_kind clawpay_event_kind NOT NULL,

    -- Payment-side facts (denormalized snapshot — the source x402 request may
    -- be gone by the time someone audits this row).
    endpoint text,
    network text,
    asset text,
    pay_to text,
    amount_usd numeric(18, 6),

    -- Outcome.
    decision text NOT NULL,            -- approve | require_confirmation | reject | block
    risk_level clawpay_risk_level NOT NULL,

    -- Structured per-gate results. Shape:
    --   { "credibility": { "passed": true, "reason": null, "details": {...} },
    --     "avoidance":   { "passed": false, "reason": "...",  "details": {...} },
    --     ... }
    gates jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Each hit produced by DrainerLookup.consult() / match_endpoint_patterns().
    -- Format follows DrainerMatch.to_audit_dict() in
    -- sdk/.../coinbase/x402/drainer_db.py (kind, value, severity, source,
    -- source_ref, network, notes, scope).
    drainer_intel jsonb NOT NULL DEFAULT '[]'::jsonb,

    -- Free-form human-readable summary. The L4 ClawObserver result lives here
    -- when observation ran.
    reasoning text,

    -- Filled when the agent actually broadcast the transaction (post-decision).
    tx_signature text,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- occurred_at = the moment the validation decision was made (set by the
    -- SDK clock). created_at = the moment the row landed in Supabase. These
    -- can differ when audit ingestion is batched or retried.
    occurred_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Common dashboard queries: "list this wallet's events, newest first" and
-- "filter by event_kind / occurred_at range / agent_id".
CREATE INDEX IF NOT EXISTS clawpay_audit_events_wallet_occurred
    ON clawpay_audit_events (wallet_address, occurred_at DESC);

CREATE INDEX IF NOT EXISTS clawpay_audit_events_wallet_kind_occurred
    ON clawpay_audit_events (wallet_address, event_kind, occurred_at DESC);

CREATE INDEX IF NOT EXISTS clawpay_audit_events_agent_occurred
    ON clawpay_audit_events (agent_id, occurred_at DESC)
    WHERE agent_id IS NOT NULL;

-- For the alert evaluation engine: "are there blocked events in the last N
-- minutes for this wallet?". Partial index keeps the working set small.
CREATE INDEX IF NOT EXISTS clawpay_audit_events_blocked_recent
    ON clawpay_audit_events (wallet_address, occurred_at DESC)
    WHERE event_kind = 'payment_blocked';

COMMENT ON TABLE clawpay_audit_events IS
    'Append-only log of every ClawPay payment validation outcome (Sprint 2). One row per validate_payment() call. Powers the dashboard audit viewer and the alert trigger engine.';
COMMENT ON COLUMN clawpay_audit_events.occurred_at IS
    'SDK-clock timestamp of the validation decision. May differ from created_at when audit ingestion is batched.';

-- ============================================================================
-- 4. clawpay_alerts
-- ============================================================================

CREATE TABLE IF NOT EXISTS clawpay_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_address text NOT NULL,

    -- NULL = alert evaluated against every event for the wallet.
    agent_id uuid REFERENCES agents(id) ON DELETE CASCADE,

    name text NOT NULL,
    description text,

    -- Trigger condition as structured JSON. Shape examples:
    --   { "kind": "blocked_value_above", "amount_usd": 100, "window_minutes": 60 }
    --   { "kind": "blocked_count_above", "count": 5, "window_minutes": 15 }
    --   { "kind": "drainer_hit", "severity_min": "high" }
    -- The evaluator (apps/api or Modal cron) interprets this; the schema only
    -- guarantees it's a JSON object.
    condition jsonb NOT NULL CHECK (jsonb_typeof(condition) = 'object'),

    -- Webhook URL. SSRF-validated by the handler before insert/update.
    notification_target text NOT NULL CHECK (notification_target ~ '^https?://'),

    -- Optional per-alert HMAC secret (hash, not plaintext). When set, the
    -- delivery includes X-Webhook-Signature: hex(HMAC-SHA256(secret, body)).
    -- Plaintext secret is generated server-side and returned once on create.
    -- The hash stored here is what we keep; rotation creates a new row in the
    -- delivery history.
    notification_secret_hash text,

    active boolean NOT NULL DEFAULT true,

    -- Throttle: don't fire the same alert more than once per cooldown window.
    cooldown_seconds integer NOT NULL DEFAULT 60 CHECK (cooldown_seconds >= 0),

    last_triggered_at timestamptz,
    trigger_count integer NOT NULL DEFAULT 0,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS clawpay_alerts_wallet_name_unique
    ON clawpay_alerts (wallet_address, name);

CREATE INDEX IF NOT EXISTS clawpay_alerts_wallet_active
    ON clawpay_alerts (wallet_address)
    WHERE active;

COMMENT ON TABLE clawpay_alerts IS
    'ClawPay alert rules (Sprint 2). Conditions are evaluated against clawpay_audit_events by the alert engine; matches produce a clawpay_alert_deliveries row. notification_target must be an http(s) URL validated by SSRF guard at write time.';
COMMENT ON COLUMN clawpay_alerts.condition IS
    'Structured rule. Examples: {kind: "blocked_value_above", amount_usd, window_minutes} | {kind: "blocked_count_above", count, window_minutes} | {kind: "drainer_hit", severity_min}.';
COMMENT ON COLUMN clawpay_alerts.cooldown_seconds IS
    'Minimum seconds between successive deliveries of the same alert. Prevents alert storms.';

-- ============================================================================
-- 5. clawpay_alert_deliveries
-- ============================================================================
--
-- Append-only. One row per attempted delivery (success or fail).

CREATE TABLE IF NOT EXISTS clawpay_alert_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    alert_id uuid NOT NULL REFERENCES clawpay_alerts(id) ON DELETE CASCADE,

    -- The audit event that triggered this delivery. NULL for test/manual
    -- deliveries (the /alerts/:id/test endpoint).
    audit_event_id uuid REFERENCES clawpay_audit_events(id) ON DELETE SET NULL,

    -- Denormalized from clawpay_alerts.wallet_address so RLS can scope without
    -- a JOIN.
    wallet_address text NOT NULL,

    status clawpay_alert_status NOT NULL DEFAULT 'pending',

    -- The HTTP details of the delivery attempt.
    http_status integer,
    response_body_snippet text,        -- truncated; full body never stored
    error text,

    attempt integer NOT NULL DEFAULT 1 CHECK (attempt > 0),

    delivered_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clawpay_alert_deliveries_alert_created
    ON clawpay_alert_deliveries (alert_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clawpay_alert_deliveries_wallet_created
    ON clawpay_alert_deliveries (wallet_address, created_at DESC);

COMMENT ON TABLE clawpay_alert_deliveries IS
    'Append-only log of webhook delivery attempts for ClawPay alerts. Captures HTTP outcome (status + truncated body snippet) without storing full webhook responses, so a misbehaving listener cannot fill the table with adversarial payloads.';

-- ============================================================================
-- 6. updated_at triggers (shared function)
-- ============================================================================

CREATE OR REPLACE FUNCTION clawpay_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clawpay_spending_limits_updated_at_trg ON clawpay_spending_limits;
CREATE TRIGGER clawpay_spending_limits_updated_at_trg
    BEFORE UPDATE ON clawpay_spending_limits
    FOR EACH ROW EXECUTE FUNCTION clawpay_set_updated_at();

DROP TRIGGER IF EXISTS clawpay_alerts_updated_at_trg ON clawpay_alerts;
CREATE TRIGGER clawpay_alerts_updated_at_trg
    BEFORE UPDATE ON clawpay_alerts
    FOR EACH ROW EXECUTE FUNCTION clawpay_set_updated_at();

-- (audit_events and alert_deliveries are append-only — no updated_at needed.)

-- ============================================================================
-- 7. RLS — JWT-claims policies (Frente B.1 pattern)
-- ============================================================================
--
-- jwt_wallet_address() is defined in mig 20260427000000. service_role bypasses
-- RLS automatically, which is how the ingester / alert engine can still write
-- cross-tenant.

ALTER TABLE clawpay_spending_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_audit_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_alerts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_alert_deliveries ENABLE ROW LEVEL SECURITY;

-- --- clawpay_spending_limits — full CRUD by wallet owner ---

DROP POLICY IF EXISTS clawpay_spending_limits_select_jwt ON clawpay_spending_limits;
CREATE POLICY clawpay_spending_limits_select_jwt ON clawpay_spending_limits
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_spending_limits_insert_jwt ON clawpay_spending_limits;
CREATE POLICY clawpay_spending_limits_insert_jwt ON clawpay_spending_limits
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_spending_limits_update_jwt ON clawpay_spending_limits;
CREATE POLICY clawpay_spending_limits_update_jwt ON clawpay_spending_limits
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_spending_limits_delete_jwt ON clawpay_spending_limits;
CREATE POLICY clawpay_spending_limits_delete_jwt ON clawpay_spending_limits
    FOR DELETE
    USING (wallet_address = jwt_wallet_address());

-- --- clawpay_audit_events — SELECT only (writes via service_role / SDK) ---
-- Tenants read their own audit but cannot rewrite history. Inserts come from
-- the audit sink (SDK or Modal job) running with service_role.

DROP POLICY IF EXISTS clawpay_audit_events_select_jwt ON clawpay_audit_events;
CREATE POLICY clawpay_audit_events_select_jwt ON clawpay_audit_events
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- --- clawpay_alerts — full CRUD by wallet owner ---

DROP POLICY IF EXISTS clawpay_alerts_select_jwt ON clawpay_alerts;
CREATE POLICY clawpay_alerts_select_jwt ON clawpay_alerts
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_alerts_insert_jwt ON clawpay_alerts;
CREATE POLICY clawpay_alerts_insert_jwt ON clawpay_alerts
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_alerts_update_jwt ON clawpay_alerts;
CREATE POLICY clawpay_alerts_update_jwt ON clawpay_alerts
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_alerts_delete_jwt ON clawpay_alerts;
CREATE POLICY clawpay_alerts_delete_jwt ON clawpay_alerts
    FOR DELETE
    USING (wallet_address = jwt_wallet_address());

-- --- clawpay_alert_deliveries — SELECT only (writes via alert engine) ---

DROP POLICY IF EXISTS clawpay_alert_deliveries_select_jwt ON clawpay_alert_deliveries;
CREATE POLICY clawpay_alert_deliveries_select_jwt ON clawpay_alert_deliveries
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());
