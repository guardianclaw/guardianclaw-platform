-- Migration: Complete RLS policies for tables without explicit policies
-- Date: 2026-04-05
-- Description: Defense-in-depth — adds RLS policies to 6 tables that had RLS enabled
--              but no policies defined. API uses service_role (bypasses RLS), but these
--              policies protect against: direct DB access, future anon key usage,
--              or route handlers that forget wallet filters.
--
-- Tables covered: agent_events, auth_sessions, subscriptions, votes, usage_daily, proposals
-- Standard variable: current_setting('app.wallet_address', true)
--
-- Also enables RLS on usage_daily and proposals (missed in initial schema).

-- ============================================
-- 0. ENABLE RLS ON TABLES THAT WERE MISSED
-- ============================================
ALTER TABLE usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 1. AGENT_EVENTS POLICIES
-- ============================================
-- Ownership is via agent_id -> agents.wallet_address (indirect)

DROP POLICY IF EXISTS agent_events_select_policy ON agent_events;
DROP POLICY IF EXISTS agent_events_service_policy ON agent_events;

-- Users can view events for their own agents
CREATE POLICY agent_events_select_policy ON agent_events
    FOR SELECT
    USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Write operations are service-only (events are created by the API, not users)
CREATE POLICY agent_events_service_policy ON agent_events
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 2. AUTH_SESSIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS auth_sessions_select_policy ON auth_sessions;
DROP POLICY IF EXISTS auth_sessions_service_policy ON auth_sessions;

-- Users can view their own sessions
CREATE POLICY auth_sessions_select_policy ON auth_sessions
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- All write ops are service-only (session management is handled by API)
CREATE POLICY auth_sessions_service_policy ON auth_sessions
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 3. SUBSCRIPTIONS POLICIES
-- ============================================

DROP POLICY IF EXISTS subscriptions_select_policy ON subscriptions;
DROP POLICY IF EXISTS subscriptions_service_policy ON subscriptions;

-- Users can view their own subscriptions
CREATE POLICY subscriptions_select_policy ON subscriptions
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- All write ops are service-only (payment processing is handled by API)
CREATE POLICY subscriptions_service_policy ON subscriptions
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 4. VOTES POLICIES
-- ============================================

DROP POLICY IF EXISTS votes_select_policy ON votes;
DROP POLICY IF EXISTS votes_insert_policy ON votes;
DROP POLICY IF EXISTS votes_service_policy ON votes;

-- Users can view their own votes
CREATE POLICY votes_select_policy ON votes
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Users can insert votes for themselves
CREATE POLICY votes_insert_policy ON votes
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Service role for all operations (vote tallying, admin ops)
CREATE POLICY votes_service_policy ON votes
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 5. USAGE_DAILY POLICIES
-- ============================================

DROP POLICY IF EXISTS usage_daily_select_policy ON usage_daily;
DROP POLICY IF EXISTS usage_daily_service_policy ON usage_daily;

-- Users can view their own usage data
CREATE POLICY usage_daily_select_policy ON usage_daily
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- All write ops are service-only (usage tracking is handled by API)
CREATE POLICY usage_daily_service_policy ON usage_daily
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 6. PROPOSALS POLICIES
-- ============================================

DROP POLICY IF EXISTS proposals_select_policy ON proposals;
DROP POLICY IF EXISTS proposals_insert_policy ON proposals;
DROP POLICY IF EXISTS proposals_update_policy ON proposals;
DROP POLICY IF EXISTS proposals_service_policy ON proposals;

-- Active proposals are public (governance transparency)
CREATE POLICY proposals_select_policy ON proposals
    FOR SELECT
    USING (
        status IN ('active', 'passed', 'rejected', 'executed')
        OR author_wallet = current_setting('app.wallet_address', true)
    );

-- Users can create proposals
CREATE POLICY proposals_insert_policy ON proposals
    FOR INSERT
    WITH CHECK (author_wallet = current_setting('app.wallet_address', true));

-- Users can update their own draft proposals only
CREATE POLICY proposals_update_policy ON proposals
    FOR UPDATE
    USING (author_wallet = current_setting('app.wallet_address', true))
    WITH CHECK (author_wallet = current_setting('app.wallet_address', true));

-- Service role for all operations (governance execution, admin ops)
CREATE POLICY proposals_service_policy ON proposals
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('agent_events', 'auth_sessions', 'subscriptions', 'votes', 'usage_daily', 'proposals')
-- ORDER BY tablename, policyname;
