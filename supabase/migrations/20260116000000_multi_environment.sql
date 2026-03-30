-- ============================================
-- MULTI-ENVIRONMENT DEPLOYMENT SYSTEM
-- ============================================
-- Enables safe deployment workflow with:
-- - Multiple environments (dev, staging, prod)
-- - Deployment history with full config snapshots
-- - Rollback capability to any previous deployment
-- - Promote workflow (staging -> prod)
--
-- Design decisions:
-- - Environment column on deployments (not agents) for per-deploy flexibility
-- - deployed_by tracks who made the deployment (audit trail)
-- - rollback_from creates a chain of deployment relationships
-- - flow_snapshot and claw_snapshot stored separately for clarity
-- - Default 'prod' environment maintains backward compatibility
-- - Existing deployments without environment are treated as 'prod'

-- ============================================
-- EXTEND DEPLOYMENTS TABLE
-- ============================================

-- Add environment column (default 'prod' for backward compatibility)
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS environment TEXT
    DEFAULT 'prod' CHECK (environment IN ('dev', 'staging', 'prod'));

-- Add deployed_by for audit trail (nullable for existing deployments)
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS deployed_by TEXT;

-- Add rollback reference (which deployment this was rolled back from)
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rollback_from UUID
    REFERENCES deployments(id) ON DELETE SET NULL;

-- Add promote reference (which deployment this was promoted from)
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS promoted_from UUID
    REFERENCES deployments(id) ON DELETE SET NULL;

-- Add separate flow and claw snapshots for clearer history
-- These are optional - config_snapshot still contains everything
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS flow_snapshot JSONB;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS claw_snapshot JSONB;

-- Add notes field for deployment comments
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add is_active flag to track current active deployment per environment
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ============================================
-- INDEXES
-- ============================================

-- Fast lookup by agent and environment (primary query pattern)
CREATE INDEX IF NOT EXISTS idx_deployments_agent_env
    ON deployments(agent_id, environment, created_at DESC);

-- Fast lookup for active deployment per environment
CREATE INDEX IF NOT EXISTS idx_deployments_active
    ON deployments(agent_id, environment, is_active)
    WHERE is_active = true;

-- Fast lookup by deployment chain (rollback/promote tracking)
CREATE INDEX IF NOT EXISTS idx_deployments_rollback
    ON deployments(rollback_from)
    WHERE rollback_from IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deployments_promoted
    ON deployments(promoted_from)
    WHERE promoted_from IS NOT NULL;

-- Fast lookup by deployer (audit queries)
CREATE INDEX IF NOT EXISTS idx_deployments_deployer
    ON deployments(deployed_by, created_at DESC)
    WHERE deployed_by IS NOT NULL;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Note: deployments table inherits access via agent ownership
-- These policies ensure users can only access their agents' deployments

-- Drop existing policies if they exist (for clean recreation)
DROP POLICY IF EXISTS deployments_select ON deployments;
DROP POLICY IF EXISTS deployments_insert ON deployments;
DROP POLICY IF EXISTS deployments_update ON deployments;
DROP POLICY IF EXISTS deployments_delete ON deployments;

-- Enable RLS if not already enabled
ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;

-- Users can view deployments for their agents
CREATE POLICY deployments_select ON deployments
    FOR SELECT USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Users can create deployments for their agents
