-- Add JWT-claims-based RLS policies parallel to the existing
-- current_setting('app.wallet_address') policies.
--
-- Background: tables that hold user-scoped data already have RLS policies
-- keyed on `current_setting('app.wallet_address', true)`, which the API used
-- to set via set_request_context(). The runtime never actually called that
-- function (one transaction per query made it impractical), so RLS was
-- defense-in-depth, not a runtime barrier — service_role bypassed everything.
--
-- This migration starts the path for Frente B.1 (audit F-01 / P0.1): when a
-- handler uses anon key + a JWT minted with SUPABASE_JWT_SECRET, PostgREST
-- exposes the JWT body under `current_setting('request.jwt.claims', true)`.
-- The new policies below allow access when the JWT's `wallet_address` claim
-- matches the row owner — the same predicate, but evaluated by Postgres at
-- query time instead of by handler code.
--
-- Why parallel instead of replace: routes flip one at a time. During the
-- rollout window, some handlers still use service_role (which bypasses RLS
-- entirely) and some still use a hypothetical GUC-based path. Permissive
-- policies are OR'd, so adding the JWT-claims policy does not break the
-- existing GUC policy or the service_role path.
--
-- Pilot table: llm_keys. Subsequent migrations will widen to other
-- user-scoped tables as routes are migrated.

-- ============================================
-- Helper extracting the wallet from the JWT claims.
-- ============================================
-- Defined once and reused by every JWT-based policy. Returns NULL when no
-- JWT is on the connection (service_role / no-auth paths), which makes the
-- policy fail closed without erroring.
CREATE OR REPLACE FUNCTION jwt_wallet_address()
RETURNS text AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json ->> 'wallet_address',
    ''
  )
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION jwt_wallet_address IS
    'Returns the wallet_address claim from the request JWT. NULL when no claim is present.';

-- ============================================
-- llm_keys — JWT-based parallel policies
-- ============================================
-- The existing GUC-based policies (mig 20260405100000) stay in place. These
-- new policies match when the JWT carries the correct wallet_address. Rows
-- visible to either policy are visible to the caller (PostgreSQL OR
-- semantics for permissive policies).

CREATE POLICY llm_keys_select_jwt ON llm_keys
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

CREATE POLICY llm_keys_insert_jwt ON llm_keys
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY llm_keys_update_jwt ON llm_keys
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY llm_keys_delete_jwt ON llm_keys
    FOR DELETE
    USING (wallet_address = jwt_wallet_address());
