-- JWT-claims RLS policies for deposits + execution_logs.
--
-- Continues Frente B.1. Same shape as previous migrations: parallel
-- PERMISSIVE policies that match when the request JWT carries
-- wallet_address. Existing GUC-based policies stay; PERMISSIVE OR.
--
-- deposits has wallet_address directly. execution_logs ownership flows
-- via agents (no wallet_address column on execution_logs itself).

-- ============================================
-- deposits — SELECT only from user paths
-- ============================================
-- Writes happen inside SECURITY DEFINER RPCs (process_deposit, etc.) which
-- bypass RLS by design. Mirror the existing "Users can view their own
-- deposits" policy with a JWT variant.

CREATE POLICY deposits_select_jwt ON deposits
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- ============================================
-- execution_logs — select / insert / delete
-- ============================================
-- Inserts come from the system context (execution-logger service) and run
-- under service_role; we still add the JWT insert policy so any future
-- user-side write would work. No update policy in the existing set, so
-- none here.

CREATE POLICY execution_logs_select_jwt ON execution_logs
    FOR SELECT
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY execution_logs_insert_jwt ON execution_logs
    FOR INSERT
    WITH CHECK (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY execution_logs_delete_jwt ON execution_logs
    FOR DELETE
    USING (
      agent_id IN (
        SELECT id FROM agents WHERE wallet_address = jwt_wallet_address()
      )
    );
