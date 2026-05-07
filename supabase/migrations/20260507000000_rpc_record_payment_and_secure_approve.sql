-- Frente B.4 — close the last user-bucket service-role surfaces
--
-- Two changes that together let payments.ts /verify and social-deliveries.ts
-- run under the JWT-claims user client (getUserClient) instead of service_role:
--
--   1. NEW: record_payment(wallet, tx_signature, plan, payment_token,
--      amount_lamports, period_start, period_end) — replaces the manual
--      cross-tenant tx_signature uniqueness check, subscriptions insert and
--      profiles plan update that previously ran under service_role in
--      payments.ts /verify. Mirrors the purge_user_data shape: SECURITY
--      DEFINER, JWT wallet claim verified inside the function, atomic.
--
--   2. UPGRADED: approve_social_delivery — original migration (20260426000000)
--      shipped without SECURITY DEFINER and without an explicit GRANT EXECUTE
--      on the function. That worked while the handler used service_role
--      (bypasses RLS) but blocks the migration to getUserClient (the
--      authenticated role would need RLS on social_deliveries+agents to allow
--      the same atomic state transition the function performs). Promoting the
--      function to SECURITY DEFINER and granting EXECUTE to authenticated
--      keeps the existing behaviour while letting the handler authenticate
--      under the user JWT. Adds a JWT wallet check to defend against the
--      handler passing the wrong p_wallet_address.
--
-- Together these close the residual G-01 surface in apps/api/src/routes/
-- payments.ts and social-deliveries.ts. After this migration the only
-- service_role usage in user-bucket runtime is documented exempt
-- (auth bootstrap before JWT exists, invoke API-key authenticated, health
-- system check, admin routes, scheduled CRON).

-- ============================================================================
-- 1. record_payment — atomic Solana payment recording
-- ============================================================================

CREATE OR REPLACE FUNCTION record_payment(
    p_wallet text,
    p_tx_signature text,
    p_plan text,
    p_payment_token text,
    p_amount_lamports bigint,
    p_period_start timestamptz,
    p_period_end timestamptz
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_wallet text;
    v_existing_id uuid;
BEGIN
    -- 1. JWT wallet claim must match the parameter. SECURITY DEFINER would
    --    otherwise let a misbehaving handler write a subscription against any
    --    wallet by passing a different p_wallet.
    v_jwt_wallet := jwt_wallet_address();
    IF v_jwt_wallet IS NULL OR v_jwt_wallet != p_wallet THEN
        RAISE EXCEPTION 'unauthorized: JWT wallet claim does not match request'
            USING ERRCODE = '42501';
    END IF;

    -- 2. tx_signature must not already be associated with any subscription
    --    (cross-tenant double-spend guard). Inside SECURITY DEFINER the
    --    cross-tenant SELECT is legitimate — RLS would otherwise hide rows
    --    owned by other wallets and we would miss a duplicate signature.
    SELECT id INTO v_existing_id
    FROM subscriptions
    WHERE tx_signature = p_tx_signature
    LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'tx_signature_already_used',
            'existing_subscription_id', v_existing_id
        );
    END IF;

    -- 3. Insert subscription + update profile in the implicit transaction
    --    Postgres opens for the function body. Either both writes succeed or
    --    neither happens.
    INSERT INTO subscriptions (
        wallet_address,
        plan,
        payment_token,
        amount_lamports,
        tx_signature,
        period_start,
        period_end,
        status
    ) VALUES (
        p_wallet,
        p_plan,
        p_payment_token,
        p_amount_lamports,
        p_tx_signature,
        p_period_start,
        p_period_end,
        'active'
    );

    UPDATE profiles SET
        plan = p_plan,
        plan_expires_at = p_period_end,
        updated_at = now()
    WHERE wallet_address = p_wallet;

    RETURN jsonb_build_object(
        'success', true,
        'plan', p_plan,
        'period_start', p_period_start,
        'period_end', p_period_end
    );
END;
$$;

