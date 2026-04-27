-- JWT-claims RLS policies for tool_credentials, agent_alert_rules,
-- agent_alert_history.
--
-- Continues Frente B.1 (audit F-01 / P0.1). Same shape as previous
-- migrations: parallel PERMISSIVE policies that match when the request JWT
-- carries wallet_address. Existing GUC-based policies stay; PERMISSIVE
-- policies OR.
--
-- agent_alert_history is read-only from user paths (writes happen via
-- service-role from the alert evaluation cron); only a SELECT policy is
-- added to mirror the existing GUC policy.

-- ============================================
-- tool_credentials
-- ============================================

CREATE POLICY tool_credentials_select_jwt ON tool_credentials
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

CREATE POLICY tool_credentials_insert_jwt ON tool_credentials
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY tool_credentials_update_jwt ON tool_credentials
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY tool_credentials_delete_jwt ON tool_credentials
    FOR DELETE
    USING (wallet_address = jwt_wallet_address());

-- ============================================
-- agent_alert_rules
-- ============================================

CREATE POLICY agent_alert_rules_select_jwt ON agent_alert_rules
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

CREATE POLICY agent_alert_rules_insert_jwt ON agent_alert_rules
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY agent_alert_rules_update_jwt ON agent_alert_rules
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY agent_alert_rules_delete_jwt ON agent_alert_rules
    FOR DELETE
    USING (wallet_address = jwt_wallet_address());

-- ============================================
-- agent_alert_history — SELECT only (writes via service-role)
-- ============================================

CREATE POLICY agent_alert_history_select_jwt ON agent_alert_history
    FOR SELECT
    USING (
      alert_rule_id IN (
        SELECT id FROM agent_alert_rules WHERE wallet_address = jwt_wallet_address()
      )
    );
