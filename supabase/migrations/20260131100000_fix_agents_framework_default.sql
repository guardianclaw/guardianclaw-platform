-- Migration: Fix agents.framework default and update valid frameworks list
-- Date: 2026-01-31
-- Description: langchain, crewai, ros2, isaac_lab were removed as public integrations.
--              Update the column default and the validation function accordingly.

-- ============================================
-- FIX framework DEFAULT
-- ============================================

-- Change default from 'langchain' (removed) to 'custom' (neutral default for
-- agents that don't map to a specific supported integration)
ALTER TABLE agents
ALTER COLUMN framework SET DEFAULT 'custom';

-- ============================================
-- UPDATE integration_config COMMENT
-- ============================================

-- Remove references to removed integrations from column documentation
COMMENT ON COLUMN agents.integration_config IS
'Framework-specific integration configuration. Structure varies by framework:
- coinbase: {spending_limits, blocklist, fiduciary_enabled}
- solana_agent_kit: {spending_limits, fiduciary_enabled, memory_integrity_check}
- openai_agents: {guardrail_model, require_all_gates}
- google_adk: {validate_tools, fail_closed}
- virtuals: {memory_integrity_check, blocked_functions}
- moltbot: {protection_level, hooks_enabled}
- voltagent: {owasp_checks, pii_guard}
- elizaos: {memory_hmac, content_validation}
- custom: any application-specific config';

-- ============================================
-- UPDATE validate_integration_config FUNCTION
-- ============================================

-- Recreate the trigger function with the current list of supported frameworks.
-- langchain, crewai, ros2, and isaac_lab are no longer public integrations.
CREATE OR REPLACE FUNCTION validate_integration_config()
RETURNS TRIGGER AS $$
DECLARE
    framework_key TEXT;
    valid_frameworks TEXT[] := ARRAY[
        'coinbase', 'solana_agent_kit', 'openai_agents',
        'google_adk', 'virtuals', 'moltbot', 'voltagent',
        'elizaos', 'anthropic_sdk', 'mcp_server', 'custom'
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

-- ============================================
-- VERIFICATION
-- ============================================

DO $$
DECLARE
    col_default TEXT;
BEGIN
    SELECT column_default
    INTO col_default
    FROM information_schema.columns
    WHERE table_name = 'agents'
    AND column_name = 'framework';

    IF col_default NOT LIKE '%custom%' THEN
        RAISE EXCEPTION 'Migration failed: framework default not updated. Got: %', col_default;
    END IF;

    RAISE NOTICE 'Migration successful: agents.framework DEFAULT changed to ''custom''';
END $$;
