-- JWT-claims RLS policies for the GDPR-related tables touched by user.ts.
--
-- Continues Frente B.1 (audit F-01 / P0.1). This migration is the last in
-- the user-route bucket. It adds JWT select policies on profiles and
-- subscriptions so the read-only GDPR endpoints (/user/profile and the
-- profile + subscriptions slices of /user/export) can run under
-- getUserClient.
--
-- Tables NOT migrated by this PR:
--
--   * usage_daily, auth_sessions, deletion_audit_log — only read/written
--     from the DELETE /user/data path, which intentionally stays on
--     service-role for this iteration. The deletion path performs a
--     cascade across nine tables and writes an immutable audit row; the
--     correct long-term shape is a single SECURITY DEFINER RPC
--     (`purge_user_data(wallet)`) that runs the cascade in one transaction.
--     That is queued for Frente B.2 (transactional writes RPC pattern).
--     Until then, the existing handler-side .eq('wallet_address') chain
--     remains the predicate, with service-role bypassing RLS.
--
-- profiles is read by both /profile and /export, and updated by the
-- soft-delete in DELETE /data. The existing GUC policy already covers
-- update; we only add the select-own JWT variant here so the read paths
-- pick up RLS.
--
-- subscriptions is read by /export only. Writes happen from
-- payments.ts (system context, service-role) — no JWT write policy
-- needed.

-- ============================================
-- profiles — JWT select own row
-- ============================================

CREATE POLICY profiles_select_jwt ON profiles
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

-- ============================================
-- subscriptions — JWT select own
-- ============================================

CREATE POLICY subscriptions_select_jwt ON subscriptions
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());
