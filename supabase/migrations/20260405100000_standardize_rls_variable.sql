-- Migration: Standardize RLS variable and migrate llm_keys policies
-- Date: 2026-04-05
-- Description: Creates set_request_context() helper function and migrates
--              llm_keys policies from current_wallet() (JWT-based) to
--              current_setting('app.wallet_address', true) (standardized).
--
-- RATIONALE:
-- - current_wallet() reads from request.jwt.claims which only works with Supabase Auth
-- - current_setting('app.wallet_address', true) is set by API middleware and works
--   with any auth mechanism (wallet signatures, service-to-service, testing)
-- - All other tables already use current_setting('app.wallet_address', true)

-- ============================================
-- 1. HELPER FUNCTION: set_request_context
-- ============================================
-- Sets the wallet address for the current transaction.
-- Used by API middleware and test harness.

CREATE OR REPLACE FUNCTION set_request_context(wallet text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.wallet_address', wallet, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION set_request_context IS
    'Sets app.wallet_address for the current transaction. Used by API middleware for RLS.';

-- ============================================
-- 2. MIGRATE LLM_KEYS POLICIES
-- ============================================
-- Drop old policies that use current_wallet()
DROP POLICY IF EXISTS "llm_keys_select_own" ON llm_keys;
DROP POLICY IF EXISTS "llm_keys_insert_own" ON llm_keys;
DROP POLICY IF EXISTS "llm_keys_update_own" ON llm_keys;
DROP POLICY IF EXISTS "llm_keys_delete_own" ON llm_keys;
DROP POLICY IF EXISTS "llm_keys_service_policy" ON llm_keys;

-- Recreate with standardized variable
CREATE POLICY llm_keys_select_policy ON llm_keys
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY llm_keys_insert_policy ON llm_keys
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY llm_keys_update_policy ON llm_keys
    FOR UPDATE
    USING (wallet_address = current_setting('app.wallet_address', true))
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY llm_keys_delete_policy ON llm_keys
    FOR DELETE
    USING (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY llm_keys_service_policy ON llm_keys
    FOR ALL
    USING (current_setting('role', true) = 'service_role');
