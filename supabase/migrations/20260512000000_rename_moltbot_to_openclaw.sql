-- Migration: Rename moltbot framework to openclaw
-- Date: 2026-05-12
-- Description: @guardianclaw/moltbot has been rebranded to @guardianclaw/openclaw
--              (no API change, version bumped 1.0.0 -> 3.0.0-rc.1). This migration:
--                1. Recreates validate_integration_config with 'openclaw' replacing 'moltbot'
--                2. Updates the documenting COMMENT on agents.integration_config
--                3. Renames any existing 'moltbot' keys inside integration_config JSONB
--                4. Updates any agents.framework='moltbot' rows to 'openclaw'

-- ============================================
-- DATA MIGRATION: rename framework column values
-- ============================================

UPDATE agents
SET framework = 'openclaw'
WHERE framework = 'moltbot';

-- ============================================
-- DATA MIGRATION: rename JSONB keys inside integration_config
-- ============================================

UPDATE agents
SET integration_config = (integration_config - 'moltbot') ||
                         jsonb_build_object('openclaw', integration_config -> 'moltbot')
WHERE integration_config ? 'moltbot';

-- ============================================
-- UPDATE COMMENT
-- ============================================

COMMENT ON COLUMN agents.integration_config IS
'Framework-specific integration configuration. Structure varies by framework:
- coinbase: {spending_limits, blocklist, fiduciary_enabled}
- solana_agent_kit: {spending_limits, fiduciary_enabled, memory_integrity_check}
- openai_agents: {guardrail_model, require_all_gates}
- google_adk: {validate_tools, fail_closed}
- virtuals: {memory_integrity_check, blocked_functions}
- openclaw: {protection_level, hooks_enabled}
- voltagent: {owasp_checks, pii_guard}
- elizaos: {memory_hmac, content_validation}
- custom: any application-specific config';

-- ============================================
-- RECREATE validate_integration_config WITH NEW FRAMEWORK LIST
-- ============================================

CREATE OR REPLACE FUNCTION validate_integration_config()
RETURNS TRIGGER AS $$
DECLARE
    framework_key TEXT;
    valid_frameworks TEXT[] := ARRAY[
        'coinbase', 'solana_agent_kit', 'openai_agents',
        'google_adk', 'virtuals', 'openclaw', 'voltagent',
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
    leftover_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO leftover_count
    FROM agents
    WHERE framework = 'moltbot' OR integration_config ? 'moltbot';

    IF leftover_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % rows still reference moltbot', leftover_count;
    END IF;

    RAISE NOTICE 'Migration successful: moltbot framework renamed to openclaw across data + validation function';
END $$;
