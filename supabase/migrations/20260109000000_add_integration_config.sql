-- Migration: Add integration_config to agents table
-- Version: 3.1
-- Date: 2026-01-09
-- Description: Adds integration_config JSONB column to store framework-specific
--              configurations for SDK integrations (LangChain, Coinbase, etc.)

-- ============================================
-- ADD INTEGRATION_CONFIG COLUMN
-- ============================================

-- Add the column with default empty object
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS integration_config JSONB DEFAULT '{}';

-- Add comment explaining the purpose
COMMENT ON COLUMN agents.integration_config IS
'Framework-specific integration configuration. Structure varies by framework:
- langchain: {seed_level, on_violation, inject_seed}
- coinbase: {spending_limits, blocklist, fiduciary_enabled}
- solana_agent_kit: {spending_limits, fiduciary_enabled, memory_integrity_check}
- openai_agents: {guardrail_model, require_all_gates}
- crewai: {agents[], tasks[], injection_method}
- google_adk: {validate_tools, fail_closed}
- virtuals: {memory_integrity_check, blocked_functions}
- ros2: {velocity_limits, safety_zone} (config export only)
- isaac_lab: {workspace, collision_zones} (config export only)';

-- ============================================
-- INDEXES
-- ============================================

-- Index for framework filtering (useful for analytics)
CREATE INDEX IF NOT EXISTS idx_agents_framework
ON agents(framework);

-- GIN index for JSONB queries on integration_config
-- Allows efficient queries like: WHERE integration_config @> '{"langchain": {"seed_level": "full"}}'
CREATE INDEX IF NOT EXISTS idx_agents_integration_config
ON agents USING GIN (integration_config);

-- ============================================
-- VALIDATION FUNCTION
-- ============================================

-- Function to validate integration_config structure
-- Note: This is a soft validation - it warns but doesn't block
CREATE OR REPLACE FUNCTION validate_integration_config()
RETURNS TRIGGER AS $$
DECLARE
    framework_key TEXT;
    valid_frameworks TEXT[] := ARRAY[
        'langchain', 'coinbase', 'solana_agent_kit',
        'openai_agents', 'crewai', 'google_adk',
        'virtuals', 'ros2', 'isaac_lab'
    ];
BEGIN
    -- Skip validation if integration_config is empty or null
    IF NEW.integration_config IS NULL OR NEW.integration_config = '{}'::JSONB THEN
        RETURN NEW;
    END IF;

    -- Check that integration_config keys match valid frameworks
    FOR framework_key IN SELECT jsonb_object_keys(NEW.integration_config)
    LOOP
        IF NOT framework_key = ANY(valid_frameworks) THEN
            RAISE WARNING 'Unknown framework key in integration_config: %. Valid keys: %',
                framework_key, valid_frameworks;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation (only on INSERT/UPDATE)
DROP TRIGGER IF EXISTS validate_integration_config_trigger ON agents;
CREATE TRIGGER validate_integration_config_trigger
    BEFORE INSERT OR UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION validate_integration_config();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get integration config for a specific framework
CREATE OR REPLACE FUNCTION get_integration_config(
    p_agent_id UUID,
    p_framework TEXT
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT integration_config -> p_framework
    INTO result
    FROM agents
    WHERE id = p_agent_id;

    RETURN COALESCE(result, '{}'::JSONB);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to update integration config for a specific framework
-- Merges with existing config rather than replacing
CREATE OR REPLACE FUNCTION update_integration_config(
    p_agent_id UUID,
    p_framework TEXT,
    p_config JSONB
)
RETURNS JSONB AS $$
DECLARE
    current_config JSONB;
    new_config JSONB;
BEGIN
    -- Get current integration_config
    SELECT integration_config
    INTO current_config
    FROM agents
    WHERE id = p_agent_id;

    -- Merge the new config
    new_config := COALESCE(current_config, '{}'::JSONB) ||
                  jsonb_build_object(p_framework, p_config);

    -- Update the agent
    UPDATE agents
    SET integration_config = new_config
    WHERE id = p_agent_id;

    RETURN new_config;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES (inherit from agents table)
-- ============================================

-- No additional RLS needed - integration_config inherits
-- the existing agents table RLS policies

-- ============================================
-- MIGRATION VERIFICATION
-- ============================================

-- Verify the column was added
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'agents'
        AND column_name = 'integration_config'
    ) THEN
        RAISE EXCEPTION 'Migration failed: integration_config column not created';
    END IF;

    RAISE NOTICE 'Migration successful: integration_config column added to agents table';
END $$;
