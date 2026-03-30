-- Migration: Admin Governance & Compliance
-- Date: 2026-01-22
-- Sprint 3: Governance monitoring, proposal moderation, GDPR dashboard

-- ============================================
-- 1. PROPOSAL MODERATION FIELDS
-- ============================================

-- Add moderation fields to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT FALSE;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS hidden_by TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS hidden_reason TEXT;

-- Index for finding hidden proposals
CREATE INDEX IF NOT EXISTS idx_proposals_hidden ON proposals(is_hidden) WHERE is_hidden = true;

COMMENT ON COLUMN proposals.is_hidden IS 'Whether proposal is hidden from public view by admin';
COMMENT ON COLUMN proposals.hidden_at IS 'When the proposal was hidden';
COMMENT ON COLUMN proposals.hidden_by IS 'Admin wallet hash who hid the proposal';
COMMENT ON COLUMN proposals.hidden_reason IS 'Reason for hiding the proposal';

-- ============================================
-- 2. GDPR REQUESTS TABLE
-- ============================================

-- Table for tracking GDPR/data subject requests
CREATE TABLE IF NOT EXISTS gdpr_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address),
    request_type TEXT NOT NULL CHECK (request_type IN ('export', 'deletion', 'access', 'rectification')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    admin_wallet_hash TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- Indexes for GDPR requests
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_wallet ON gdpr_requests(wallet_address);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON gdpr_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_created ON gdpr_requests(created_at DESC);

-- Enable RLS
ALTER TABLE gdpr_requests ENABLE ROW LEVEL SECURITY;

-- Add updated_at trigger
CREATE TRIGGER gdpr_requests_updated_at
    BEFORE UPDATE ON gdpr_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON TABLE gdpr_requests IS 'GDPR and data subject request tracking. Retention: indefinite for compliance.';
COMMENT ON COLUMN gdpr_requests.request_type IS 'Type of GDPR request: export, deletion, access, rectification';
COMMENT ON COLUMN gdpr_requests.status IS 'Current status of the request';
COMMENT ON COLUMN gdpr_requests.admin_wallet_hash IS 'Hash of admin who processed the request';

-- ============================================
-- 3. ADMIN GOVERNANCE STATS FUNCTION
-- ============================================

-- Function to get admin governance statistics
CREATE OR REPLACE FUNCTION get_admin_governance_stats()
RETURNS json AS $$
DECLARE
    stats json;
BEGIN
    SELECT json_build_object(
        'total_proposals', (SELECT count(*) FROM proposals),
        'active_proposals', (SELECT count(*) FROM proposals WHERE status IN ('discussion', 'voting')),
        'hidden_proposals', (SELECT count(*) FROM proposals WHERE is_hidden = true),
        'passed_proposals', (SELECT count(*) FROM proposals WHERE status = 'passed'),
        'rejected_proposals', (SELECT count(*) FROM proposals WHERE status = 'rejected'),
        'unique_voters', (SELECT count(DISTINCT wallet_address) FROM votes),
        'total_votes', (SELECT count(*) FROM votes),
        'total_comments', (SELECT count(*) FROM comments),
        'proposals_7d', (SELECT count(*) FROM proposals WHERE created_at > NOW() - INTERVAL '7 days'),
        'proposals_30d', (SELECT count(*) FROM proposals WHERE created_at > NOW() - INTERVAL '30 days'),
        'votes_7d', (SELECT count(*) FROM votes WHERE created_at > NOW() - INTERVAL '7 days'),
        'participation_rate', (
            SELECT CASE
                WHEN (SELECT count(*) FROM proposals WHERE status IN ('passed', 'rejected', 'no_quorum')) > 0 THEN
                    ROUND((SELECT count(DISTINCT wallet_address)::numeric FROM votes) /
                          NULLIF((SELECT count(*) FROM proposals WHERE status IN ('passed', 'rejected', 'no_quorum')), 0), 2)
                ELSE 0
            END
        ),
        'by_status', (
            SELECT COALESCE(json_object_agg(status, cnt), '{}'::json)
            FROM (
                SELECT status, count(*) as cnt
                FROM proposals
                GROUP BY status
            ) s
        ),
        'by_type', (
            SELECT COALESCE(json_object_agg(type, cnt), '{}'::json)
            FROM (
                SELECT type, count(*) as cnt
                FROM proposals
                GROUP BY type
            ) t
        )
    ) INTO stats;
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. ADMIN COMPLIANCE STATS FUNCTION
-- ============================================

-- Function to get admin compliance statistics
CREATE OR REPLACE FUNCTION get_admin_compliance_stats()
RETURNS json AS $$
DECLARE
    stats json;
BEGIN
    SELECT json_build_object(
        'total_requests', (SELECT count(*) FROM gdpr_requests),
        'pending_requests', (SELECT count(*) FROM gdpr_requests WHERE status = 'pending'),
        'in_progress_requests', (SELECT count(*) FROM gdpr_requests WHERE status = 'in_progress'),
        'completed_requests', (SELECT count(*) FROM gdpr_requests WHERE status = 'completed'),
        'rejected_requests', (SELECT count(*) FROM gdpr_requests WHERE status = 'rejected'),
        'requests_7d', (SELECT count(*) FROM gdpr_requests WHERE created_at > NOW() - INTERVAL '7 days'),
        'requests_30d', (SELECT count(*) FROM gdpr_requests WHERE created_at > NOW() - INTERVAL '30 days'),
        'avg_completion_hours', (
            SELECT COALESCE(
                ROUND(EXTRACT(EPOCH FROM AVG(completed_at - requested_at)) / 3600, 1),
                0
            )
            FROM gdpr_requests
            WHERE status = 'completed' AND completed_at IS NOT NULL
        ),
        'total_deletions', (SELECT count(*) FROM deletion_audit_log),
        'deletions_7d', (SELECT count(*) FROM deletion_audit_log WHERE created_at > NOW() - INTERVAL '7 days'),
        'deletions_30d', (SELECT count(*) FROM deletion_audit_log WHERE created_at > NOW() - INTERVAL '30 days'),
        'by_request_type', (
            SELECT COALESCE(json_object_agg(request_type, cnt), '{}'::json)
            FROM (
                SELECT request_type, count(*) as cnt
                FROM gdpr_requests
                GROUP BY request_type
            ) r
        ),
        'by_status', (
            SELECT COALESCE(json_object_agg(status, cnt), '{}'::json)
            FROM (
                SELECT status, count(*) as cnt
                FROM gdpr_requests
                GROUP BY status
            ) s
        )
    ) INTO stats;
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. PROPOSAL VISIBILITY UPDATE FUNCTION
-- ============================================

-- Function to toggle proposal visibility (admin moderation)
CREATE OR REPLACE FUNCTION admin_toggle_proposal_visibility(
    p_proposal_id UUID,
    p_hidden BOOLEAN,
    p_reason TEXT,
    p_admin_hash TEXT
)
RETURNS json AS $$
DECLARE
    v_result json;
BEGIN
    UPDATE proposals
    SET
        is_hidden = p_hidden,
        hidden_at = CASE WHEN p_hidden THEN NOW() ELSE NULL END,
        hidden_by = CASE WHEN p_hidden THEN p_admin_hash ELSE NULL END,
        hidden_reason = CASE WHEN p_hidden THEN p_reason ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_proposal_id
    RETURNING json_build_object(
        'id', id,
        'is_hidden', is_hidden,
        'hidden_at', hidden_at,
        'hidden_reason', hidden_reason
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. GDPR REQUEST MANAGEMENT FUNCTIONS
-- ============================================

-- Function to update GDPR request status
CREATE OR REPLACE FUNCTION admin_update_gdpr_request(
    p_request_id UUID,
    p_status TEXT,
    p_notes TEXT,
    p_admin_hash TEXT
)
RETURNS json AS $$
DECLARE
    v_result json;
BEGIN
    UPDATE gdpr_requests
    SET
        status = p_status,
        notes = COALESCE(p_notes, notes),
        admin_wallet_hash = p_admin_hash,
        completed_at = CASE WHEN p_status IN ('completed', 'rejected') THEN NOW() ELSE completed_at END,
        updated_at = NOW()
    WHERE id = p_request_id
    RETURNING json_build_object(
        'id', id,
        'status', status,
        'completed_at', completed_at,
        'notes', notes
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================

-- Grant service_role access to new table
GRANT ALL ON gdpr_requests TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
