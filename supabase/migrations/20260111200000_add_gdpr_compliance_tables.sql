-- GDPR Compliance Tables
-- Sprint 5: Security Audit Log & Deletion Audit Log
-- Per SECURITY_SPEC Section 9.2 and Section 10

-- ============================================
-- SECURITY AUDIT LOG (SECURITY_SPEC Section 5.3.2)
-- ============================================
-- Logs security-relevant events for audit purposes
-- Retention: 12 months (archived to R2 after)
CREATE TABLE IF NOT EXISTS security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Wallet is hashed for privacy, not raw address
    wallet_hash TEXT,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warn', 'error', 'critical')),
    -- IP is hashed with daily salt per SECURITY_SPEC Section 9.2.6
    ip_hash TEXT,
    -- Metadata - never contains PII, scrubbed before storage
    metadata JSONB DEFAULT '{}',
    request_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by event type and time
CREATE INDEX IF NOT EXISTS idx_security_audit_event_type ON security_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_security_audit_created ON security_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_severity ON security_audit_log(severity);
CREATE INDEX IF NOT EXISTS idx_security_audit_wallet ON security_audit_log(wallet_hash);

-- Comment for documentation
COMMENT ON TABLE security_audit_log IS 'Security events for audit. Per SECURITY_SPEC Section 5.3.2. Retention: 12 months.';
COMMENT ON COLUMN security_audit_log.wallet_hash IS 'SHA-256 hash of wallet address, not raw address';
COMMENT ON COLUMN security_audit_log.ip_hash IS 'SHA-256 hash of IP with daily salt, per SECURITY_SPEC Section 9.2.6';

-- ============================================
-- DELETION AUDIT LOG (SECURITY_SPEC Section 10.3)
-- ============================================
-- Immutable audit trail for GDPR deletion requests
-- Required for proving compliance with right to erasure
-- Retention: 7 years (legal requirement)
CREATE TABLE IF NOT EXISTS deletion_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Wallet is hashed for privacy after deletion
    wallet_hash TEXT NOT NULL,
    deletion_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- What categories of data were deleted
    data_categories TEXT[] NOT NULL,
    -- What categories were retained (with legal basis)
    retained_categories TEXT[],
    retention_reason TEXT,
    -- Request metadata
    request_ip_hash TEXT,
    request_id TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for compliance queries
CREATE INDEX IF NOT EXISTS idx_deletion_audit_wallet ON deletion_audit_log(wallet_hash);
CREATE INDEX IF NOT EXISTS idx_deletion_audit_date ON deletion_audit_log(deletion_date DESC);

-- Comment for documentation
COMMENT ON TABLE deletion_audit_log IS 'Immutable GDPR deletion audit trail. Per SECURITY_SPEC Section 10.3. Retention: 7 years.';
COMMENT ON COLUMN deletion_audit_log.wallet_hash IS 'SHA-256 hash of original wallet address';
COMMENT ON COLUMN deletion_audit_log.data_categories IS 'Categories of data that were deleted';
COMMENT ON COLUMN deletion_audit_log.retained_categories IS 'Categories retained with legal basis';

-- ============================================
-- IMMUTABILITY ENFORCEMENT
-- ============================================
-- Revoke UPDATE and DELETE permissions on deletion_audit_log
-- This table must be append-only for legal compliance
-- Note: service_role can still modify, but application layer enforces immutability

-- Trigger to prevent updates to deletion_audit_log
CREATE OR REPLACE FUNCTION prevent_deletion_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'deletion_audit_log is immutable. Updates and deletes are not permitted.';
END;
$$ LANGUAGE plpgsql;

-- Apply trigger for UPDATE
DROP TRIGGER IF EXISTS prevent_deletion_audit_update ON deletion_audit_log;
CREATE TRIGGER prevent_deletion_audit_update
    BEFORE UPDATE ON deletion_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_deletion_audit_modification();

-- Apply trigger for DELETE
DROP TRIGGER IF EXISTS prevent_deletion_audit_delete ON deletion_audit_log;
CREATE TRIGGER prevent_deletion_audit_delete
    BEFORE DELETE ON deletion_audit_log
    FOR EACH ROW
    EXECUTE FUNCTION prevent_deletion_audit_modification();

-- ============================================
-- ADD PROFILE STATUS FOR SOFT DELETE
-- ============================================
-- Per SECURITY_SPEC Section 10.1.5, we mark profiles as deleted
-- but retain for 7 years for payment records compliance
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for querying active profiles
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

COMMENT ON COLUMN profiles.status IS 'Profile status. Deleted profiles are soft-deleted for legal retention.';
COMMENT ON COLUMN profiles.deleted_at IS 'When the profile was deleted (GDPR deletion request)';
