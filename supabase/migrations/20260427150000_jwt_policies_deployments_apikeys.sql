-- JWT-claims RLS policies for deployments + api_keys.
--
-- Continues Frente B.1. Same pattern: parallel PERMISSIVE policies that
-- match when the request JWT carries wallet_address. Existing GUC policies
-- stay; PERMISSIVE policies OR.
--
-- Both tables route ownership through agents.wallet_address via agent_id.

-- ============================================
-- deployments
-- ============================================

CREATE POLICY deployments_select_jwt ON deployments
    FOR SELECT
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY deployments_insert_jwt ON deployments
    FOR INSERT
    WITH CHECK (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY deployments_update_jwt ON deployments
    FOR UPDATE
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    )
    WITH CHECK (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY deployments_delete_jwt ON deployments
    FOR DELETE
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

-- ============================================
-- api_keys
-- ============================================

CREATE POLICY api_keys_select_jwt ON api_keys
    FOR SELECT
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY api_keys_insert_jwt ON api_keys
    FOR INSERT
    WITH CHECK (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY api_keys_update_jwt ON api_keys
    FOR UPDATE
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    )
    WITH CHECK (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY api_keys_delete_jwt ON api_keys
    FOR DELETE
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );
