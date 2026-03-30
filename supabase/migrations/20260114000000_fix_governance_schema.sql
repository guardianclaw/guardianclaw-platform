-- Migration: Fix Governance Schema
-- Date: 2026-01-14
-- Description: Align proposals table with API requirements and add comments table

-- ============================================
-- 1. ALTER PROPOSALS TABLE
-- ============================================

-- Add new columns
ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS number SERIAL;

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS body TEXT;

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'feature';

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS discussion_end_at TIMESTAMPTZ;

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS voting_start_at TIMESTAMPTZ;

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS quorum_required REAL DEFAULT 0.1;

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS majority_required REAL DEFAULT 0.5;

ALTER TABLE proposals
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

-- Migrate data from description to body (if description exists and body is empty)
UPDATE proposals
SET body = description
WHERE body IS NULL AND description IS NOT NULL;

-- Rename voting_ends_at to voting_end_at for consistency
ALTER TABLE proposals
RENAME COLUMN voting_ends_at TO voting_end_at;

-- Drop old status constraint and add new one with all status values
ALTER TABLE proposals
DROP CONSTRAINT IF EXISTS proposals_status_check;

ALTER TABLE proposals
ADD CONSTRAINT proposals_status_check
CHECK (status IN ('draft', 'discussion', 'voting', 'passed', 'rejected', 'executed', 'cancelled', 'no_quorum'));

-- Make body NOT NULL after migration (with default for existing rows)
UPDATE proposals SET body = '' WHERE body IS NULL;
ALTER TABLE proposals ALTER COLUMN body SET NOT NULL;

-- Drop description column (now redundant)
ALTER TABLE proposals DROP COLUMN IF EXISTS description;

-- Add unique constraint on number
ALTER TABLE proposals
ADD CONSTRAINT proposals_number_unique UNIQUE (number);

-- ============================================
-- 2. CREATE COMMENTS TABLE (if not exists)
-- ============================================

CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    author_wallet TEXT REFERENCES profiles(wallet_address),
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

-- ============================================
-- 3. ADD NEW INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_proposals_author ON proposals(author_wallet);
CREATE INDEX IF NOT EXISTS idx_proposals_type ON proposals(type);
CREATE INDEX IF NOT EXISTS idx_proposals_number ON proposals(number);
CREATE INDEX IF NOT EXISTS idx_comments_proposal ON comments(proposal_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_wallet);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id);

-- ============================================
-- 4. ENABLE RLS ON COMMENTS
-- ============================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. UPDATE GET_GOVERNANCE_STATS FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION get_governance_stats()
RETURNS json AS $$
DECLARE
    stats json;
BEGIN
    SELECT json_build_object(
        'total_proposals', (SELECT count(*) FROM proposals),
        'active_proposals', (SELECT count(*) FROM proposals WHERE status IN ('discussion', 'voting')),
        'unique_voters', (SELECT count(DISTINCT wallet_address) FROM votes),
        'total_votes', (SELECT count(*) FROM votes),
        'proposals_by_status', (
            SELECT json_object_agg(status, cnt)
            FROM (
                SELECT status, count(*) as cnt
                FROM proposals
                GROUP BY status
            ) s
        )
    ) INTO stats;
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. ADD TRIGGER FOR UPDATED_AT
-- ============================================

CREATE TRIGGER proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER comments_updated_at
    BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
