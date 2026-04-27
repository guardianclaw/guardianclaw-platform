-- JWT-claims RLS policies for agents and agent_events.
--
-- Continues Frente B.1 (audit F-01 / P0.1). Same shape as the llm_keys
-- migration in 20260427000000: parallel PERMISSIVE policies that match when
-- the request JWT carries wallet_address as a custom claim. Existing
-- current_setting('app.wallet_address') policies stay; PERMISSIVE policies
-- are OR'd, so the routes that haven't migrated yet keep working.
--
-- agent_events ownership flows through agents (the table has no
-- wallet_address column of its own); the JOIN matches the existing
-- agent_events_select_policy shape.

-- ============================================
-- agents — JWT-based parallel policies
-- ============================================

CREATE POLICY agents_select_jwt ON agents
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

CREATE POLICY agents_insert_jwt ON agents
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY agents_update_jwt ON agents
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY agents_delete_jwt ON agents
    FOR DELETE
    USING (wallet_address = jwt_wallet_address());

-- ============================================
-- agent_events — JWT-based parallel SELECT policy
-- ============================================
-- The existing GUC policy is read-only (events are written by system / cron).
-- Mirror that here: SELECT only, ownership through the agents JOIN.

CREATE POLICY agent_events_select_jwt ON agent_events
    FOR SELECT
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );
