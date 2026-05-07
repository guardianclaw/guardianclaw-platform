-- SECURITY DEFINER RPC for the GDPR right-to-erasure path (DELETE /user/data).
-- Closes the last service-role surface in the user-bucket (Frente B.2).
--
-- The handler in apps/api/src/routes/user.ts previously ran ten ordered
-- mutations against nine tables under a service-role client, then wrote an
-- immutable row to deletion_audit_log. That shape was correct for atomicity
-- but wrong for trust: every successful audit row was guaranteed by the
-- handler's own ownership predicate, not by the database. A bug in the
-- handler could have purged the wrong wallet without RLS noticing.
--
-- This RPC moves the entire cascade behind a single SECURITY DEFINER
-- function:
--
--   1. The function reads the caller's JWT wallet_address claim and
--      refuses to proceed unless it matches the parameter. SECURITY
--      DEFINER bypasses RLS, so this check is the only barrier between
--      the caller and someone else's data.
--   2. The cascade runs inside the function, which Postgres executes in
--      a single implicit transaction. Either the entire purge succeeds
--      and the audit row is written, or nothing changes.
--   3. The wallet hash, request id, and ip hash are computed in the
--      handler (where the request context lives) and passed as
--      parameters; the function does not trust the database to derive
--      them.
--
-- Tables touched by the cascade: llm_keys, agents, agent_events,
-- usage_daily, api_keys, deployments, auth_sessions, votes, profiles
-- (soft delete), deletion_audit_log (insert).

CREATE OR REPLACE FUNCTION purge_user_data(
    p_wallet text,
    p_wallet_hash text,
    p_request_id text,
    p_ip_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_jwt_wallet text;
    v_agent_ids uuid[];
    v_deleted text[] := ARRAY[]::text[];
    v_count int;
BEGIN
    v_jwt_wallet := jwt_wallet_address();
    IF v_jwt_wallet IS NULL OR v_jwt_wallet != p_wallet THEN
        RAISE EXCEPTION 'unauthorized: JWT wallet claim does not match request'
            USING ERRCODE = '42501';
    END IF;

    DELETE FROM llm_keys WHERE wallet_address = p_wallet;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'llm_keys'); END IF;

    SELECT array_agg(id) INTO v_agent_ids FROM agents WHERE wallet_address = p_wallet;

    IF v_agent_ids IS NOT NULL AND array_length(v_agent_ids, 1) > 0 THEN
        DELETE FROM agent_events WHERE agent_id = ANY(v_agent_ids);
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'agent_events'); END IF;

        DELETE FROM usage_daily WHERE wallet_address = p_wallet;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'usage_daily'); END IF;

        DELETE FROM api_keys WHERE agent_id = ANY(v_agent_ids);
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'api_keys'); END IF;

        DELETE FROM deployments WHERE agent_id = ANY(v_agent_ids);
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'deployments'); END IF;
    END IF;

    DELETE FROM agents WHERE wallet_address = p_wallet;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'agents'); END IF;

    DELETE FROM auth_sessions WHERE wallet_address = p_wallet;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'auth_sessions'); END IF;

    DELETE FROM votes WHERE wallet_address = p_wallet;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'votes'); END IF;

    UPDATE profiles SET
        status = 'deleted',
        deleted_at = now(),
        display_name = NULL,
        avatar_url = NULL
    WHERE wallet_address = p_wallet;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN v_deleted := array_append(v_deleted, 'profile_optional_fields'); END IF;

    INSERT INTO deletion_audit_log (
        wallet_hash,
        deletion_date,
        data_categories,
        retained_categories,
        retention_reason,
        request_ip_hash,
        request_id
    ) VALUES (
        p_wallet_hash,
        now(),
        v_deleted,
        ARRAY['subscriptions', 'profile_core'],
        'tax_compliance_7_years',
        p_ip_hash,
        p_request_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'deleted', v_deleted,
        'retained', ARRAY['subscriptions', 'profile_core']
    );
END;
$$;

REVOKE ALL ON FUNCTION purge_user_data(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION purge_user_data(text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION purge_user_data(text, text, text, text) TO authenticated;
