-- Migration: Rename moltbot framework to openclaw
-- Date: 2026-04-22
-- Description: Upstream renamed moltbot -> openclaw. Update validator function,
--              column comment, and migrate existing rows.

-- ============================================
-- MIGRATE EXISTING ROWS
-- ============================================

UPDATE agents
SET framework = 'openclaw'
WHERE framework = 'moltbot';

UPDATE agents
SET integration_config = (integration_config - 'moltbot') || jsonb_build_object('openclaw', integration_config -> 'moltbot')
WHERE integration_config ? 'moltbot';

-- ============================================
-- UPDATE integration_config COMMENT
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
-- UPDATE validate_integration_config FUNCTION
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
    IF NEW.integration_config IS NULL OR NEW.integration_config = '{}'::JSONB THEN
        RETURN NEW;
    END IF;

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
    legacy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO legacy_count FROM agents WHERE framework = 'moltbot';
    IF legacy_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % agents still have framework=moltbot', legacy_count;
    END IF;

    SELECT COUNT(*) INTO legacy_count FROM agents WHERE integration_config ? 'moltbot';
    IF legacy_count > 0 THEN
        RAISE EXCEPTION 'Migration failed: % agents still have moltbot key in integration_config', legacy_count;
    END IF;

    RAISE NOTICE 'Migration successful: moltbot -> openclaw rename complete';
END $$;
