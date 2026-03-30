-- Migration: Add RLS policies for agents, profiles, and api_keys tables
-- Date: 2026-03-14
-- Description: agents, profiles, and api_keys had RLS enabled in the initial schema
--              (20260105000000_initial_schema.sql) but no explicit policies were defined.
--              This migration creates comprehensive RLS policies following the established
--              pattern from:
--              - 20260111100000_add_llm_keys_rls_policies.sql
--              - 20260128000000_add_conversations_rls_policies.sql
--
-- CONTEXT:
-- The API uses service_role (SUPABASE_SERVICE_KEY) which bypasses RLS, so the absence
-- of policies did not manifest in production. However, defense-in-depth security requires
-- explicit policies for any future direct Supabase access (SDK client, dashboard, staging).
--
-- STANDARD VARIABLE: app.wallet_address (set by API middleware for authenticated requests)
-- NOTE: current_wallet() helper function is defined in 20260111100000_add_llm_keys_rls_policies.sql
--
-- TABLE OWNERSHIP PATTERNS:
-- - profiles:  wallet_address = primary key (self-referential ownership)
-- - agents:    wallet_address column → direct ownership
-- - api_keys:  agent_id → agents.wallet_address → indirect ownership
--
-- Dependencies:
-- - profiles table from 20260105000000_initial_schema.sql
-- - agents table from 20260105000000_initial_schema.sql
-- - api_keys table from 20260105000000_initial_schema.sql
-- - current_wallet() function from 20260111100000_add_llm_keys_rls_policies.sql

-- ============================================
-- 1. PROFILES TABLE POLICIES
-- ============================================
-- profiles.wallet_address IS the primary key — it is the user identity.

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS profiles_select_policy ON profiles;
DROP POLICY IF EXISTS profiles_insert_policy ON profiles;
DROP POLICY IF EXISTS profiles_update_policy ON profiles;
DROP POLICY IF EXISTS profiles_service_policy ON profiles;

-- Policy: Users can only SELECT their own profile
CREATE POLICY profiles_select_policy ON profiles
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only INSERT a profile for themselves
CREATE POLICY profiles_insert_policy ON profiles
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only UPDATE their own profile
CREATE POLICY profiles_update_policy ON profiles
    FOR UPDATE
    USING (wallet_address = current_setting('app.wallet_address', true))
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- No DELETE policy for authenticated users — profile deletion is a destructive operation
-- handled exclusively through the API with service_role. This prevents accidental
-- or unauthorized profile deletion via direct DB access.

-- Policy: Service role can perform all operations (API, scheduled workers, admin)
CREATE POLICY profiles_service_policy ON profiles
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 2. AGENTS TABLE POLICIES
-- ============================================
-- agents.wallet_address references profiles.wallet_address — direct ownership.

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS agents_select_policy ON agents;
DROP POLICY IF EXISTS agents_insert_policy ON agents;
DROP POLICY IF EXISTS agents_update_policy ON agents;
DROP POLICY IF EXISTS agents_delete_policy ON agents;
DROP POLICY IF EXISTS agents_service_policy ON agents;

-- Policy: Users can only SELECT their own agents
CREATE POLICY agents_select_policy ON agents
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only INSERT agents for themselves
CREATE POLICY agents_insert_policy ON agents
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only UPDATE their own agents
CREATE POLICY agents_update_policy ON agents
    FOR UPDATE
    USING (wallet_address = current_setting('app.wallet_address', true))
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only DELETE their own agents
CREATE POLICY agents_delete_policy ON agents
    FOR DELETE
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Service role can perform all operations
CREATE POLICY agents_service_policy ON agents
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 3. API_KEYS TABLE POLICIES
-- ============================================
-- api_keys has no direct wallet_address column; ownership is via agent_id → agents.wallet_address.

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS api_keys_select_policy ON api_keys;
DROP POLICY IF EXISTS api_keys_insert_policy ON api_keys;
DROP POLICY IF EXISTS api_keys_update_policy ON api_keys;
DROP POLICY IF EXISTS api_keys_delete_policy ON api_keys;
DROP POLICY IF EXISTS api_keys_service_policy ON api_keys;

-- Policy: Users can only SELECT API keys for their own agents
CREATE POLICY api_keys_select_policy ON api_keys
    FOR SELECT
    USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only INSERT API keys for their own agents
CREATE POLICY api_keys_insert_policy ON api_keys
    FOR INSERT
    WITH CHECK (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only UPDATE API keys for their own agents
CREATE POLICY api_keys_update_policy ON api_keys
    FOR UPDATE
    USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    )
    WITH CHECK (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only DELETE API keys for their own agents
CREATE POLICY api_keys_delete_policy ON api_keys
    FOR DELETE
    USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Service role can perform all operations
CREATE POLICY api_keys_service_policy ON api_keys
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 4. POLICY COMMENTS (Documentation)
-- ============================================

COMMENT ON POLICY profiles_select_policy ON profiles IS
    'RLS: Users can only view their own profile (defense-in-depth)';

COMMENT ON POLICY profiles_insert_policy ON profiles IS
    'RLS: Users can only create a profile for their own wallet address';

COMMENT ON POLICY profiles_update_policy ON profiles IS
    'RLS: Users can only modify their own profile';

COMMENT ON POLICY profiles_service_policy ON profiles IS
    'RLS: Service role bypass for API, scheduled workers, and admin operations';

COMMENT ON POLICY agents_select_policy ON agents IS
    'RLS: Users can only view their own agents (defense-in-depth)';

COMMENT ON POLICY agents_insert_policy ON agents IS
    'RLS: Users can only create agents for their own wallet address';

COMMENT ON POLICY agents_update_policy ON agents IS
    'RLS: Users can only modify their own agents';

COMMENT ON POLICY agents_delete_policy ON agents IS
    'RLS: Users can only delete their own agents';

COMMENT ON POLICY agents_service_policy ON agents IS
    'RLS: Service role bypass for API, scheduled workers, and admin operations';

COMMENT ON POLICY api_keys_select_policy ON api_keys IS
    'RLS: Users can only view API keys belonging to their own agents';

COMMENT ON POLICY api_keys_insert_policy ON api_keys IS
    'RLS: Users can only create API keys for their own agents';

COMMENT ON POLICY api_keys_update_policy ON api_keys IS
    'RLS: Users can only modify API keys belonging to their own agents';

COMMENT ON POLICY api_keys_delete_policy ON api_keys IS
    'RLS: Users can only delete API keys belonging to their own agents';

COMMENT ON POLICY api_keys_service_policy ON api_keys IS
    'RLS: Service role bypass for API, scheduled workers, and admin operations';

-- ============================================
-- 5. VERIFICATION QUERY (for testing)
-- ============================================
-- Run this query after migration to verify policies were created:
--
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE tablename IN ('profiles', 'agents', 'api_keys')
-- ORDER BY tablename, policyname;
--
-- Expected:
-- - profiles: 3 policies (select, insert, update, service) — no delete by design
-- - agents:   5 policies (select, insert, update, delete, service)
-- - api_keys: 5 policies (select, insert, update, delete, service)
