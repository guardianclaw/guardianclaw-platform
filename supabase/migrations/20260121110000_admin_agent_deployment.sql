-- Admin Agent & Deployment Extensions Migration
-- claw Platform v3.0
-- Date: 2026-01-21
-- Description: Admin-level agent and deployment management (Sprint 2)

-- ============================================
-- 0. ENABLE REQUIRED EXTENSIONS
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- 1. AGENT SUSPENSION FIELDS
-- ============================================
ALTER TABLE agents ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS suspended_by TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

COMMENT ON COLUMN agents.is_suspended IS 'Whether the agent is suspended by admin';
COMMENT ON COLUMN agents.suspended_at IS 'When the agent was suspended';
COMMENT ON COLUMN agents.suspended_by IS 'Admin wallet hash who suspended the agent';
COMMENT ON COLUMN agents.suspension_reason IS 'Reason for suspension';

-- ============================================
-- 2. DEPLOYMENT SUSPENSION & RATE LIMIT FIELDS
-- ============================================
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS suspended_by TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS rate_limit_override INTEGER;

COMMENT ON COLUMN deployments.is_suspended IS 'Whether the deployment is suspended by admin';
COMMENT ON COLUMN deployments.suspended_at IS 'When the deployment was suspended';
COMMENT ON COLUMN deployments.suspended_by IS 'Admin wallet hash who suspended the deployment';
COMMENT ON COLUMN deployments.suspension_reason IS 'Reason for suspension';
COMMENT ON COLUMN deployments.rate_limit_override IS 'Custom rate limit override (requests per minute)';

-- ============================================
-- 3. INDEXES FOR AGENT MANAGEMENT
-- ============================================
CREATE INDEX IF NOT EXISTS idx_agents_name_trgm ON agents USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_agents_framework ON agents(framework);
CREATE INDEX IF NOT EXISTS idx_agents_suspended ON agents(is_suspended) WHERE is_suspended = true;
CREATE INDEX IF NOT EXISTS idx_agents_wallet_status ON agents(wallet_address, status);
CREATE INDEX IF NOT EXISTS idx_agents_created ON agents(created_at DESC);

