-- Frente J — payment idempotency: client-controlled deduplication for /payments/verify
--
-- Adds idempotency_key to subscriptions and updates record_payment to short-circuit
-- on a known (wallet, idempotency_key) pair. The handler also caches the response in
-- Workers KV for fast-path replies, but the database UNIQUE constraint is the
-- correctness boundary: even if the KV is wiped or the request hits a different
-- worker instance, the second attempt resolves to the same row instead of creating
-- a duplicate subscription.
--
-- Why this matters: a client retrying a /payments/verify call after a transient
-- network error (5xx, timeout) could otherwise record the same Solana payment as
-- two subscriptions if tx_signature happened to differ between retries (e.g., a
-- wallet that submits the same intent twice on chain). The Idempotency-Key header
-- ties retries to a single client-side intent regardless of the chain transaction.

-- ============================================================================
-- 1. Schema: idempotency_key column + partial unique index
-- ============================================================================

ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS idempotency_key text;

-- Partial unique index — only enforce uniqueness when the column is set, so
-- legacy rows (NULL) coexist with the new feature without a backfill.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_idempotency_unique
    ON subscriptions (wallet_address, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN subscriptions.idempotency_key IS
    'Client-supplied X-Idempotency-Key from /payments/verify. NULL for rows recorded before Frente J (2026-05-07).';

-- ============================================================================
-- 2. record_payment — accept idempotency_key and short-circuit on replay
-- ============================================================================

DROP FUNCTION IF EXISTS record_payment(text, text, text, text, bigint, timestamptz, timestamptz);

CREATE OR REPLACE FUNCTION record_payment(
    p_wallet text,
    p_tx_signature text,
    p_plan text,
    p_payment_token text,
    p_amount_lamports bigint,
    p_period_start timestamptz,
    p_period_end timestamptz,
    p_idempotency_key text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_wallet text;
    v_existing record;
BEGIN
    -- 1. JWT claim must match the parameter. Bypassing RLS via SECURITY DEFINER
    --    would otherwise let a misbehaving handler write a subscription against
    --    any wallet by passing a different p_wallet.
    v_jwt_wallet := jwt_wallet_address();
    IF v_jwt_wallet IS NULL OR v_jwt_wallet != p_wallet THEN
        RAISE EXCEPTION 'unauthorized: JWT wallet claim does not match request'
            USING ERRCODE = '42501';
    END IF;

    -- 2. Idempotent replay path: if (wallet, idempotency_key) already exists,
    --    return that subscription's data instead of attempting another insert.
    --    This gives the client a deterministic response across network retries
    --    even when the original tx_signature changed (rare but possible if the
    --    chain submission was retried and only one signature succeeded).
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id, plan, period_start, period_end, tx_signature
        INTO v_existing
        FROM subscriptions
        WHERE wallet_address = p_wallet
          AND idempotency_key = p_idempotency_key
        LIMIT 1;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'replayed', true,
                'subscription_id', v_existing.id,
                'plan', v_existing.plan,
                'period_start', v_existing.period_start,
                'period_end', v_existing.period_end,
                'tx_signature', v_existing.tx_signature
            );
        END IF;
    END IF;

    -- 3. Cross-tenant tx_signature uniqueness check (legitimate inside SECURITY
    --    DEFINER — RLS would otherwise hide rows owned by other wallets and we
    --    would miss a duplicate signature).
    SELECT id INTO v_existing.id
    FROM subscriptions
    WHERE tx_signature = p_tx_signature
    LIMIT 1;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'tx_signature_already_used',
            'existing_subscription_id', v_existing.id
        );
    END IF;

    -- 4. Insert subscription + update profile in the implicit transaction
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
        status,
        idempotency_key
    ) VALUES (
        p_wallet,
        p_plan,
        p_payment_token,
        p_amount_lamports,
        p_tx_signature,
        p_period_start,
        p_period_end,
        'active',
        p_idempotency_key
    );

    UPDATE profiles SET
        plan = p_plan,
        plan_expires_at = p_period_end,
        updated_at = now()
    WHERE wallet_address = p_wallet;

    RETURN jsonb_build_object(
        'success', true,
        'replayed', false,
        'plan', p_plan,
        'period_start', p_period_start,
        'period_end', p_period_end
    );
END;
$$;

REVOKE ALL ON FUNCTION record_payment(text, text, text, text, bigint, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION record_payment(text, text, text, text, bigint, timestamptz, timestamptz, text) FROM anon;
GRANT EXECUTE ON FUNCTION record_payment(text, text, text, text, bigint, timestamptz, timestamptz, text) TO authenticated;

COMMENT ON FUNCTION record_payment(text, text, text, text, bigint, timestamptz, timestamptz, text) IS
    'SECURITY DEFINER. Records a verified Solana payment. Two short-circuit paths: (a) idempotency_key replay returns existing subscription, (b) tx_signature_already_used rejects double-spend. Otherwise inserts subscription + updates profiles.plan atomically. JWT wallet_address claim must match p_wallet.';
