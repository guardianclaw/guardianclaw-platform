-- JWT-claims RLS policies for governance tables: proposals, votes, comments,
-- admin_roles.
--
-- Continues Frente B.1. Same shape as previous migrations: parallel
-- PERMISSIVE policies that match when the request JWT carries the
-- appropriate claim. Existing GUC-based policies on proposals + votes stay;
-- comments + admin_roles had RLS enabled but ZERO policies (queries under
-- non-service-role returned zero rows), so the JWT policies become the
-- sole non-service path for those two tables.
--
-- Cross-tenant reads (vote tally in finalizeProposal, /stats RPC, etc.)
-- continue to use service-role explicitly — RLS is bypassed there by
-- design. The handler classification lives in governance.ts comments.

-- ============================================
-- proposals
-- ============================================
-- Mirrors the existing GUC policy: visible if status is in the public set
-- (active/passed/rejected/executed) OR the caller is the author. Updates
-- are restricted to the author. Inserts have no using clause in the
-- existing GUC policy; the JWT version requires the inserted author_wallet
-- to match the JWT (defensive — handler always sets it to the caller).

CREATE POLICY proposals_select_jwt ON proposals
    FOR SELECT
    USING (
      status = ANY (ARRAY['active','passed','rejected','executed'])
      OR author_wallet = jwt_wallet_address()
    );

CREATE POLICY proposals_insert_jwt ON proposals
    FOR INSERT
    WITH CHECK (author_wallet = jwt_wallet_address());

CREATE POLICY proposals_update_jwt ON proposals
    FOR UPDATE
    USING (author_wallet = jwt_wallet_address())
    WITH CHECK (author_wallet = jwt_wallet_address());

-- No DELETE policy: proposals are not deleted from user paths; lifecycle
-- moves them to status='cancelled' which is just an UPDATE. Service-role
-- handles any genuine deletion needed (e.g., admin retraction).

-- ============================================
-- votes
-- ============================================
-- Mirrors existing GUC: a user can read their own vote and insert one for
-- themselves. Vote tally is a cross-tenant aggregation handled by
-- service-role (finalizeProposal, get_governance_stats RPC).

CREATE POLICY votes_select_jwt ON votes
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

CREATE POLICY votes_insert_jwt ON votes
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

-- ============================================
-- comments — no prior policies, RLS on (queries returned zero rows from
-- any non-service-role connection)
-- ============================================
-- Comments are public per proposal: every authenticated user can read all
-- comments. The existing handler reads all comments for the given proposal
-- without further filtering, so this matches the runtime contract. INSERT
-- is restricted to own author_wallet.

CREATE POLICY comments_select_jwt ON comments
    FOR SELECT
    USING (true);

CREATE POLICY comments_insert_jwt ON comments
    FOR INSERT
    WITH CHECK (author_wallet = jwt_wallet_address());

-- ============================================
-- admin_roles — no prior policies, RLS on
-- ============================================
-- Each user can read their own admin role row (used to gate admin endpoints
-- like /admin/pause). Cross-tenant admin listing stays on service-role.

CREATE POLICY admin_roles_select_jwt ON admin_roles
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());
