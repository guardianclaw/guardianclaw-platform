-- Migration: Admin System Config + Audit Viewer
-- Date: 2026-01-22
-- Sprint: 4
-- Description: Platform configuration, feature flags, maintenance windows, and audit log viewer RPCs

-- ============================================
-- 1. PLATFORM CONFIG TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS platform_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  is_sensitive BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_platform_config_category ON platform_config(category);

COMMENT ON TABLE platform_config IS 'Platform-wide configuration as key-value pairs';
COMMENT ON COLUMN platform_config.category IS 'Grouping: general, pricing, limits, security';
COMMENT ON COLUMN platform_config.is_sensitive IS 'If true, value is redacted in API responses';

-- Default config values
INSERT INTO platform_config (key, value, description, category, is_sensitive) VALUES
  ('rate_limits.default', '{"requests_per_minute": 100}', 'Default rate limit for unauthenticated users', 'limits', false),
  ('rate_limits.authenticated', '{"requests_per_minute": 200}', 'Rate limit for authenticated users', 'limits', false),
  ('rate_limits.pro', '{"requests_per_minute": 500}', 'Rate limit for pro users', 'limits', false),
  ('pricing.cost_per_execution', '{"usd": 0.003}', 'Cost per agent execution', 'pricing', false),
  ('pricing.min_deposit', '{"usd": 3.00}', 'Minimum deposit amount', 'pricing', false),
  ('pricing.claw_bonus', '{"percentage": 20}', 'Bonus for $claw token deposits', 'pricing', false),
  ('security.max_agents_per_user', '{"free": 3, "starter": 10, "pro": 50}', 'Agent limits by plan', 'limits', false),
  ('security.session_timeout', '{"hours": 24}', 'Session timeout duration', 'security', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 2. FEATURE FLAGS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage INTEGER DEFAULT 0 CHECK (rollout_percentage BETWEEN 0 AND 100),
  conditions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled) WHERE is_enabled = true;

COMMENT ON TABLE feature_flags IS 'Feature flags with gradual rollout support';
COMMENT ON COLUMN feature_flags.rollout_percentage IS '0-100, percentage of users to enable for';
COMMENT ON COLUMN feature_flags.conditions IS 'Targeting rules: {"plans": [], "wallets": []}';

-- Default feature flags
INSERT INTO feature_flags (id, name, description, is_enabled, rollout_percentage) VALUES
  ('governance_v2', 'Governance V2', 'New governance UI with improved UX', false, 0),
  ('analytics_v2', 'Analytics V2', 'Enhanced analytics with template-specific metrics', true, 100),
  ('multi_turn', 'Multi-turn Support', 'Multi-turn conversation in agents', true, 100),
  ('compliance_checker', 'Compliance Checker', 'Universal compliance validation', true, 100),
  ('credits_system', 'Credits System', 'Pay-per-use credits system', true, 100)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 3. MAINTENANCE WINDOWS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS maintenance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  show_banner BOOLEAN DEFAULT TRUE,
  affects_services TEXT[] DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_window CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_active ON maintenance_windows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_starts ON maintenance_windows(starts_at DESC);

COMMENT ON TABLE maintenance_windows IS 'Scheduled maintenance periods';
COMMENT ON COLUMN maintenance_windows.affects_services IS 'Services affected: api, web, runtime, etc.';

-- ============================================
-- 4. RLS POLICIES
-- ============================================

ALTER TABLE platform_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_windows ENABLE ROW LEVEL SECURITY;

-- Service role has full access (admin API uses service role)

-- ============================================
-- 5. SYSTEM CONFIG RPCs
-- ============================================

