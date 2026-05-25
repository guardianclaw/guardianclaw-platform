-- ClawPay Sprint 6 — beta onboarding + transactional email + status page.
--
-- Sprints 1-5 were the engine; Sprint 6 is the runway. To invite design
-- partners we need (a) a way to gate sign-ups behind allowlist codes,
-- (b) a transactional email delivery audit trail, (c) per-tenant email
-- preferences for the period-close / alert summary notifications, and
-- (d) a public status incidents table so anyone can see whether ClawPay
-- is up before they call support.
--
-- All four tables are wallet-scoped via JWT-claims RLS where it makes
-- sense; the status_incidents table is the exception — incidents are
-- explicitly public so an unauthenticated visitor can see them on the
-- public status page.

-- ============================================================================
-- 1. Enums
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE clawpay_email_delivery_status AS ENUM (
        'pending', 'sent', 'failed', 'bounced', 'complained', 'rejected'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE clawpay_incident_severity AS ENUM (
        'maintenance', 'minor', 'major', 'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE clawpay_incident_status AS ENUM (
        'investigating', 'identified', 'monitoring', 'resolved'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. clawpay_beta_invites
-- ============================================================================
--
-- Codes that gate the closed beta. The lifecycle is simple: admin creates
-- a code with optional max_uses and expiry, a tenant POSTs /beta/invites/
-- :code/redeem to claim it, the redemption increments `used_count` and
-- (when single-use) records the redeeming wallet.
--
-- We avoid storing a "claimed_by" foreign key for multi-use codes since
-- a single row can cover several redemptions. The audit trail of which
-- wallet redeemed which code lives in a separate junction table below.

CREATE TABLE IF NOT EXISTS clawpay_beta_invites (
    -- The visible code (case-sensitive). Generated server-side from a
    -- 24-byte CSPRNG buffer encoded base32 — sufficient entropy to make
    -- guessing infeasible without rate limiting.
    code text PRIMARY KEY,

    -- Optional email this code was originally generated for. NULL means
    -- the code is generic / referral.
    email text,

    -- NULL when generic (multi-use); set when the code was redeemed and
    -- max_uses=1, so admin tooling can see "this code went to wallet X".
    redeemed_by_wallet text,
    redeemed_at timestamptz,

    expires_at timestamptz,

    max_uses integer NOT NULL DEFAULT 1 CHECK (max_uses > 0),
    used_count integer NOT NULL DEFAULT 0 CHECK (used_count >= 0),

    CHECK (used_count <= max_uses),

    -- Free-form annotations. e.g. {"campaign": "coinbase-devs", "tier": "pro"}.
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_by text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clawpay_beta_invites_email
    ON clawpay_beta_invites (email)
    WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS clawpay_beta_invites_redeemed_wallet
    ON clawpay_beta_invites (redeemed_by_wallet)
    WHERE redeemed_by_wallet IS NOT NULL;

-- Hot path: "is this code redeemable right now?" — covers the public
-- GET /beta/invites/:code endpoint.
-- Note: we cannot include `now()` in the index predicate because Postgres
-- requires IMMUTABLE functions there. The redeem RPC re-checks expires_at at
-- query time; the partial index still narrows lookups to rows with quota left.
CREATE INDEX IF NOT EXISTS clawpay_beta_invites_redeemable
    ON clawpay_beta_invites (code)
    WHERE used_count < max_uses;

COMMENT ON TABLE clawpay_beta_invites IS
    'Closed-beta access codes. Codes are generated server-side; redemption decrements remaining uses atomically via the redeem_clawpay_beta_invite RPC.';

-- ============================================================================
-- 3. clawpay_beta_invite_redemptions
-- ============================================================================
--
-- Append-only junction table — one row per (code, wallet) pair that
-- actually redeemed. Lets us answer "show me every wallet that joined
-- via the coinbase-devs campaign" without ambiguity, even for multi-use
-- codes.

CREATE TABLE IF NOT EXISTS clawpay_beta_invite_redemptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    code text NOT NULL REFERENCES clawpay_beta_invites(code) ON DELETE CASCADE,
    wallet_address text NOT NULL,

    redeemed_at timestamptz NOT NULL DEFAULT now()
);

-- One redemption per (code, wallet) — the RPC short-circuits on the
-- unique violation and reports "already redeemed".
CREATE UNIQUE INDEX IF NOT EXISTS clawpay_beta_invite_redemptions_code_wallet_unique
    ON clawpay_beta_invite_redemptions (code, wallet_address);

CREATE INDEX IF NOT EXISTS clawpay_beta_invite_redemptions_wallet
    ON clawpay_beta_invite_redemptions (wallet_address, redeemed_at DESC);

COMMENT ON TABLE clawpay_beta_invite_redemptions IS
    'Append-only audit of beta-invite redemptions. One row per (code, wallet); the unique index makes the redeem RPC idempotent.';

-- ============================================================================
-- 4. clawpay_email_subscriptions
-- ============================================================================
--
-- Per-tenant preferences for the transactional emails ClawPay sends.
-- We default to opt-in for the security-critical channels (period_close,
-- alerts_critical) and opt-out for everything else; tenants control via
-- the dashboard.

CREATE TABLE IF NOT EXISTS clawpay_email_subscriptions (
    wallet_address text PRIMARY KEY,

    email text,
    verified_at timestamptz,

    -- JSON shape: { welcome: bool, period_close: bool, alerts_summary_daily: bool,
    --              alerts_critical: bool, product_updates: bool }
    -- Missing keys default to the channel's default in code.
    preferences jsonb NOT NULL DEFAULT jsonb_build_object(
        'welcome', true,
        'period_close', true,
        'alerts_summary_daily', false,
        'alerts_critical', true,
        'product_updates', false
    ),

    unsubscribed_at timestamptz,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clawpay_email_subscriptions_email
    ON clawpay_email_subscriptions (lower(email))
    WHERE email IS NOT NULL;

COMMENT ON TABLE clawpay_email_subscriptions IS
    'Per-wallet email preferences. The send pipeline reads `preferences` to decide whether a given channel goes out; an explicit `unsubscribed_at` short-circuits everything except channels marked transactional-critical in code.';

-- ============================================================================
-- 5. clawpay_email_deliveries
-- ============================================================================
--
-- Append-only delivery audit. We never store the rendered body — that
-- would be unbounded — only template name, status, provider message id,
-- and any error returned by the provider on failure.

CREATE TABLE IF NOT EXISTS clawpay_email_deliveries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_address text,            -- NULL allowed for system-level sends
    to_email text NOT NULL,
    template text NOT NULL,         -- e.g. 'welcome', 'period_close'

    status clawpay_email_delivery_status NOT NULL DEFAULT 'pending',
    provider text NOT NULL,         -- 'resend', 'postmark', 'in_memory', etc.
    provider_message_id text,
    error_excerpt text,             -- first 512 chars only

    -- Idempotency key used at send time. Lets us pair a webhook update
    -- back to the originating attempt without a JOIN.
    idempotency_key text,

    sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clawpay_email_deliveries_wallet_created
    ON clawpay_email_deliveries (wallet_address, created_at DESC)
    WHERE wallet_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS clawpay_email_deliveries_template_created
    ON clawpay_email_deliveries (template, created_at DESC);

CREATE INDEX IF NOT EXISTS clawpay_email_deliveries_idempotency
    ON clawpay_email_deliveries (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE clawpay_email_deliveries IS
    'Append-only audit of every transactional email send attempt. Bodies are never persisted; only template name + status + provider message id.';

-- ============================================================================
-- 6. clawpay_status_incidents
-- ============================================================================
--
-- Public status incidents — surfaced on the unauthenticated /clawpay/status
-- page. Operators create + resolve via admin tooling.

CREATE TABLE IF NOT EXISTS clawpay_status_incidents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    title text NOT NULL,
    description text,

    severity clawpay_incident_severity NOT NULL DEFAULT 'minor',
    status clawpay_incident_status NOT NULL DEFAULT 'investigating',

    -- Which surface(s) are affected. Free-form array of component names —
    -- 'api', 'modal', 'supabase', 'stripe', 'helius', 'tenderly' — kept
    -- as text[] so adding a new component does not need a migration.
    affected_components text[] NOT NULL DEFAULT ARRAY[]::text[],

    started_at timestamptz NOT NULL DEFAULT now(),
    resolved_at timestamptz,

    -- When false, the incident is internal-only (private postmortem).
    -- The /clawpay/status endpoint filters on this column.
    public boolean NOT NULL DEFAULT true,

    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS clawpay_status_incidents_started_at
    ON clawpay_status_incidents (started_at DESC);

CREATE INDEX IF NOT EXISTS clawpay_status_incidents_unresolved
    ON clawpay_status_incidents (started_at DESC)
    WHERE resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS clawpay_status_incidents_public_recent
    ON clawpay_status_incidents (started_at DESC)
    WHERE public;

COMMENT ON TABLE clawpay_status_incidents IS
    'Public status incidents shown on /clawpay/status. The `public` flag distinguishes external-facing rows from internal postmortems sharing the same table.';

-- ============================================================================
-- 7. updated_at triggers
-- ============================================================================

DROP TRIGGER IF EXISTS clawpay_beta_invites_updated_at_trg ON clawpay_beta_invites;
CREATE TRIGGER clawpay_beta_invites_updated_at_trg
    BEFORE UPDATE ON clawpay_beta_invites
    FOR EACH ROW EXECUTE FUNCTION clawpay_set_updated_at();

DROP TRIGGER IF EXISTS clawpay_email_subscriptions_updated_at_trg ON clawpay_email_subscriptions;
CREATE TRIGGER clawpay_email_subscriptions_updated_at_trg
    BEFORE UPDATE ON clawpay_email_subscriptions
    FOR EACH ROW EXECUTE FUNCTION clawpay_set_updated_at();

DROP TRIGGER IF EXISTS clawpay_status_incidents_updated_at_trg ON clawpay_status_incidents;
CREATE TRIGGER clawpay_status_incidents_updated_at_trg
    BEFORE UPDATE ON clawpay_status_incidents
    FOR EACH ROW EXECUTE FUNCTION clawpay_set_updated_at();

-- ============================================================================
-- 8. RLS
-- ============================================================================

ALTER TABLE clawpay_beta_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_beta_invite_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_email_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_email_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawpay_status_incidents ENABLE ROW LEVEL SECURITY;

-- --- beta_invites: a wallet can SELECT a single invite by code (the check
--     endpoint) but not list them. We expose the code-only lookup via the
--     redeem_clawpay_beta_invite RPC instead of a SELECT policy that would
--     leak invite enumeration.
-- (No SELECT/INSERT/UPDATE/DELETE policies — writes go through the RPC
--  running as service_role; reads go through the RPC return values.)

-- --- beta_invite_redemptions: a wallet can read its own redemptions.
DROP POLICY IF EXISTS clawpay_beta_invite_redemptions_select_jwt
    ON clawpay_beta_invite_redemptions;
CREATE POLICY clawpay_beta_invite_redemptions_select_jwt
    ON clawpay_beta_invite_redemptions
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- --- email_subscriptions: owner read/insert/update; never delete (we
--     transition to unsubscribed_at instead).
DROP POLICY IF EXISTS clawpay_email_subscriptions_select_jwt
    ON clawpay_email_subscriptions;
CREATE POLICY clawpay_email_subscriptions_select_jwt
    ON clawpay_email_subscriptions
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_email_subscriptions_insert_jwt
    ON clawpay_email_subscriptions;
CREATE POLICY clawpay_email_subscriptions_insert_jwt
    ON clawpay_email_subscriptions
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

DROP POLICY IF EXISTS clawpay_email_subscriptions_update_jwt
    ON clawpay_email_subscriptions;
CREATE POLICY clawpay_email_subscriptions_update_jwt
    ON clawpay_email_subscriptions
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

-- --- email_deliveries: owner read only.
DROP POLICY IF EXISTS clawpay_email_deliveries_select_jwt
    ON clawpay_email_deliveries;
CREATE POLICY clawpay_email_deliveries_select_jwt
    ON clawpay_email_deliveries
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- --- status_incidents: anyone (anon + authenticated) can read PUBLIC rows.
DROP POLICY IF EXISTS clawpay_status_incidents_select_public
    ON clawpay_status_incidents;
CREATE POLICY clawpay_status_incidents_select_public
    ON clawpay_status_incidents
    FOR SELECT
    USING (public);

-- ============================================================================
-- 9. RPC — redeem_clawpay_beta_invite
-- ============================================================================
--
-- Atomic redemption: decrements remaining uses + inserts the redemption
-- audit row in one transaction. Idempotent against the
-- (code, wallet) unique index — a second call by the same wallet returns
-- the original timestamp instead of double-counting.

CREATE OR REPLACE FUNCTION redeem_clawpay_beta_invite(
    p_code text,
    p_wallet text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_invite clawpay_beta_invites%ROWTYPE;
    v_jwt_wallet text;
    v_existing_redemption clawpay_beta_invite_redemptions%ROWTYPE;
BEGIN
    v_jwt_wallet := jwt_wallet_address();
    IF v_jwt_wallet IS NULL OR v_jwt_wallet != p_wallet THEN
        RAISE EXCEPTION 'unauthorized: JWT wallet claim does not match p_wallet'
            USING ERRCODE = '42501';
    END IF;

    -- 1. Lock the invite row.
    SELECT * INTO v_invite
    FROM clawpay_beta_invites
    WHERE code = p_code
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'unknown_code');
    END IF;

    -- 2. Idempotent re-call?
    SELECT * INTO v_existing_redemption
    FROM clawpay_beta_invite_redemptions
    WHERE code = p_code AND wallet_address = p_wallet
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'idempotent', true,
            'code', p_code,
            'wallet_address', p_wallet,
            'redeemed_at', v_existing_redemption.redeemed_at,
            'metadata', v_invite.metadata
        );
    END IF;

    -- 3. Liveness checks.
    IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at <= now() THEN
        RETURN jsonb_build_object('success', false, 'error', 'expired');
    END IF;
    IF v_invite.used_count >= v_invite.max_uses THEN
        RETURN jsonb_build_object('success', false, 'error', 'exhausted');
    END IF;

    -- 4. Insert the audit row.
    INSERT INTO clawpay_beta_invite_redemptions (code, wallet_address)
    VALUES (p_code, p_wallet);

    -- 5. Bump counters on the invite row. For single-use codes also mark
    --    the redemption pointer so admin tooling can show "this code
    --    went to wallet X".
    UPDATE clawpay_beta_invites SET
        used_count = used_count + 1,
        redeemed_by_wallet = CASE
            WHEN max_uses = 1 THEN p_wallet
            ELSE redeemed_by_wallet
        END,
        redeemed_at = CASE
            WHEN max_uses = 1 THEN now()
            ELSE redeemed_at
        END
    WHERE code = p_code;

    RETURN jsonb_build_object(
        'success', true,
        'idempotent', false,
        'code', p_code,
        'wallet_address', p_wallet,
        'redeemed_at', now(),
        'metadata', v_invite.metadata
    );
END;
$$;

REVOKE ALL ON FUNCTION redeem_clawpay_beta_invite(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION redeem_clawpay_beta_invite(text, text) FROM anon;
GRANT EXECUTE ON FUNCTION redeem_clawpay_beta_invite(text, text) TO authenticated;

COMMENT ON FUNCTION redeem_clawpay_beta_invite(text, text) IS
    'SECURITY DEFINER. Atomically redeems a beta invite code for the calling wallet. Idempotent — a second call by the same wallet returns the original redemption metadata. Returns a {success, error?, idempotent?, redeemed_at?, metadata?} envelope.';