CREATE POLICY deployments_insert ON deployments
    FOR INSERT WITH CHECK (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Users can update deployments for their agents
CREATE POLICY deployments_update ON deployments
    FOR UPDATE USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Users can delete deployments for their agents
CREATE POLICY deployments_delete ON deployments
    FOR DELETE USING (
        agent_id IN (
            SELECT id FROM agents
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

/**
 * Get deployment history for an agent.
 * Returns all deployments (all environments) ordered by date.
 */
CREATE OR REPLACE FUNCTION get_deployment_history(
    p_agent_id UUID,
    p_environment TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    version INTEGER,
    environment TEXT,
    status TEXT,
    config_snapshot JSONB,
    flow_snapshot JSONB,
    claw_snapshot JSONB,
    endpoint_url TEXT,
    deployed_by TEXT,
    rollback_from UUID,
    promoted_from UUID,
    notes TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.version,
        d.environment,
        d.status,
        d.config_snapshot,
        d.flow_snapshot,
        d.claw_snapshot,
        d.endpoint_url,
        d.deployed_by,
        d.rollback_from,
        d.promoted_from,
        d.notes,
        d.is_active,
        d.created_at,
        d.stopped_at
    FROM deployments d
    WHERE d.agent_id = p_agent_id
        AND (p_environment IS NULL OR d.environment = p_environment)
    ORDER BY d.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

/**
 * Get count of deployments for pagination.
 */
CREATE OR REPLACE FUNCTION get_deployment_history_count(
    p_agent_id UUID,
    p_environment TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM deployments d
        WHERE d.agent_id = p_agent_id
            AND (p_environment IS NULL OR d.environment = p_environment)
    );
END;
$$ LANGUAGE plpgsql;

/**
 * Get active deployment for an agent in a specific environment.
 * Returns NULL if no active deployment exists.
 */
CREATE OR REPLACE FUNCTION get_active_deployment(
    p_agent_id UUID,
    p_environment TEXT DEFAULT 'prod'
)
RETURNS TABLE (
    id UUID,
    version INTEGER,
    environment TEXT,
    status TEXT,
    config_snapshot JSONB,
    flow_snapshot JSONB,
    claw_snapshot JSONB,
    endpoint_url TEXT,
    deployed_by TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.version,
        d.environment,
        d.status,
        d.config_snapshot,
        d.flow_snapshot,
        d.claw_snapshot,
        d.endpoint_url,
        d.deployed_by,
        d.is_active,
        d.created_at
    FROM deployments d
    WHERE d.agent_id = p_agent_id
        AND d.environment = p_environment
        AND d.is_active = true
        AND d.status = 'running'
    ORDER BY d.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

/**
 * Deactivate all deployments for an agent in a specific environment.
 * Used before creating a new deployment to ensure only one is active.
 */
CREATE OR REPLACE FUNCTION deactivate_environment_deployments(
    p_agent_id UUID,
    p_environment TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    WITH updated AS (
        UPDATE deployments
        SET
            is_active = false,
            stopped_at = COALESCE(stopped_at, NOW()),
            status = CASE
                WHEN status = 'running' THEN 'stopped'
                ELSE status
            END
        WHERE agent_id = p_agent_id
            AND environment = p_environment
            AND is_active = true
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_updated FROM updated;

    RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

/**
 * Create a new deployment from a rollback.
 * Copies config from the source deployment.
 */
CREATE OR REPLACE FUNCTION create_rollback_deployment(
    p_source_deployment_id UUID,
    p_deployed_by TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_source deployments%ROWTYPE;
    v_new_id UUID;
    v_new_version INTEGER;
BEGIN
    -- Get source deployment
    SELECT * INTO v_source
    FROM deployments
    WHERE id = p_source_deployment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source deployment not found: %', p_source_deployment_id;
    END IF;

    -- Deactivate current deployments in same environment
    PERFORM deactivate_environment_deployments(v_source.agent_id, v_source.environment);

    -- Get new version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM deployments
    WHERE agent_id = v_source.agent_id;

    -- Create new deployment as rollback
    INSERT INTO deployments (
        agent_id,
        version,
        environment,
        status,
        config_snapshot,
        flow_snapshot,
        claw_snapshot,
        endpoint_url,
        deployed_by,
        rollback_from,
        notes,
        is_active
    ) VALUES (
        v_source.agent_id,
        v_new_version,
        v_source.environment,
        'running',
        v_source.config_snapshot,
        v_source.flow_snapshot,
        v_source.claw_snapshot,
        v_source.endpoint_url,
        p_deployed_by,
        p_source_deployment_id,
        COALESCE(p_notes, 'Rollback from deployment v' || v_source.version),
        true
    )
    RETURNING id INTO v_new_id;

    -- Update agent version
    UPDATE agents
    SET version = v_new_version, updated_at = NOW()
    WHERE id = v_source.agent_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Promote a deployment from one environment to another.
 * Typically used for staging -> prod workflow.
 */
CREATE OR REPLACE FUNCTION promote_deployment(
    p_source_deployment_id UUID,
    p_target_environment TEXT,
    p_deployed_by TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_source deployments%ROWTYPE;
    v_new_id UUID;
    v_new_version INTEGER;
    v_endpoint_url TEXT;
BEGIN
    -- Get source deployment
    SELECT * INTO v_source
    FROM deployments
    WHERE id = p_source_deployment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Source deployment not found: %', p_source_deployment_id;
    END IF;

    -- Validate promotion path
    IF v_source.environment = 'prod' THEN
        RAISE EXCEPTION 'Cannot promote from prod environment';
    END IF;

    IF p_target_environment = 'dev' THEN
        RAISE EXCEPTION 'Cannot promote to dev environment';
    END IF;

    IF v_source.environment = p_target_environment THEN
        RAISE EXCEPTION 'Source and target environments must be different';
    END IF;

    -- Deactivate current deployments in target environment
    PERFORM deactivate_environment_deployments(v_source.agent_id, p_target_environment);

    -- Get new version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM deployments
    WHERE agent_id = v_source.agent_id;

    -- Keep same endpoint URL structure (environment doesn't change URL)
    v_endpoint_url := v_source.endpoint_url;

    -- Create new deployment as promotion
    INSERT INTO deployments (
        agent_id,
        version,
        environment,
        status,
        config_snapshot,
        flow_snapshot,
        claw_snapshot,
        endpoint_url,
        deployed_by,
        promoted_from,
        notes,
        is_active
    ) VALUES (
        v_source.agent_id,
        v_new_version,
        p_target_environment,
        'running',
        v_source.config_snapshot,
        v_source.flow_snapshot,
        v_source.claw_snapshot,
        v_endpoint_url,
        p_deployed_by,
        p_source_deployment_id,
        COALESCE(p_notes, 'Promoted from ' || v_source.environment || ' v' || v_source.version),
        true
    )
    RETURNING id INTO v_new_id;

    -- Update agent version and status
    UPDATE agents
    SET
        version = v_new_version,
        status = CASE
            WHEN p_target_environment = 'prod' THEN 'deployed'
            ELSE status
        END,
        updated_at = NOW()
    WHERE id = v_source.agent_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql;

/**
 * Get deployment statistics per environment for an agent.
 */
CREATE OR REPLACE FUNCTION get_deployment_stats(p_agent_id UUID)
RETURNS TABLE (
    environment TEXT,
    total_deployments BIGINT,
    active_deployment_id UUID,
    active_version INTEGER,
    last_deployment_at TIMESTAMPTZ,
    rollback_count BIGINT,
    promote_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.environment,
        COUNT(*) AS total_deployments,
        (
            SELECT id FROM deployments
            WHERE agent_id = p_agent_id
                AND environment = d.environment
                AND is_active = true
                AND status = 'running'
            LIMIT 1
        ) AS active_deployment_id,
        (
            SELECT version FROM deployments
            WHERE agent_id = p_agent_id
                AND environment = d.environment
                AND is_active = true
                AND status = 'running'
            LIMIT 1
        ) AS active_version,
        MAX(d.created_at) AS last_deployment_at,
        COUNT(*) FILTER (WHERE d.rollback_from IS NOT NULL) AS rollback_count,
        COUNT(*) FILTER (WHERE d.promoted_from IS NOT NULL) AS promote_count
    FROM deployments d
    WHERE d.agent_id = p_agent_id
    GROUP BY d.environment
    ORDER BY
        CASE d.environment
            WHEN 'prod' THEN 1
            WHEN 'staging' THEN 2
            WHEN 'dev' THEN 3
        END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE EXISTING DATA
-- ============================================

-- Set environment to 'prod' for any existing deployments without environment
UPDATE deployments
SET environment = 'prod'
WHERE environment IS NULL;

-- Set is_active based on status for existing deployments
UPDATE deployments
SET is_active = (status = 'running')
WHERE is_active IS NULL;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON COLUMN deployments.environment IS 'Deployment environment: dev, staging, or prod';
COMMENT ON COLUMN deployments.deployed_by IS 'Wallet address of user who created this deployment';
COMMENT ON COLUMN deployments.rollback_from IS 'Reference to deployment this was rolled back from';
COMMENT ON COLUMN deployments.promoted_from IS 'Reference to deployment this was promoted from';
COMMENT ON COLUMN deployments.flow_snapshot IS 'Snapshot of flow definition at deployment time';
COMMENT ON COLUMN deployments.claw_snapshot IS 'Snapshot of claw config at deployment time';
COMMENT ON COLUMN deployments.notes IS 'Optional deployment notes or comments';
COMMENT ON COLUMN deployments.is_active IS 'Whether this is the active deployment for its environment';

COMMENT ON FUNCTION get_deployment_history IS 'Get paginated deployment history for an agent';
COMMENT ON FUNCTION get_deployment_history_count IS 'Get total deployment count for pagination';
COMMENT ON FUNCTION get_active_deployment IS 'Get current active deployment for an environment';
COMMENT ON FUNCTION deactivate_environment_deployments IS 'Deactivate all deployments in an environment';
COMMENT ON FUNCTION create_rollback_deployment IS 'Create a new deployment by rolling back to a previous one';
COMMENT ON FUNCTION promote_deployment IS 'Promote a deployment from one environment to another';
COMMENT ON FUNCTION get_deployment_stats IS 'Get deployment statistics per environment';
