-- Migration: Admin Governance & Compliance RPCs
-- Date: 2026-01-22
-- Sprint 3 Refactor: Add proper RPC functions for consistency with admin-agents pattern
-- Follows the established pattern from 20260121110000_admin_agent_deployment.sql

-- ============================================
-- 1. RPC: LIST PROPOSALS (ADMIN)
-- Paginated proposal list with filters
-- ============================================
CREATE OR REPLACE FUNCTION admin_list_proposals(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_hidden BOOLEAN DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_order_by TEXT DEFAULT 'created_at',
  p_order_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE(
  id UUID,
  number INTEGER,
  title TEXT,
  type TEXT,
  status TEXT,
  author_wallet TEXT,
  author_name TEXT,
  is_hidden BOOLEAN,
  hidden_at TIMESTAMPTZ,
  hidden_reason TEXT,
  votes_for BIGINT,
  votes_against BIGINT,
  comments_count BIGINT,
  created_at TIMESTAMPTZ,
  voting_end_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total count for pagination
  SELECT COUNT(*) INTO v_total
  FROM proposals prop
  WHERE
    (p_status IS NULL OR prop.status = p_status)
    AND (p_type IS NULL OR prop.type = p_type)
    AND (p_hidden IS NULL OR COALESCE(prop.is_hidden, false) = p_hidden)
    AND (p_search IS NULL OR prop.title ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT
    prop.id,
    prop.number,
    prop.title,
    prop.type,
    prop.status,
    prop.author_wallet,
    prof.display_name as author_name,
    COALESCE(prop.is_hidden, false) as is_hidden,
    prop.hidden_at,
    prop.hidden_reason,
    COALESCE(prop.votes_for, 0)::BIGINT as votes_for,
    COALESCE(prop.votes_against, 0)::BIGINT as votes_against,
    COALESCE(cc.comment_count, 0)::BIGINT as comments_count,
    prop.created_at,
    prop.voting_end_at,
    v_total as total_count
  FROM proposals prop
  LEFT JOIN profiles prof ON prop.author_wallet = prof.wallet_address
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as comment_count
    FROM comments
    WHERE proposal_id = prop.id
  ) cc ON true
  WHERE
    (p_status IS NULL OR prop.status = p_status)
    AND (p_type IS NULL OR prop.type = p_type)
    AND (p_hidden IS NULL OR COALESCE(prop.is_hidden, false) = p_hidden)
    AND (p_search IS NULL OR prop.title ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_order_by = 'number' AND p_order_dir = 'asc' THEN prop.number END ASC,
    CASE WHEN p_order_by = 'number' AND p_order_dir = 'desc' THEN prop.number END DESC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'asc' THEN prop.created_at END ASC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'desc' THEN prop.created_at END DESC,
    CASE WHEN p_order_by = 'votes' AND p_order_dir = 'asc' THEN COALESCE(prop.votes_for, 0) + COALESCE(prop.votes_against, 0) END ASC,
    CASE WHEN p_order_by = 'votes' AND p_order_dir = 'desc' THEN COALESCE(prop.votes_for, 0) + COALESCE(prop.votes_against, 0) END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_list_proposals IS 'Paginated proposal list for admin with filters and search';

-- ============================================
-- 2. RPC: GET PROPOSAL DETAILS (ADMIN)
-- Full proposal details with vote counts
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_proposal_details(
  p_proposal_id UUID
)
RETURNS TABLE(
  id UUID,
  number INTEGER,
  title TEXT,
  body TEXT,
  type TEXT,
  status TEXT,
  author_wallet TEXT,
  author_name TEXT,
  is_hidden BOOLEAN,
  hidden_at TIMESTAMPTZ,
  hidden_by TEXT,
  hidden_reason TEXT,
  votes_for BIGINT,
  votes_against BIGINT,
  quorum_required REAL,
  majority_required REAL,
  comments_count BIGINT,
  discussion_end_at TIMESTAMPTZ,
  voting_start_at TIMESTAMPTZ,
  voting_end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    prop.id,
    prop.number,
    prop.title,
    prop.body,
    prop.type,
    prop.status,
    prop.author_wallet,
    prof.display_name as author_name,
    COALESCE(prop.is_hidden, false) as is_hidden,
    prop.hidden_at,
    prop.hidden_by,
    prop.hidden_reason,
    COALESCE(prop.votes_for, 0)::BIGINT as votes_for,
    COALESCE(prop.votes_against, 0)::BIGINT as votes_against,
    prop.quorum_required,
    prop.majority_required,
    COALESCE(cc.comment_count, 0)::BIGINT as comments_count,
    prop.discussion_end_at,
    prop.voting_start_at,
    prop.voting_end_at,
    prop.created_at,
    prop.updated_at
  FROM proposals prop
  LEFT JOIN profiles prof ON prop.author_wallet = prof.wallet_address
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as comment_count
    FROM comments
    WHERE proposal_id = prop.id
  ) cc ON true
  WHERE prop.id = p_proposal_id;
END;
$$;

COMMENT ON FUNCTION admin_get_proposal_details IS 'Full proposal details for admin view';

-- ============================================
-- 3. RPC: GET PROPOSAL VOTES (ADMIN)
-- Paginated vote list for a proposal
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_proposal_votes(
  p_proposal_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  wallet_address TEXT,
  display_name TEXT,
  vote_direction TEXT,
  voting_power BIGINT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM votes
  WHERE proposal_id = p_proposal_id;

  RETURN QUERY
  SELECT
    v.wallet_address,
    prof.display_name,
    v.vote_direction,
    v.vote_power as voting_power,
    v.created_at,
    v_total as total_count
  FROM votes v
  LEFT JOIN profiles prof ON v.wallet_address = prof.wallet_address
  WHERE v.proposal_id = p_proposal_id
  ORDER BY v.vote_power DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_get_proposal_votes IS 'Paginated vote list for a proposal';

-- ============================================
-- 4. RPC: LIST GDPR REQUESTS (ADMIN)
-- Paginated GDPR request list with filters
-- ============================================
CREATE OR REPLACE FUNCTION admin_list_gdpr_requests(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_request_type TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_order_by TEXT DEFAULT 'created_at',
  p_order_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE(
  id UUID,
  wallet_address TEXT,
  display_name TEXT,
  request_type TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  admin_wallet_hash TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total count for pagination
  SELECT COUNT(*) INTO v_total
  FROM gdpr_requests gr
  WHERE
    (p_request_type IS NULL OR gr.request_type = p_request_type)
    AND (p_status IS NULL OR gr.status = p_status)
    AND (p_search IS NULL OR gr.wallet_address ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT
    gr.id,
    gr.wallet_address,
    prof.display_name,
    gr.request_type,
    gr.status,
    gr.requested_at,
    gr.completed_at,
    gr.admin_wallet_hash,
    gr.created_at,
    v_total as total_count
  FROM gdpr_requests gr
  LEFT JOIN profiles prof ON gr.wallet_address = prof.wallet_address
  WHERE
    (p_request_type IS NULL OR gr.request_type = p_request_type)
    AND (p_status IS NULL OR gr.status = p_status)
    AND (p_search IS NULL OR gr.wallet_address ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'asc' THEN gr.created_at END ASC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'desc' THEN gr.created_at END DESC,
    CASE WHEN p_order_by = 'requested_at' AND p_order_dir = 'asc' THEN gr.requested_at END ASC,
    CASE WHEN p_order_by = 'requested_at' AND p_order_dir = 'desc' THEN gr.requested_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_list_gdpr_requests IS 'Paginated GDPR request list for admin with filters';

-- ============================================
-- 5. RPC: GET GDPR REQUEST DETAILS (ADMIN)
-- Full GDPR request details
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_gdpr_request_details(
  p_request_id UUID
)
RETURNS TABLE(
  id UUID,
  wallet_address TEXT,
  display_name TEXT,
  request_type TEXT,
  status TEXT,
  requested_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  admin_wallet_hash TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    gr.id,
    gr.wallet_address,
    prof.display_name,
    gr.request_type,
    gr.status,
    gr.requested_at,
    gr.completed_at,
    gr.admin_wallet_hash,
    gr.notes,
    gr.metadata,
    gr.created_at,
    gr.updated_at
  FROM gdpr_requests gr
  LEFT JOIN profiles prof ON gr.wallet_address = prof.wallet_address
  WHERE gr.id = p_request_id;
END;
$$;

COMMENT ON FUNCTION admin_get_gdpr_request_details IS 'Full GDPR request details for admin view';

-- ============================================
-- 6. RPC: LIST DELETION AUDIT (ADMIN)
-- Paginated deletion audit log with search
-- ============================================
CREATE OR REPLACE FUNCTION admin_list_deletion_audit(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_search TEXT DEFAULT NULL,
  p_order_by TEXT DEFAULT 'deletion_date',
  p_order_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE(
  id UUID,
  wallet_hash TEXT,
  data_categories TEXT[],
  retained_categories TEXT[],
  retention_reason TEXT,
  deletion_date TIMESTAMPTZ,
  request_id TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total count for pagination
  SELECT COUNT(*) INTO v_total
  FROM deletion_audit_log dal
  WHERE (p_search IS NULL OR dal.wallet_hash ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT
    dal.id,
    dal.wallet_hash,
    dal.data_categories,
    dal.retained_categories,
    dal.retention_reason,
    dal.deletion_date,
    dal.request_id,
    dal.created_at,
    v_total as total_count
  FROM deletion_audit_log dal
  WHERE (p_search IS NULL OR dal.wallet_hash ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_order_by = 'deletion_date' AND p_order_dir = 'asc' THEN dal.deletion_date END ASC,
    CASE WHEN p_order_by = 'deletion_date' AND p_order_dir = 'desc' THEN dal.deletion_date END DESC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'asc' THEN dal.created_at END ASC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'desc' THEN dal.created_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_list_deletion_audit IS 'Paginated deletion audit log for admin with search';