-- ============================================
-- 4. INDEXES FOR DEPLOYMENT MANAGEMENT
-- ============================================
CREATE INDEX IF NOT EXISTS idx_deployments_agent ON deployments(agent_id);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment);
CREATE INDEX IF NOT EXISTS idx_deployments_suspended ON deployments(is_suspended) WHERE is_suspended = true;
CREATE INDEX IF NOT EXISTS idx_deployments_active ON deployments(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_deployments_created ON deployments(created_at DESC);

-- ============================================
-- 5. RPC: GET AGENTS STATS (ADMIN)
-- Platform-wide agent statistics
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_agents_stats()
RETURNS TABLE(
  total_agents BIGINT,
  active_agents BIGINT,
  suspended_agents BIGINT,
  by_framework JSONB,
  by_status JSONB,
  created_7d BIGINT,
  created_30d BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_agents,
    COUNT(*) FILTER (WHERE NOT COALESCE(a.is_suspended, false) AND a.status = 'deployed')::BIGINT as active_agents,
    COUNT(*) FILTER (WHERE COALESCE(a.is_suspended, false))::BIGINT as suspended_agents,
    COALESCE(
      jsonb_object_agg(fw.framework, fw.count) FILTER (WHERE fw.framework IS NOT NULL),
      '{}'::jsonb
    ) as by_framework,
    COALESCE(
      jsonb_object_agg(st.status, st.count) FILTER (WHERE st.status IS NOT NULL),
      '{}'::jsonb
    ) as by_status,
    COUNT(*) FILTER (WHERE a.created_at > NOW() - INTERVAL '7 days')::BIGINT as created_7d,
    COUNT(*) FILTER (WHERE a.created_at > NOW() - INTERVAL '30 days')::BIGINT as created_30d
  FROM agents a
  LEFT JOIN LATERAL (
    SELECT a2.framework, COUNT(*)::INTEGER as count
    FROM agents a2
    WHERE a2.framework = a.framework
    GROUP BY a2.framework
  ) fw ON true
  LEFT JOIN LATERAL (
    SELECT a3.status, COUNT(*)::INTEGER as count
    FROM agents a3
    WHERE a3.status = a.status
    GROUP BY a3.status
  ) st ON true;
END;
$$;

COMMENT ON FUNCTION admin_get_agents_stats IS 'Platform-wide agent statistics for admin dashboard';

-- ============================================
-- 6. RPC: LIST AGENTS (ADMIN)
-- Paginated agent list with filters
-- ============================================
CREATE OR REPLACE FUNCTION admin_list_agents(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_framework TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_suspended BOOLEAN DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_order_by TEXT DEFAULT 'created_at',
  p_order_dir TEXT DEFAULT 'desc'
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  framework TEXT,
  status TEXT,
  wallet_address TEXT,
  owner_name TEXT,
  is_suspended BOOLEAN,
  suspended_at TIMESTAMPTZ,
  claw_config JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_requests BIGINT,
  total_blocks BIGINT,
  is_deployed BOOLEAN,
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
  FROM agents a
  WHERE
    (p_framework IS NULL OR a.framework = p_framework)
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_suspended IS NULL OR COALESCE(a.is_suspended, false) = p_suspended)
    AND (p_search IS NULL OR a.name ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.framework,
    a.status,
    a.wallet_address,
    p.display_name as owner_name,
    COALESCE(a.is_suspended, false) as is_suspended,
    a.suspended_at,
    a.claw_config,
    a.created_at,
    a.updated_at,
    COALESCE(ae.request_count, 0)::BIGINT as total_requests,
    COALESCE(ae.block_count, 0)::BIGINT as total_blocks,
    d.id IS NOT NULL as is_deployed,
    v_total as total_count
  FROM agents a
  LEFT JOIN profiles p ON a.wallet_address = p.wallet_address
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) as request_count,
      SUM(CASE WHEN claw_blocked THEN 1 ELSE 0 END) as block_count
    FROM agent_events
    WHERE agent_id = a.id AND created_at > NOW() - INTERVAL '30 days'
  ) ae ON true
  LEFT JOIN deployments d ON a.id = d.agent_id AND d.is_active = true
  WHERE
    (p_framework IS NULL OR a.framework = p_framework)
    AND (p_status IS NULL OR a.status = p_status)
    AND (p_suspended IS NULL OR COALESCE(a.is_suspended, false) = p_suspended)
    AND (p_search IS NULL OR a.name ILIKE '%' || p_search || '%')
  ORDER BY
    CASE WHEN p_order_by = 'name' AND p_order_dir = 'asc' THEN a.name END ASC,
    CASE WHEN p_order_by = 'name' AND p_order_dir = 'desc' THEN a.name END DESC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'asc' THEN a.created_at END ASC,
    CASE WHEN p_order_by = 'created_at' AND p_order_dir = 'desc' THEN a.created_at END DESC,
    CASE WHEN p_order_by = 'updated_at' AND p_order_dir = 'asc' THEN a.updated_at END ASC,
    CASE WHEN p_order_by = 'updated_at' AND p_order_dir = 'desc' THEN a.updated_at END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_list_agents IS 'Paginated agent list for admin with filters and search';

-- ============================================
-- 7. RPC: GET AGENT DETAILS (ADMIN)
-- Full agent details with analytics
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_agent_details(
  p_agent_id UUID
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  icon TEXT,
  framework TEXT,
  status TEXT,
  wallet_address TEXT,
  owner_name TEXT,
  is_suspended BOOLEAN,
  suspended_at TIMESTAMPTZ,
  suspended_by TEXT,
  suspension_reason TEXT,
  flow JSONB,
  config JSONB,
  claw_config JSONB,
  integration_config JSONB,
  version INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_requests_30d BIGINT,
  total_blocks_30d BIGINT,
  block_rate_30d NUMERIC,
  avg_latency_ms NUMERIC,
  deployments_count BIGINT,
  active_deployment_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.icon,
    a.framework,
    a.status,
    a.wallet_address,
    p.display_name as owner_name,
    COALESCE(a.is_suspended, false) as is_suspended,
    a.suspended_at,
    a.suspended_by,
    a.suspension_reason,
    a.flow,
    a.config,
    a.claw_config,
    a.integration_config,
    a.version,
    a.created_at,
    a.updated_at,
    COALESCE(ae.request_count, 0)::BIGINT as total_requests_30d,
    COALESCE(ae.block_count, 0)::BIGINT as total_blocks_30d,
    CASE
      WHEN COALESCE(ae.request_count, 0) > 0
      THEN ROUND((COALESCE(ae.block_count, 0)::NUMERIC / ae.request_count) * 100, 2)
      ELSE 0
    END as block_rate_30d,
    COALESCE(ae.avg_latency, 0)::NUMERIC as avg_latency_ms,
    COALESCE(dc.dep_count, 0)::BIGINT as deployments_count,
    ad.id as active_deployment_id
  FROM agents a
  LEFT JOIN profiles p ON a.wallet_address = p.wallet_address
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) as request_count,
      SUM(CASE WHEN claw_blocked THEN 1 ELSE 0 END) as block_count,
      AVG(execution_time_ms) as avg_latency
    FROM agent_events
    WHERE agent_id = a.id AND created_at > NOW() - INTERVAL '30 days'
  ) ae ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as dep_count
    FROM deployments
    WHERE agent_id = a.id
  ) dc ON true
  LEFT JOIN deployments ad ON a.id = ad.agent_id AND ad.is_active = true
  WHERE a.id = p_agent_id;
