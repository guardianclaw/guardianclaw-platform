-- JWT-claims RLS policies for webhooks, webhook_endpoints, webhook_deliveries.
--
-- These three tables had RLS enabled but ZERO policies — meaning any query
-- under a non-service-role connection returned zero rows. The runtime always
-- used SUPABASE_SERVICE_KEY (bypasses RLS), which made the missing policies
-- invisible. With Frente B.1 routing user-scoped traffic through the anon
-- key + minted JWT, the policies are required for the route to function.
--
-- Ownership flows through agents (agent_id column on each of the three
-- tables joined with agents.wallet_address). webhook_deliveries also has
-- agent_id, so the same predicate applies. The public webhook trigger
-- handler stays on service_role and bypasses these policies entirely.

-- ============================================
-- webhooks (incoming triggers)
-- ============================================

CREATE POLICY webhooks_select_jwt ON webhooks
    FOR SELECT
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY webhooks_insert_jwt ON webhooks
    FOR INSERT
    WITH CHECK (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY webhooks_update_jwt ON webhooks
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

CREATE POLICY webhooks_delete_jwt ON webhooks
    FOR DELETE
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

-- ============================================
-- webhook_endpoints (outgoing deliveries)
-- ============================================

CREATE POLICY webhook_endpoints_select_jwt ON webhook_endpoints
    FOR SELECT
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY webhook_endpoints_insert_jwt ON webhook_endpoints
    FOR INSERT
    WITH CHECK (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY webhook_endpoints_update_jwt ON webhook_endpoints
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

CREATE POLICY webhook_endpoints_delete_jwt ON webhook_endpoints
    FOR DELETE
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

-- ============================================
-- webhook_deliveries (delivery history) — read-only from user paths
-- ============================================
-- Writes happen from system context (delivery executor); user routes only
-- list deliveries. Mirror that with a SELECT-only JWT policy.

CREATE POLICY webhook_deliveries_select_jwt ON webhook_deliveries
    FOR SELECT
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );
