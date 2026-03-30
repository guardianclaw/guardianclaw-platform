-- Migration: Fix Governance & Compliance RPC Pattern
-- Date: 2026-01-22
-- Description: Align RPC return types with tier-1 pattern (RETURNS TABLE instead of RETURNS JSON)
-- Reference: 20260121110000_admin_agent_deployment.sql (admin_get_agents_stats, admin_set_agent_status)

-- ============================================
-- 1. FIX: GOVERNANCE STATS (RETURNS TABLE)
-- Pattern: Same as admin_get_agents_stats
-- ============================================
DROP FUNCTION IF EXISTS get_admin_governance_stats();

CREATE OR REPLACE FUNCTION admin_get_governance_stats()
RETURNS TABLE(
  total_proposals BIGINT,
  active_proposals BIGINT,
  hidden_proposals BIGINT,
  passed_proposals BIGINT,
  rejected_proposals BIGINT,
  unique_voters BIGINT,
  total_votes BIGINT,
  total_comments BIGINT,
  proposals_7d BIGINT,
  proposals_30d BIGINT,
  votes_7d BIGINT,
  participation_rate NUMERIC,
  by_status JSONB,
  by_type JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM proposals)::BIGINT as total_proposals,
    (SELECT COUNT(*) FROM proposals WHERE status IN ('discussion', 'voting'))::BIGINT as active_proposals,
    (SELECT COUNT(*) FROM proposals WHERE is_hidden = true)::BIGINT as hidden_proposals,
    (SELECT COUNT(*) FROM proposals WHERE status = 'passed')::BIGINT as passed_proposals,
    (SELECT COUNT(*) FROM proposals WHERE status = 'rejected')::BIGINT as rejected_proposals,
    (SELECT COUNT(DISTINCT wallet_address) FROM votes)::BIGINT as unique_voters,
    (SELECT COUNT(*) FROM votes)::BIGINT as total_votes,
    (SELECT COUNT(*) FROM comments)::BIGINT as total_comments,
    (SELECT COUNT(*) FROM proposals WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT as proposals_7d,
    (SELECT COUNT(*) FROM proposals WHERE created_at > NOW() - INTERVAL '30 days')::BIGINT as proposals_30d,
    (SELECT COUNT(*) FROM votes WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT as votes_7d,
    COALESCE(
      (SELECT ROUND(
        (SELECT COUNT(DISTINCT wallet_address)::NUMERIC FROM votes) /
        NULLIF((SELECT COUNT(*) FROM proposals WHERE status IN ('passed', 'rejected', 'no_quorum')), 0)
      , 2)),
      0
    )::NUMERIC as participation_rate,
    COALESCE(
      (SELECT jsonb_object_agg(status, cnt)
       FROM (SELECT status, COUNT(*)::INTEGER as cnt FROM proposals GROUP BY status) s),
      '{}'::jsonb
    ) as by_status,
    COALESCE(
      (SELECT jsonb_object_agg(type, cnt)
       FROM (SELECT type, COUNT(*)::INTEGER as cnt FROM proposals GROUP BY type) t),
      '{}'::jsonb
    ) as by_type;
END;
$$;

COMMENT ON FUNCTION admin_get_governance_stats IS 'Platform-wide governance statistics for admin dashboard';

-- ============================================
-- 2. FIX: COMPLIANCE STATS (RETURNS TABLE)
-- Pattern: Same as admin_get_agents_stats
-- ============================================
DROP FUNCTION IF EXISTS get_admin_compliance_stats();

CREATE OR REPLACE FUNCTION admin_get_compliance_stats()
RETURNS TABLE(
  total_requests BIGINT,
  pending_requests BIGINT,
  in_progress_requests BIGINT,
  completed_requests BIGINT,
  rejected_requests BIGINT,
  requests_7d BIGINT,
  requests_30d BIGINT,
  avg_completion_hours NUMERIC,
  total_deletions BIGINT,
  deletions_7d BIGINT,
  deletions_30d BIGINT,
  by_request_type JSONB,
  by_status JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM gdpr_requests)::BIGINT as total_requests,
    (SELECT COUNT(*) FROM gdpr_requests WHERE status = 'pending')::BIGINT as pending_requests,
    (SELECT COUNT(*) FROM gdpr_requests WHERE status = 'in_progress')::BIGINT as in_progress_requests,
    (SELECT COUNT(*) FROM gdpr_requests WHERE status = 'completed')::BIGINT as completed_requests,
    (SELECT COUNT(*) FROM gdpr_requests WHERE status = 'rejected')::BIGINT as rejected_requests,
    (SELECT COUNT(*) FROM gdpr_requests WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT as requests_7d,
    (SELECT COUNT(*) FROM gdpr_requests WHERE created_at > NOW() - INTERVAL '30 days')::BIGINT as requests_30d,
    COALESCE(
      (SELECT ROUND(EXTRACT(EPOCH FROM AVG(completed_at - requested_at)) / 3600, 1)
       FROM gdpr_requests
       WHERE status = 'completed' AND completed_at IS NOT NULL),
      0
    )::NUMERIC as avg_completion_hours,
    (SELECT COUNT(*) FROM deletion_audit_log)::BIGINT as total_deletions,
    (SELECT COUNT(*) FROM deletion_audit_log WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT as deletions_7d,
    (SELECT COUNT(*) FROM deletion_audit_log WHERE created_at > NOW() - INTERVAL '30 days')::BIGINT as deletions_30d,
    COALESCE(
      (SELECT jsonb_object_agg(request_type, cnt)
       FROM (SELECT request_type, COUNT(*)::INTEGER as cnt FROM gdpr_requests GROUP BY request_type) r),
      '{}'::jsonb
    ) as by_request_type,
    COALESCE(
      (SELECT jsonb_object_agg(status, cnt)
       FROM (SELECT status, COUNT(*)::INTEGER as cnt FROM gdpr_requests GROUP BY status) s),
      '{}'::jsonb
    ) as by_status;
END;
$$;

COMMENT ON FUNCTION admin_get_compliance_stats IS 'Platform-wide compliance statistics for admin dashboard';

-- ============================================
-- 3. FIX: TOGGLE PROPOSAL VISIBILITY (RETURNS TABLE)
-- Pattern: Same as admin_set_agent_status
-- ============================================
DROP FUNCTION IF EXISTS admin_toggle_proposal_visibility(UUID, BOOLEAN, TEXT, TEXT);

CREATE OR REPLACE FUNCTION admin_toggle_proposal_visibility(
  p_proposal_id UUID,
  p_hidden BOOLEAN,
  p_reason TEXT,
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  is_hidden BOOLEAN,
  hidden_at TIMESTAMPTZ,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Check if proposal exists
  SELECT EXISTS(SELECT 1 FROM proposals WHERE id = p_proposal_id) INTO v_exists;

  IF NOT v_exists THEN
    RETURN QUERY SELECT false, NULL::BOOLEAN, NULL::TIMESTAMPTZ, 'PROPOSAL_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Update visibility
  UPDATE proposals
  SET
    is_hidden = p_hidden,
    hidden_at = CASE WHEN p_hidden THEN NOW() ELSE NULL END,
    hidden_by = CASE WHEN p_hidden THEN p_admin_hash ELSE NULL END,
    hidden_reason = CASE WHEN p_hidden THEN p_reason ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_proposal_id;

  RETURN QUERY
  SELECT
    true as success,
    p_hidden as is_hidden,
    CASE WHEN p_hidden THEN NOW() ELSE NULL END as hidden_at,
    NULL::TEXT as error;
END;
$$;

COMMENT ON FUNCTION admin_toggle_proposal_visibility IS 'Toggle proposal visibility (hide/show) for moderation';

-- ============================================
-- 4. FIX: UPDATE GDPR REQUEST (RETURNS TABLE)
-- Pattern: Same as admin_set_agent_status
-- ============================================
DROP FUNCTION IF EXISTS admin_update_gdpr_request(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION admin_update_gdpr_request(
  p_request_id UUID,
  p_status TEXT,
  p_notes TEXT,
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  status TEXT,
  completed_at TIMESTAMPTZ,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
  v_new_completed_at TIMESTAMPTZ;
BEGIN
  -- Check if request exists
  SELECT EXISTS(SELECT 1 FROM gdpr_requests WHERE id = p_request_id) INTO v_exists;

  IF NOT v_exists THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TIMESTAMPTZ, 'REQUEST_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Calculate completed_at
  v_new_completed_at := CASE
    WHEN p_status IN ('completed', 'rejected') THEN NOW()
    ELSE NULL
  END;

  -- Update request
  UPDATE gdpr_requests
  SET
    status = p_status,
    notes = COALESCE(p_notes, notes),
    admin_wallet_hash = p_admin_hash,
    completed_at = COALESCE(v_new_completed_at, completed_at),
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN QUERY
  SELECT
    true as success,
    p_status as status,
    v_new_completed_at as completed_at,
    NULL::TEXT as error;
END;
$$;

COMMENT ON FUNCTION admin_update_gdpr_request IS 'Update GDPR request status';