REVOKE ALL ON FUNCTION record_payment(text, text, text, text, bigint, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_payment(text, text, text, text, bigint, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION record_payment(text, text, text, text, bigint, timestamptz, timestamptz) TO authenticated;

COMMENT ON FUNCTION record_payment IS
    'SECURITY DEFINER. Records a verified Solana payment: tx_signature uniqueness check (cross-tenant), subscriptions insert, profiles plan update — all in one transaction. JWT wallet_address claim must match p_wallet. Called by apps/api/src/routes/payments.ts /verify under the user JWT.';

-- ============================================================================
-- 2. approve_social_delivery — promote to SECURITY DEFINER + JWT verification
-- ============================================================================

DROP FUNCTION IF EXISTS approve_social_delivery(UUID, TEXT);

CREATE OR REPLACE FUNCTION approve_social_delivery(
    p_delivery_id uuid,
    p_wallet_address text
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_wallet text;
    v_delivery RECORD;
BEGIN
    -- JWT wallet claim must match the parameter. The handler used to pass
    -- the authenticated wallet directly under service_role; under getUserClient
    -- the handler still passes the wallet but the function now verifies that
    -- claim against the JWT itself, so a handler bug cannot approve a
    -- delivery on someone else's behalf.
    v_jwt_wallet := jwt_wallet_address();
    IF v_jwt_wallet IS NULL OR v_jwt_wallet != p_wallet_address THEN
        RAISE EXCEPTION 'unauthorized: JWT wallet claim does not match request'
            USING ERRCODE = '42501';
    END IF;

    -- Single-statement atomic transition: state change AND ownership check in
    -- one UPDATE. If the wallet does not own the agent, or the row is not in
    -- draft, zero rows match and FOUND becomes false.
    UPDATE social_deliveries sd
    SET status = 'pending', attempts = 1
    FROM agents a
    WHERE sd.id = p_delivery_id
        AND sd.status = 'draft'
        AND sd.agent_id = a.id
        AND a.wallet_address = p_wallet_address
    RETURNING
        sd.id,
        sd.agent_id,
        sd.credential_id,
        sd.platform,
        sd.content,
        sd.delivery_config,
        a.name AS agent_name
    INTO v_delivery;

    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Delivery not found, not in draft, or not owned by caller'
        );
    END IF;

    RETURN json_build_object(
        'success', true,
        'delivery_id', v_delivery.id,
        'agent_id', v_delivery.agent_id,
        'agent_name', v_delivery.agent_name,
        'credential_id', v_delivery.credential_id,
        'platform', v_delivery.platform,
        'content', v_delivery.content,
        'delivery_config', v_delivery.delivery_config
    );
END;
$$;

REVOKE ALL ON FUNCTION approve_social_delivery(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_social_delivery(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION approve_social_delivery(uuid, text) TO authenticated;

COMMENT ON FUNCTION approve_social_delivery IS
    'SECURITY DEFINER. Atomically transitions a draft social delivery to pending and returns the row needed to dispatch it. JWT wallet_address claim must match p_wallet_address. Replaces the un-DEFINER version from migration 20260426000000.';

-- ============================================================================
-- 3. social_deliveries — JWT SELECT policy (parallel to legacy app.* setting)
-- ============================================================================
-- The original RLS (mig 20260115000000) reads wallet via
-- current_setting('app.wallet_address'), which is set by the API only when
-- the handler called set_request_context() — that path stayed on service_role
-- and so the policy never fired. Adding a JWT-claim parallel policy lets the
-- /social-deliveries GET handler run under getUserClient.
--
-- INSERT/UPDATE happen exclusively from server-side flows that either go
-- through approve_social_delivery (now SECURITY DEFINER, bypasses RLS) or
-- through services/social-connectors under service_role (system-level
-- delivery execution after authorization). No JWT INSERT/UPDATE policy
-- needed at this time.

CREATE POLICY social_deliveries_select_jwt ON social_deliveries
    FOR SELECT
    USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = jwt_wallet_address()
        )
    );
