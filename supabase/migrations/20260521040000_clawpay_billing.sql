-- ClawPay Sprint 5 — outcome-based billing schema.
--
-- The model: every wallet (tenant) optionally has a billing_accounts row
-- that ties it to a Stripe Customer. At the end of each billing period
-- (typically calendar month) we aggregate the events in clawpay_audit_events
-- and produce a clawpay_billing_periods row plus one
-- clawpay_billing_usage_records row per blocked event. The period row holds
-- the subtotal numbers that feed a Stripe Invoice; the usage_records table
-- is the append-only audit trail showing exactly which blocked event
-- contributed to which fee — needed both for dispute review and for the
-- "we only charge when we save you money" pitch on the landing page.
--
-- We deliberately keep the Stripe-side state (customer_id, subscription_id,
-- invoice_id) as plain text fields. The dashboard reads them; the API
-- service does the writes through the Stripe SDK. There is no foreign-key
-- guarantee that those IDs exist — Stripe owns that source of truth.
--
-- Plans are stored as an enum so the dashboard can render them
-- consistently and so the aggregation service has a stable identifier
-- to look up subscription fees. Plan pricing itself lives in code
-- (apps/api), not in the DB, so it can be A/B tested without a migration.

-- ============================================================================
-- 1. Enums
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE clawpay_billing_plan AS ENUM ('free', 'starter', 'pro', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE clawpay_billing_account_status AS ENUM ('active', 'paused', 'closed');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE clawpay_billing_period_status AS ENUM ('open', 'closed', 'invoiced', 'paid', 'failed', 'void');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. clawpay_billing_accounts
-- ============================================================================
--
-- One row per tenant. wallet_address is both PK and the JWT claim used by
-- RLS — keeps the table self-scoped without an extra column.

CREATE TABLE IF NOT EXISTS clawpay_billing_accounts (
    wallet_address text PRIMARY KEY,

    -- Stripe-side identifiers. NULL until the tenant connects a payment
    -- method via /clawpay/billing/setup; the aggregation service can still
    -- close periods for an account without a Stripe customer (the invoice
    -- step is the only path that needs the IDs).
    stripe_customer_id text,
    stripe_subscription_id text,

    plan clawpay_billing_plan NOT NULL DEFAULT 'free',

    -- Per-tenant fee in basis points. Default 50 = 0.5%. Operators can
    -- override per enterprise contract (config table would be overkill for
    -- the number of enterprise deals we expect in Year 1).
    fee_bps integer NOT NULL DEFAULT 50 CHECK (fee_bps >= 0 AND fee_bps <= 10000),

    -- Monthly subscription fee in USD (e.g. $99 for Pro). Stored on the
    -- account so a custom enterprise deal can override it without forcing
    -- the aggregation service to special-case anything.
    subscription_fee_usd numeric(18, 6) NOT NULL DEFAULT 0
        CHECK (subscription_fee_usd >= 0),

    status clawpay_billing_account_status NOT NULL DEFAULT 'active',

    -- Free-form metadata. Useful for enterprise notes / SLA tier / etc.
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clawpay_billing_accounts_status
    ON clawpay_billing_accounts (status)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS clawpay_billing_accounts_stripe_customer
    ON clawpay_billing_accounts (stripe_customer_id)
    WHERE stripe_customer_id IS NOT NULL;

COMMENT ON TABLE clawpay_billing_accounts IS
    'ClawPay tenant billing config (Sprint 5). One row per wallet; the wallet_address column is the FK used by RLS. The Stripe IDs are mirrored copies, not the source of truth.';
COMMENT ON COLUMN clawpay_billing_accounts.fee_bps IS
    'Per-tenant outcome fee in basis points. Default 50 = 0.5% of blocked USD.';

-- ============================================================================
-- 3. clawpay_billing_periods
-- ============================================================================
--
-- One row per (wallet, period). The aggregation service creates it lazy —
-- the first time we close a period for a wallet, or the dashboard requests
-- "current period preview", whichever happens first.

CREATE TABLE IF NOT EXISTS clawpay_billing_periods (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_address text NOT NULL,

    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    CHECK (period_end > period_start),

    status clawpay_billing_period_status NOT NULL DEFAULT 'open',

    -- Aggregated dollar values. Populated by the close step; remain at 0
    -- while status = 'open'. We persist all three so the dashboard can
    -- show a clean breakdown without re-running the SUM query.
    blocked_value_usd numeric(18, 6) NOT NULL DEFAULT 0
        CHECK (blocked_value_usd >= 0),
    usage_fee_usd numeric(18, 6) NOT NULL DEFAULT 0
        CHECK (usage_fee_usd >= 0),
    subscription_fee_usd numeric(18, 6) NOT NULL DEFAULT 0
        CHECK (subscription_fee_usd >= 0),
    total_usd numeric(18, 6) NOT NULL DEFAULT 0
        CHECK (total_usd >= 0),

    -- Number of events that contributed to this period. Useful for the
    -- dashboard ("we blocked 12 payments worth $X this month") and as a
    -- sanity check vs the usage_records row count.
    blocked_event_count integer NOT NULL DEFAULT 0
        CHECK (blocked_event_count >= 0),

    -- Snapshot of the fee_bps and subscription_fee that produced these
    -- numbers. If the operator changes their plan mid-period, the audit
    -- trail still shows what they were billed at.
    fee_bps_snapshot integer NOT NULL DEFAULT 50,
    plan_snapshot clawpay_billing_plan NOT NULL DEFAULT 'free',

    -- Stripe identifiers — set only after the invoicing step succeeds.
    stripe_invoice_id text,
    stripe_invoice_url text,

    closed_at timestamptz,
    invoiced_at timestamptz,
    paid_at timestamptz,
    failed_at timestamptz,
    failure_reason text,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- One open (or closed-but-not-failed) period per (wallet, period_start).
-- We allow 'failed' rows to coexist so a failed Stripe attempt doesn't
-- prevent a retry with a new row. The partial filter means re-opening a
-- failed attempt is a matter of inserting a fresh row.
CREATE UNIQUE INDEX IF NOT EXISTS clawpay_billing_periods_wallet_start_unique
    ON clawpay_billing_periods (wallet_address, period_start)
    WHERE status NOT IN ('failed', 'void');

-- Hot paths.
CREATE INDEX IF NOT EXISTS clawpay_billing_periods_wallet_status_period
    ON clawpay_billing_periods (wallet_address, status, period_start DESC);

CREATE INDEX IF NOT EXISTS clawpay_billing_periods_status_only
    ON clawpay_billing_periods (status)
    WHERE status IN ('open', 'closed');

CREATE INDEX IF NOT EXISTS clawpay_billing_periods_stripe_invoice
    ON clawpay_billing_periods (stripe_invoice_id)
    WHERE stripe_invoice_id IS NOT NULL;

COMMENT ON TABLE clawpay_billing_periods IS
    'One row per (wallet, billing period). status transitions: open -> closed -> invoiced -> paid|failed. A failed row stays for audit; the retry creates a new row with status=open.';
COMMENT ON COLUMN clawpay_billing_periods.fee_bps_snapshot IS
    'Snapshot of the account.fee_bps at close time, so historical periods reflect what the operator was actually charged at.';

-- ============================================================================
-- 4. clawpay_billing_usage_records
-- ============================================================================
--
-- Append-only — one row per (period, audit_event) pair that contributed
-- to the period's usage_fee_usd. The dashboard renders these in the
-- "Blocked events contributing to this invoice" panel, and a dispute /
-- audit query joins back to clawpay_audit_events for the full evidence
-- trail.

CREATE TABLE IF NOT EXISTS clawpay_billing_usage_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    billing_period_id uuid NOT NULL
        REFERENCES clawpay_billing_periods(id) ON DELETE CASCADE,
    audit_event_id uuid
        REFERENCES clawpay_audit_events(id) ON DELETE SET NULL,

    -- Denormalized wallet_address so RLS doesn't need to JOIN to enforce
    -- tenant scoping.
    wallet_address text NOT NULL,

    blocked_usd numeric(18, 6) NOT NULL CHECK (blocked_usd >= 0),
    fee_usd numeric(18, 6) NOT NULL CHECK (fee_usd >= 0),

    -- Snapshot of fields the dashboard needs even if the underlying audit
    -- row is later purged (e.g. GDPR delete or retention policy).
    occurred_at timestamptz NOT NULL,
    event_kind text NOT NULL,
    risk_level text NOT NULL,
    provider text NOT NULL DEFAULT 'x402',

    created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency anchor for the close step: re-closing the same period must
-- not duplicate usage rows for the same audit_event. The aggregation
-- service uses ON CONFLICT DO NOTHING against this index.
CREATE UNIQUE INDEX IF NOT EXISTS clawpay_billing_usage_records_period_event_unique
    ON clawpay_billing_usage_records (billing_period_id, audit_event_id)
    WHERE audit_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS clawpay_billing_usage_records_period_created
    ON clawpay_billing_usage_records (billing_period_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clawpay_billing_usage_records_wallet_occurred
    ON clawpay_billing_usage_records (wallet_address, occurred_at DESC);

COMMENT ON TABLE clawpay_billing_usage_records IS
    'Append-only mapping of audit events to billing periods. The fee_usd on each row equals blocked_usd * (period.fee_bps_snapshot / 10000); the sum across rows must match period.usage_fee_usd (Sprint 5 invariant).';

-- ============================================================================
-- 5. updated_at triggers
-- ============================================================================

DROP TRIGGER IF EXISTS clawpay_billing_accounts_updated_at_trg ON clawpay_billing_accounts;
CREATE TRIGGER clawpay_billing_accounts_updated_at_trg
    BEFORE UPDATE ON clawpay_billing_accounts
    FOR EACH ROW EXECUTE FUNCTION clawpay_set_updated_at();

DROP TRIGGER IF EXISTS clawpay_billing_periods_updated_at_trg ON clawpay_billing_periods;
CREATE TRIGGER clawpay_billing_periods_updated_at_trg
    BEFORE UPDATE ON clawpay_billing_periods
    FOR EACH ROW EXECUTE FUNCTION clawpay_set_updated_at();

-- (usage_records is append-only — no updated_at needed.)

-- ============================================================================
-- 6. RLS — JWT-claims policies
-- ============================================================================

ALTER TABLE clawpay_billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_billing_usage_records ENABLE ROW LEVEL SECURITY;

-- --- clawpay_billing_accounts — read by owner, write via service_role only.
-- Stripe IDs are mirrored by the backend; tenants should not be able to
-- forge them, and the plan / fee_bps / subscription_fee fields are
-- operator-controlled (paid tier upgrades route through admin endpoints).

DROP POLICY IF EXISTS clawpay_billing_accounts_select_jwt ON clawpay_billing_accounts;
CREATE POLICY clawpay_billing_accounts_select_jwt ON clawpay_billing_accounts
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- --- clawpay_billing_periods — read by owner; writes are service_role-only.

DROP POLICY IF EXISTS clawpay_billing_periods_select_jwt ON clawpay_billing_periods;
CREATE POLICY clawpay_billing_periods_select_jwt ON clawpay_billing_periods
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- --- clawpay_billing_usage_records — same: read by owner.

DROP POLICY IF EXISTS clawpay_billing_usage_records_select_jwt ON clawpay_billing_usage_records;
CREATE POLICY clawpay_billing_usage_records_select_jwt ON clawpay_billing_usage_records
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- ============================================================================
-- 7. RPC — close_billing_period (atomic, idempotent)
-- ============================================================================
--
-- Wraps the close step in a Postgres function so the aggregation service
-- can call it as a single SECURITY DEFINER round trip:
--
--   1. Sum blocked_value across audit events in [start, end).
--   2. Compute usage_fee = sum * (fee_bps / 10000).
--   3. Compute total = usage_fee + subscription_fee.
--   4. UPDATE the period row to status='closed' with the totals.
--   5. INSERT one usage_record per audit event, ON CONFLICT DO NOTHING
--      against the (billing_period_id, audit_event_id) unique index.
--
-- Idempotency: calling the function twice for the same period_id produces
-- the same numbers and the same usage_records (the unique index absorbs
-- duplicate inserts). Calling on a period whose status is already
-- 'invoiced'/'paid' is a no-op that returns the existing snapshot.

CREATE OR REPLACE FUNCTION close_clawpay_billing_period(
    p_period_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_period clawpay_billing_periods%ROWTYPE;
    v_account clawpay_billing_accounts%ROWTYPE;
    v_blocked numeric(18, 6);
    v_count integer;
    v_usage_fee numeric(18, 6);
    v_total numeric(18, 6);
    v_subscription_fee numeric(18, 6);
    v_fee_bps integer;
    v_plan clawpay_billing_plan;
BEGIN
    -- 1. Load period (locked) + account (read-only).
    SELECT * INTO v_period
    FROM clawpay_billing_periods
    WHERE id = p_period_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'billing period not found: %', p_period_id
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Idempotent re-call: a period that's already past 'closed' returns
    --    its current snapshot without recomputing.
    IF v_period.status IN ('invoiced', 'paid') THEN
        RETURN jsonb_build_object(
            'period_id', v_period.id,
            'status', v_period.status,
            'blocked_value_usd', v_period.blocked_value_usd,
            'blocked_event_count', v_period.blocked_event_count,
            'usage_fee_usd', v_period.usage_fee_usd,
            'subscription_fee_usd', v_period.subscription_fee_usd,
            'total_usd', v_period.total_usd,
            'idempotent', true
        );
    END IF;

    SELECT * INTO v_account
    FROM clawpay_billing_accounts
    WHERE wallet_address = v_period.wallet_address;

    IF NOT FOUND THEN
        v_fee_bps := 50;
        v_subscription_fee := 0;
        v_plan := 'free';
    ELSE
        v_fee_bps := v_account.fee_bps;
        v_subscription_fee := v_account.subscription_fee_usd;
        v_plan := v_account.plan;
    END IF;

    -- 3. Aggregate blocked audit events in the period window. Only count
    --    events that actually have a USD amount — refunds, malformed
    --    payments and the like are excluded from the fee.
    SELECT
        COALESCE(SUM(amount_usd), 0),
        COUNT(*)
    INTO v_blocked, v_count
    FROM clawpay_audit_events
    WHERE wallet_address = v_period.wallet_address
      AND event_kind = 'payment_blocked'
      AND occurred_at >= v_period.period_start
      AND occurred_at <  v_period.period_end
      AND amount_usd IS NOT NULL
      AND amount_usd > 0;

    v_usage_fee := round(v_blocked * v_fee_bps / 10000.0, 6);
    v_total := v_usage_fee + v_subscription_fee;

    -- 4. Persist the snapshot on the period row.
    UPDATE clawpay_billing_periods SET
        status = 'closed',
        blocked_value_usd = v_blocked,
        blocked_event_count = v_count,
        usage_fee_usd = v_usage_fee,
        subscription_fee_usd = v_subscription_fee,
        total_usd = v_total,
        fee_bps_snapshot = v_fee_bps,
        plan_snapshot = v_plan,
        closed_at = COALESCE(closed_at, now())
    WHERE id = p_period_id;

    -- 5. Insert one usage_record per contributing audit event. ON CONFLICT
    --    DO NOTHING absorbs replays — a second call adds no rows.
    INSERT INTO clawpay_billing_usage_records (
        billing_period_id, audit_event_id, wallet_address,
        blocked_usd, fee_usd, occurred_at, event_kind, risk_level, provider
    )
    SELECT
        p_period_id,
        ae.id,
        ae.wallet_address,
        ae.amount_usd,
        round(ae.amount_usd * v_fee_bps / 10000.0, 6),
        ae.occurred_at,
        ae.event_kind,
        ae.risk_level::text,
        ae.provider
    FROM clawpay_audit_events ae
    WHERE ae.wallet_address = v_period.wallet_address
      AND ae.event_kind = 'payment_blocked'
      AND ae.occurred_at >= v_period.period_start
      AND ae.occurred_at <  v_period.period_end
      AND ae.amount_usd IS NOT NULL
      AND ae.amount_usd > 0
    ON CONFLICT (billing_period_id, audit_event_id)
        WHERE audit_event_id IS NOT NULL
        DO NOTHING;

    RETURN jsonb_build_object(
        'period_id', p_period_id,
        'status', 'closed',
        'blocked_value_usd', v_blocked,
        'blocked_event_count', v_count,
        'usage_fee_usd', v_usage_fee,
        'subscription_fee_usd', v_subscription_fee,
        'total_usd', v_total,
        'idempotent', false
    );
END;
$$;

REVOKE ALL ON FUNCTION close_clawpay_billing_period(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION close_clawpay_billing_period(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION close_clawpay_billing_period(uuid) TO authenticated;

COMMENT ON FUNCTION close_clawpay_billing_period(uuid) IS
    'SECURITY DEFINER. Atomically closes a billing period: aggregates blocked audit events, computes usage_fee + total, snapshots fee_bps + plan, inserts one usage_record per event. Idempotent — re-calling returns the same snapshot.';