-- 5.1 Get all config (with sensitive value redaction)
CREATE OR REPLACE FUNCTION admin_get_system_config()
RETURNS TABLE(
  key TEXT,
  value JSONB,
  description TEXT,
  category TEXT,
  is_sensitive BOOLEAN,
  updated_at TIMESTAMPTZ,
  updated_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.key,
    CASE WHEN pc.is_sensitive THEN '"[REDACTED]"'::JSONB ELSE pc.value END as value,
    pc.description,
    pc.category,
    pc.is_sensitive,
    pc.updated_at,
    pc.updated_by
  FROM platform_config pc
  ORDER BY pc.category, pc.key;
END;
$$;

COMMENT ON FUNCTION admin_get_system_config IS 'Get all platform configuration with sensitive values redacted';

-- 5.2 Update config value
CREATE OR REPLACE FUNCTION admin_update_config(
  p_key TEXT,
  p_value JSONB,
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  key TEXT,
  value JSONB,
  updated_at TIMESTAMPTZ,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM platform_config WHERE platform_config.key = p_key) INTO v_exists;

  IF NOT v_exists THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::JSONB, NULL::TIMESTAMPTZ, 'CONFIG_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  UPDATE platform_config
  SET value = p_value, updated_at = NOW(), updated_by = p_admin_hash
  WHERE platform_config.key = p_key;

  RETURN QUERY
  SELECT true, p_key, p_value, NOW()::TIMESTAMPTZ, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_update_config IS 'Update a platform configuration value';

-- ============================================
-- 6. FEATURE FLAGS RPCs
-- ============================================

-- 6.1 List all feature flags
CREATE OR REPLACE FUNCTION admin_list_feature_flags()
RETURNS TABLE(
  id TEXT,
  name TEXT,
  description TEXT,
  is_enabled BOOLEAN,
  rollout_percentage INTEGER,
  conditions JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  updated_by TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ff.id,
    ff.name,
    ff.description,
    ff.is_enabled,
    ff.rollout_percentage,
    ff.conditions,
    ff.created_at,
    ff.updated_at,
    ff.updated_by
  FROM feature_flags ff
  ORDER BY ff.name;
END;
$$;

COMMENT ON FUNCTION admin_list_feature_flags IS 'List all feature flags';

-- 6.2 Update feature flag
CREATE OR REPLACE FUNCTION admin_update_feature_flag(
  p_id TEXT,
  p_is_enabled BOOLEAN,
  p_rollout_percentage INTEGER,
  p_conditions JSONB,
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  id TEXT,
  is_enabled BOOLEAN,
  rollout_percentage INTEGER,
  updated_at TIMESTAMPTZ,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM feature_flags WHERE feature_flags.id = p_id) INTO v_exists;

  IF NOT v_exists THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::BOOLEAN, NULL::INTEGER, NULL::TIMESTAMPTZ, 'FLAG_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  UPDATE feature_flags
  SET
    is_enabled = p_is_enabled,
    rollout_percentage = p_rollout_percentage,
    conditions = COALESCE(p_conditions, feature_flags.conditions),
    updated_at = NOW(),
    updated_by = p_admin_hash
  WHERE feature_flags.id = p_id;

  RETURN QUERY
  SELECT true, p_id, p_is_enabled, p_rollout_percentage, NOW()::TIMESTAMPTZ, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_update_feature_flag IS 'Update a feature flag';

-- ============================================
-- 7. MAINTENANCE WINDOWS RPCs
-- ============================================

-- 7.1 List maintenance windows
CREATE OR REPLACE FUNCTION admin_list_maintenance_windows()
RETURNS TABLE(
  id UUID,
  title TEXT,
  description TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN,
  show_banner BOOLEAN,
  affects_services TEXT[],
  created_by TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    mw.id,
    mw.title,
    mw.description,
    mw.starts_at,
    mw.ends_at,
    mw.is_active,
    mw.show_banner,
    mw.affects_services,
    mw.created_by,
    mw.created_at
  FROM maintenance_windows mw
  ORDER BY mw.starts_at DESC;
END;
$$;

COMMENT ON FUNCTION admin_list_maintenance_windows IS 'List all maintenance windows';

-- 7.2 Create maintenance window
CREATE OR REPLACE FUNCTION admin_create_maintenance_window(
  p_title TEXT,
  p_description TEXT,
  p_starts_at TIMESTAMPTZ,
  p_ends_at TIMESTAMPTZ,
  p_show_banner BOOLEAN,
  p_affects_services TEXT[],
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  id UUID,
  created_at TIMESTAMPTZ,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_ends_at <= p_starts_at THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, 'INVALID_TIME_RANGE'::TEXT;
    RETURN;
  END IF;

  INSERT INTO maintenance_windows (title, description, starts_at, ends_at, show_banner, affects_services, created_by)
  VALUES (p_title, p_description, p_starts_at, p_ends_at, p_show_banner, p_affects_services, p_admin_hash)
  RETURNING maintenance_windows.id INTO v_id;

  RETURN QUERY SELECT true, v_id, NOW()::TIMESTAMPTZ, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_create_maintenance_window IS 'Create a new maintenance window';

-- 7.3 Delete maintenance window
CREATE OR REPLACE FUNCTION admin_delete_maintenance_window(
  p_id UUID,
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM maintenance_windows WHERE maintenance_windows.id = p_id) INTO v_exists;

  IF NOT v_exists THEN
    RETURN QUERY SELECT false, 'WINDOW_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  DELETE FROM maintenance_windows WHERE maintenance_windows.id = p_id;

  RETURN QUERY SELECT true, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_delete_maintenance_window IS 'Delete a maintenance window';

-- 7.4 Toggle maintenance window active status
CREATE OR REPLACE FUNCTION admin_toggle_maintenance_window(
  p_id UUID,
  p_is_active BOOLEAN,
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  is_active BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  SELECT EXISTS(SELECT 1 FROM maintenance_windows WHERE maintenance_windows.id = p_id) INTO v_exists;

  IF NOT v_exists THEN
    RETURN QUERY SELECT false, NULL::BOOLEAN, 'WINDOW_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  UPDATE maintenance_windows
  SET is_active = p_is_active
  WHERE maintenance_windows.id = p_id;

  RETURN QUERY SELECT true, p_is_active, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_toggle_maintenance_window IS 'Toggle maintenance window active status';

-- ============================================
-- 8. AUDIT LOG RPCs
-- ============================================

-- 8.1 Get audit statistics
CREATE OR REPLACE FUNCTION admin_get_audit_stats()
RETURNS TABLE(
  total_entries BIGINT,
  entries_24h BIGINT,
  entries_7d BIGINT,
  entries_30d BIGINT,
  unique_admins BIGINT,
  by_action_type JSONB,
  by_target_type JSONB,
  by_status_code JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM admin_audit_log)::BIGINT as total_entries,
    (SELECT COUNT(*) FROM admin_audit_log WHERE created_at > NOW() - INTERVAL '24 hours')::BIGINT as entries_24h,
    (SELECT COUNT(*) FROM admin_audit_log WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT as entries_7d,
    (SELECT COUNT(*) FROM admin_audit_log WHERE created_at > NOW() - INTERVAL '30 days')::BIGINT as entries_30d,
    (SELECT COUNT(DISTINCT admin_wallet_hash) FROM admin_audit_log)::BIGINT as unique_admins,
    COALESCE(
      (SELECT jsonb_object_agg(method, cnt) FROM (
        SELECT SPLIT_PART(action, ' ', 1) as method, COUNT(*)::INTEGER as cnt
        FROM admin_audit_log
        GROUP BY SPLIT_PART(action, ' ', 1)
      ) m),
      '{}'::jsonb
    ) as by_action_type,
    COALESCE(
      (SELECT jsonb_object_agg(target_type, cnt)
       FROM (SELECT target_type, COUNT(*)::INTEGER as cnt FROM admin_audit_log WHERE target_type IS NOT NULL GROUP BY target_type) t),
      '{}'::jsonb
    ) as by_target_type,
    COALESCE(
      (SELECT jsonb_object_agg(status_code::TEXT, cnt)
       FROM (SELECT status_code, COUNT(*)::INTEGER as cnt FROM admin_audit_log GROUP BY status_code) s),
      '{}'::jsonb
    ) as by_status_code;
END;
$$;

COMMENT ON FUNCTION admin_get_audit_stats IS 'Get audit log statistics';

-- 8.2 List audit logs with filters
CREATE OR REPLACE FUNCTION admin_list_audit_logs(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_admin_hash TEXT DEFAULT NULL,
  p_action_prefix TEXT DEFAULT NULL,
  p_target_type TEXT DEFAULT NULL,
  p_status_code INTEGER DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_order_by TEXT DEFAULT 'created_at',
  p_order_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE(
  id UUID,
  admin_wallet_hash TEXT,
  action TEXT,
  target_type TEXT,
  target_id TEXT,
  details JSONB,
  ip_hash TEXT,
  request_id TEXT,
  status_code INTEGER,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total count with filters
  SELECT COUNT(*) INTO v_total
  FROM admin_audit_log a
  WHERE
    (p_admin_hash IS NULL OR a.admin_wallet_hash = p_admin_hash)
    AND (p_action_prefix IS NULL OR a.action LIKE p_action_prefix || '%')
    AND (p_target_type IS NULL OR a.target_type = p_target_type)
    AND (p_status_code IS NULL OR a.status_code = p_status_code)
    AND (p_start_date IS NULL OR a.created_at >= p_start_date)
    AND (p_end_date IS NULL OR a.created_at <= p_end_date);

  RETURN QUERY
  SELECT
    a.id,
    a.admin_wallet_hash,
    a.action,
    a.target_type,
    a.target_id,
    a.details,
    a.ip_hash,
    a.request_id,
    a.status_code,
    a.created_at,
    v_total as total_count
  FROM admin_audit_log a
  WHERE
    (p_admin_hash IS NULL OR a.admin_wallet_hash = p_admin_hash)
    AND (p_action_prefix IS NULL OR a.action LIKE p_action_prefix || '%')
    AND (p_target_type IS NULL OR a.target_type = p_target_type)
    AND (p_status_code IS NULL OR a.status_code = p_status_code)
    AND (p_start_date IS NULL OR a.created_at >= p_start_date)
    AND (p_end_date IS NULL OR a.created_at <= p_end_date)
  ORDER BY
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'desc' THEN a.created_at END DESC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'asc' THEN a.created_at END ASC,
    CASE WHEN p_order_by = 'action' AND p_order_dir = 'desc' THEN a.action END DESC,
    CASE WHEN p_order_by = 'action' AND p_order_dir = 'asc' THEN a.action END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_list_audit_logs IS 'List audit logs with filtering and pagination';

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Check if a feature flag is enabled for a user
CREATE OR REPLACE FUNCTION is_feature_enabled(
  p_flag_id TEXT,
  p_wallet_address TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_flag feature_flags;
  v_conditions JSONB;
  v_wallets TEXT[];
  v_plans TEXT[];
BEGIN
  SELECT * INTO v_flag FROM feature_flags WHERE id = p_flag_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF NOT v_flag.is_enabled THEN
    RETURN false;
  END IF;

  v_conditions := v_flag.conditions;

  -- Check wallet targeting
  IF v_conditions ? 'wallets' AND jsonb_array_length(v_conditions->'wallets') > 0 THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_conditions->'wallets')) INTO v_wallets;
    IF p_wallet_address IS NOT NULL AND p_wallet_address = ANY(v_wallets) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check plan targeting
  IF v_conditions ? 'plans' AND jsonb_array_length(v_conditions->'plans') > 0 THEN
    SELECT ARRAY(SELECT jsonb_array_elements_text(v_conditions->'plans')) INTO v_plans;
    IF p_plan IS NOT NULL AND p_plan = ANY(v_plans) THEN
      RETURN true;
    END IF;
  END IF;

  -- Check rollout percentage (simple hash-based)
  IF v_flag.rollout_percentage >= 100 THEN
    RETURN true;
  END IF;

  IF v_flag.rollout_percentage <= 0 THEN
    RETURN false;
  END IF;

  -- If no specific targeting and rollout > 0, use percentage
  IF p_wallet_address IS NOT NULL THEN
    RETURN (abs(hashtext(p_wallet_address)) % 100) < v_flag.rollout_percentage;
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION is_feature_enabled IS 'Check if a feature flag is enabled for a user';

-- Get current maintenance status
CREATE OR REPLACE FUNCTION get_maintenance_status()
RETURNS TABLE(
  is_maintenance BOOLEAN,
  current_window maintenance_windows,
  next_window maintenance_windows
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_current maintenance_windows;
  v_next maintenance_windows;
BEGIN
  -- Find current active window
  SELECT * INTO v_current
  FROM maintenance_windows
  WHERE is_active = true
    AND starts_at <= NOW()
    AND ends_at >= NOW()
  ORDER BY starts_at
  LIMIT 1;

  -- Find next scheduled window
  SELECT * INTO v_next
  FROM maintenance_windows
  WHERE starts_at > NOW()
  ORDER BY starts_at
  LIMIT 1;

  RETURN QUERY
  SELECT
    v_current IS NOT NULL as is_maintenance,
    v_current as current_window,
    v_next as next_window;
END;
$$;

COMMENT ON FUNCTION get_maintenance_status IS 'Get current maintenance status and upcoming windows';