END;
$$;

COMMENT ON FUNCTION admin_get_agent_details IS 'Full agent details with analytics for admin view';

-- ============================================
-- 8. RPC: SUSPEND/UNSUSPEND AGENT (ADMIN)
-- ============================================
CREATE OR REPLACE FUNCTION admin_set_agent_status(
  p_agent_id UUID,
  p_suspended BOOLEAN,
  p_admin_hash TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  previous_status BOOLEAN,
  new_status BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status BOOLEAN;
BEGIN
  -- Get current status
  SELECT COALESCE(is_suspended, false) INTO v_previous_status
  FROM agents
  WHERE id = p_agent_id
  FOR UPDATE;

  IF v_previous_status IS NULL THEN
    RETURN QUERY SELECT false, NULL::BOOLEAN, NULL::BOOLEAN, 'AGENT_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Update status
  IF p_suspended THEN
    UPDATE agents
    SET is_suspended = true,
        suspended_at = NOW(),
        suspended_by = p_admin_hash,
        suspension_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_agent_id;
  ELSE
    UPDATE agents
    SET is_suspended = false,
        suspended_at = NULL,
        suspended_by = NULL,
        suspension_reason = NULL,
        updated_at = NOW()
    WHERE id = p_agent_id;
  END IF;

  RETURN QUERY SELECT true, v_previous_status, p_suspended, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_set_agent_status IS 'Suspend or unsuspend an agent';

-- ============================================
-- 9. RPC: GET AGENT ANALYTICS (ADMIN)
-- Detailed analytics for a specific agent
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_agent_analytics(
  p_agent_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE(
  date DATE,
  requests BIGINT,
  blocks BIGINT,
  block_rate NUMERIC,
  avg_latency_ms NUMERIC,
  gate_truth_blocks BIGINT,
  gate_harm_blocks BIGINT,
  gate_scope_blocks BIGINT,
  gate_purpose_blocks BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(ae.created_at) as date,
    COUNT(*)::BIGINT as requests,
    SUM(CASE WHEN ae.claw_blocked THEN 1 ELSE 0 END)::BIGINT as blocks,
    CASE
      WHEN COUNT(*) > 0
      THEN ROUND((SUM(CASE WHEN ae.claw_blocked THEN 1 ELSE 0 END)::NUMERIC / COUNT(*)) * 100, 2)
      ELSE 0
    END as block_rate,
    COALESCE(AVG(ae.execution_time_ms), 0)::NUMERIC as avg_latency_ms,
    SUM(CASE WHEN ae.blocked_gate = 'credibility' THEN 1 ELSE 0 END)::BIGINT as gate_truth_blocks,
    SUM(CASE WHEN ae.blocked_gate = 'avoidance' THEN 1 ELSE 0 END)::BIGINT as gate_harm_blocks,
    SUM(CASE WHEN ae.blocked_gate = 'limits' THEN 1 ELSE 0 END)::BIGINT as gate_scope_blocks,
    SUM(CASE WHEN ae.blocked_gate = 'worth' THEN 1 ELSE 0 END)::BIGINT as gate_purpose_blocks
  FROM agent_events ae
  WHERE ae.agent_id = p_agent_id
    AND ae.created_at > NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(ae.created_at)
  ORDER BY DATE(ae.created_at) DESC;
END;
$$;

COMMENT ON FUNCTION admin_get_agent_analytics IS 'Daily analytics breakdown for an agent';

-- ============================================
-- 10. RPC: GET DEPLOYMENTS STATS (ADMIN)
-- Platform-wide deployment statistics
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_deployments_stats()
RETURNS TABLE(
  total_deployments BIGINT,
  active_deployments BIGINT,
  suspended_deployments BIGINT,
  by_environment JSONB,
  by_status JSONB,
  created_7d BIGINT,
  created_30d BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_deployments,
    COUNT(*) FILTER (WHERE d.is_active = true AND NOT COALESCE(d.is_suspended, false))::BIGINT as active_deployments,
    COUNT(*) FILTER (WHERE COALESCE(d.is_suspended, false))::BIGINT as suspended_deployments,
    COALESCE(
      (SELECT jsonb_object_agg(environment, count)
       FROM (SELECT environment, COUNT(*)::INTEGER as count FROM deployments GROUP BY environment) env),
      '{}'::jsonb
    ) as by_environment,
    COALESCE(
      (SELECT jsonb_object_agg(status, count)
       FROM (SELECT status, COUNT(*)::INTEGER as count FROM deployments GROUP BY status) st),
      '{}'::jsonb
    ) as by_status,
    COUNT(*) FILTER (WHERE d.created_at > NOW() - INTERVAL '7 days')::BIGINT as created_7d,
    COUNT(*) FILTER (WHERE d.created_at > NOW() - INTERVAL '30 days')::BIGINT as created_30d
  FROM deployments d;
END;
$$;

COMMENT ON FUNCTION admin_get_deployments_stats IS 'Platform-wide deployment statistics for admin dashboard';

-- ============================================
-- 11. RPC: LIST DEPLOYMENTS (ADMIN)
-- Paginated deployment list with filters
-- ============================================
CREATE OR REPLACE FUNCTION admin_list_deployments(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_environment TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_suspended BOOLEAN DEFAULT NULL,
  p_active_only BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  agent_id UUID,
  agent_name TEXT,
  owner_wallet TEXT,
  owner_name TEXT,
  version INTEGER,
  status TEXT,
  environment TEXT,
  endpoint_url TEXT,
  is_active BOOLEAN,
  is_suspended BOOLEAN,
  suspended_at TIMESTAMPTZ,
  rate_limit_override INTEGER,
  created_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  requests_24h BIGINT,
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
  FROM deployments d
  WHERE
    (p_environment IS NULL OR d.environment = p_environment)
    AND (p_status IS NULL OR d.status = p_status)
    AND (p_suspended IS NULL OR COALESCE(d.is_suspended, false) = p_suspended)
    AND (p_active_only IS NULL OR d.is_active = p_active_only);

  RETURN QUERY
  SELECT
    d.id,
    d.agent_id,
    a.name as agent_name,
    a.wallet_address as owner_wallet,
    p.display_name as owner_name,
    d.version,
    d.status,
    d.environment,
    d.endpoint_url,
    d.is_active,
    COALESCE(d.is_suspended, false) as is_suspended,
    d.suspended_at,
    d.rate_limit_override,
    d.created_at,
    d.stopped_at,
    COALESCE(ae.count_24h, 0)::BIGINT as requests_24h,
    v_total as total_count
  FROM deployments d
  INNER JOIN agents a ON d.agent_id = a.id
  LEFT JOIN profiles p ON a.wallet_address = p.wallet_address
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count_24h
    FROM agent_events
    WHERE agent_id = d.agent_id AND created_at > NOW() - INTERVAL '24 hours'
  ) ae ON true
  WHERE
    (p_environment IS NULL OR d.environment = p_environment)
    AND (p_status IS NULL OR d.status = p_status)
    AND (p_suspended IS NULL OR COALESCE(d.is_suspended, false) = p_suspended)
    AND (p_active_only IS NULL OR d.is_active = p_active_only)
  ORDER BY d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_list_deployments IS 'Paginated deployment list for admin with filters';

-- ============================================
-- 12. RPC: GET DEPLOYMENT DETAILS (ADMIN)
-- Full deployment details with API keys and logs
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_deployment_details(
  p_deployment_id UUID
)
RETURNS TABLE(
  id UUID,
  agent_id UUID,
  agent_name TEXT,
  agent_framework TEXT,
  owner_wallet TEXT,
  owner_name TEXT,
  version INTEGER,
  status TEXT,
  environment TEXT,
  endpoint_url TEXT,
  is_active BOOLEAN,
  is_suspended BOOLEAN,
  suspended_at TIMESTAMPTZ,
  suspended_by TEXT,
  suspension_reason TEXT,
  rate_limit_override INTEGER,
  config_snapshot JSONB,
  flow_snapshot JSONB,
  claw_snapshot JSONB,
  notes TEXT,
  deployed_by TEXT,
  created_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  requests_24h BIGINT,
  requests_7d BIGINT,
  blocks_24h BIGINT,
  api_keys_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.agent_id,
    a.name as agent_name,
    a.framework as agent_framework,
    a.wallet_address as owner_wallet,
    p.display_name as owner_name,
    d.version,
    d.status,
    d.environment,
    d.endpoint_url,
    d.is_active,
    COALESCE(d.is_suspended, false) as is_suspended,
    d.suspended_at,
    d.suspended_by,
    d.suspension_reason,
    d.rate_limit_override,
    d.config_snapshot,
    d.flow_snapshot,
    d.claw_snapshot,
    d.notes,
    d.deployed_by,
    d.created_at,
    d.stopped_at,
    COALESCE(ae24.count, 0)::BIGINT as requests_24h,
    COALESCE(ae7.count, 0)::BIGINT as requests_7d,
    COALESCE(ae24.blocks, 0)::BIGINT as blocks_24h,
    COALESCE(ak.count, 0)::BIGINT as api_keys_count
  FROM deployments d
  INNER JOIN agents a ON d.agent_id = a.id
  LEFT JOIN profiles p ON a.wallet_address = p.wallet_address
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count, SUM(CASE WHEN claw_blocked THEN 1 ELSE 0 END) as blocks
    FROM agent_events
    WHERE agent_id = d.agent_id AND created_at > NOW() - INTERVAL '24 hours'
  ) ae24 ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM agent_events
    WHERE agent_id = d.agent_id AND created_at > NOW() - INTERVAL '7 days'
  ) ae7 ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM api_keys
    WHERE agent_id = d.agent_id AND NOT is_revoked
  ) ak ON true
  WHERE d.id = p_deployment_id;
END;
$$;

COMMENT ON FUNCTION admin_get_deployment_details IS 'Full deployment details for admin view';

-- ============================================
-- 13. RPC: SUSPEND/UNSUSPEND DEPLOYMENT (ADMIN)
-- ============================================
CREATE OR REPLACE FUNCTION admin_set_deployment_status(
  p_deployment_id UUID,
  p_suspended BOOLEAN,
  p_admin_hash TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  previous_status BOOLEAN,
  new_status BOOLEAN,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status BOOLEAN;
BEGIN
  -- Get current status
  SELECT COALESCE(is_suspended, false) INTO v_previous_status
  FROM deployments
  WHERE id = p_deployment_id
  FOR UPDATE;

  IF v_previous_status IS NULL THEN
    RETURN QUERY SELECT false, NULL::BOOLEAN, NULL::BOOLEAN, 'DEPLOYMENT_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Update status
  IF p_suspended THEN
    UPDATE deployments
    SET is_suspended = true,
        suspended_at = NOW(),
        suspended_by = p_admin_hash,
        suspension_reason = p_reason
    WHERE id = p_deployment_id;
  ELSE
    UPDATE deployments
    SET is_suspended = false,
        suspended_at = NULL,
        suspended_by = NULL,
        suspension_reason = NULL
    WHERE id = p_deployment_id;
  END IF;

  RETURN QUERY SELECT true, v_previous_status, p_suspended, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_set_deployment_status IS 'Suspend or unsuspend a deployment';

-- ============================================
-- 14. RPC: SET DEPLOYMENT RATE LIMIT (ADMIN)
-- ============================================
CREATE OR REPLACE FUNCTION admin_set_deployment_rate_limit(
  p_deployment_id UUID,
  p_rate_limit INTEGER,
  p_admin_hash TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  previous_limit INTEGER,
  new_limit INTEGER,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_limit INTEGER;
BEGIN
  -- Validate rate limit (0 = unlimited, NULL = default, > 0 = custom)
  IF p_rate_limit IS NOT NULL AND p_rate_limit < 0 THEN
    RETURN QUERY SELECT false, NULL::INTEGER, NULL::INTEGER, 'INVALID_RATE_LIMIT'::TEXT;
    RETURN;
  END IF;

  -- Get current rate limit
  SELECT rate_limit_override INTO v_previous_limit
  FROM deployments
  WHERE id = p_deployment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::INTEGER, NULL::INTEGER, 'DEPLOYMENT_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Update rate limit
  UPDATE deployments
  SET rate_limit_override = p_rate_limit
  WHERE id = p_deployment_id;

  RETURN QUERY SELECT true, v_previous_limit, p_rate_limit, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_set_deployment_rate_limit IS 'Set custom rate limit for a deployment';

-- ============================================
-- 15. RPC: GET DEPLOYMENT LOGS (ADMIN)
-- Paginated execution logs for a deployment
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_deployment_logs(
  p_deployment_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_blocked_only BOOLEAN DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  input_preview TEXT,
  output_preview TEXT,
  claw_blocked BOOLEAN,
  blocked_gate TEXT,
  execution_time_ms INTEGER,
  cost_usd NUMERIC,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_id UUID;
  v_total BIGINT;
BEGIN
  -- Get agent_id from deployment
  SELECT agent_id INTO v_agent_id
  FROM deployments
  WHERE id = p_deployment_id;

  IF v_agent_id IS NULL THEN
    RETURN;
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM agent_events
  WHERE agent_id = v_agent_id
    AND (p_blocked_only IS NULL OR claw_blocked = p_blocked_only);

  RETURN QUERY
  SELECT
    ae.id,
    LEFT(ae.input::TEXT, 200) as input_preview,
    LEFT(ae.output::TEXT, 200) as output_preview,
    ae.claw_blocked,
    ae.blocked_gate,
    ae.execution_time_ms,
    ae.cost_usd,
    ae.created_at,
    v_total as total_count
  FROM agent_events ae
  WHERE ae.agent_id = v_agent_id
    AND (p_blocked_only IS NULL OR ae.claw_blocked = p_blocked_only)
  ORDER BY ae.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_get_deployment_logs IS 'Paginated execution logs for a deployment';

-- ============================================
-- 16. RPC: GET DEPLOYMENT API KEYS (ADMIN)
-- API keys and their usage stats
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_deployment_api_keys(
  p_deployment_id UUID
)
RETURNS TABLE(
  id UUID,
  key_prefix TEXT,
  name TEXT,
  environment TEXT,
  is_revoked BOOLEAN,
  rate_limit INTEGER,
  created_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  requests_24h BIGINT,
  requests_total BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  -- Get agent_id from deployment
  SELECT agent_id INTO v_agent_id
  FROM deployments
  WHERE id = p_deployment_id;

  IF v_agent_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    ak.id,
    ak.key_prefix,
    ak.name,
    ak.environment,
    ak.is_revoked,
    ak.rate_limit,
    ak.created_at,
    ak.last_used_at,
    COALESCE(ae24.count, 0)::BIGINT as requests_24h,
    COALESCE(aet.count, 0)::BIGINT as requests_total
  FROM api_keys ak
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM agent_events
    WHERE api_key_id = ak.id AND created_at > NOW() - INTERVAL '24 hours'
  ) ae24 ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM agent_events
    WHERE api_key_id = ak.id
  ) aet ON true
  WHERE ak.agent_id = v_agent_id
  ORDER BY ak.created_at DESC;
END;
$$;

COMMENT ON FUNCTION admin_get_deployment_api_keys IS 'API keys and usage stats for a deployment';

-- ============================================
-- GRANTS
-- ============================================
-- Functions are SECURITY DEFINER, so they run with owner privileges
-- No additional grants needed for authenticated users
