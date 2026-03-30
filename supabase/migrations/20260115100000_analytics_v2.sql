-- Analytics v2: Adaptive analytics with layer tracking, tools, social, DeFi, and memory metrics
-- Migration: 20260115100000_analytics_v2.sql

-- ============================================
-- EXTEND agent_events TABLE
-- ============================================

-- Add layer tracking (L1/L3/L4 instead of CLAW gates)
ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS claw_layer TEXT;
-- Values: 'L1_input', 'L3_output', 'L4_observer'

-- Add tool execution tracking
ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS tool_type TEXT;
-- Values: 'web_search', 'api_request', 'code_execution'

ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS tool_success BOOLEAN;

-- Add social delivery tracking
ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS social_platform TEXT;
-- Values: 'twitter', 'discord', 'telegram'

ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS social_success BOOLEAN;

-- Add DeFi tracking
ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS defi_operation TEXT;
-- Values: 'transfer', 'swap', 'stake', 'mint'

ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS defi_value_usd DECIMAL(18,2);

ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS defi_blocked BOOLEAN;

-- Add memory tracking
ALTER TABLE agent_events
ADD COLUMN IF NOT EXISTS memory_operation TEXT;
-- Values: 'read', 'write', 'shield_block'

-- ============================================
-- INDEXES FOR NEW COLUMNS
-- ============================================

CREATE INDEX IF NOT EXISTS idx_events_layer ON agent_events(claw_layer);
CREATE INDEX IF NOT EXISTS idx_events_tool ON agent_events(tool_type);
CREATE INDEX IF NOT EXISTS idx_events_social ON agent_events(social_platform);
CREATE INDEX IF NOT EXISTS idx_events_defi ON agent_events(defi_operation);
CREATE INDEX IF NOT EXISTS idx_events_memory ON agent_events(memory_operation);

-- ============================================
-- RPC FUNCTIONS FOR AGGREGATION
-- ============================================

-- Get analytics by layer (L1/L3/L4)
CREATE OR REPLACE FUNCTION get_analytics_by_layer(
  p_agent_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  layer TEXT,
  total_checks BIGINT,
  blocked_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.claw_layer AS layer,
    COUNT(*)::BIGINT AS total_checks,
    COUNT(*) FILTER (WHERE ae.claw_blocked)::BIGINT AS blocked_count
  FROM agent_events ae
  WHERE ae.agent_id = p_agent_id
    AND ae.created_at >= p_start_date
    AND ae.created_at < p_end_date + INTERVAL '1 day'
    AND ae.claw_layer IS NOT NULL
  GROUP BY ae.claw_layer
  ORDER BY blocked_count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_analytics_by_layer IS 'Aggregate claw blocks by layer (L1/L3/L4) for a given agent and date range';

-- Get tool usage stats
CREATE OR REPLACE FUNCTION get_tool_usage_stats(
  p_agent_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  tool_type TEXT,
  total_calls BIGINT,
  success_count BIGINT,
  avg_latency_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.tool_type AS tool_type,
    COUNT(*)::BIGINT AS total_calls,
    COUNT(*) FILTER (WHERE ae.tool_success = true)::BIGINT AS success_count,
    ROUND(AVG(ae.latency_ms)::NUMERIC, 0) AS avg_latency_ms
  FROM agent_events ae
  WHERE ae.agent_id = p_agent_id
    AND ae.created_at >= p_start_date
    AND ae.created_at < p_end_date + INTERVAL '1 day'
    AND ae.tool_type IS NOT NULL
  GROUP BY ae.tool_type
  ORDER BY total_calls DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_tool_usage_stats IS 'Aggregate tool usage statistics for a given agent and date range';

-- Get social delivery stats
CREATE OR REPLACE FUNCTION get_social_stats(
  p_agent_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  platform TEXT,
  total_deliveries BIGINT,
  success_count BIGINT,
  failure_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.social_platform AS platform,
    COUNT(*)::BIGINT AS total_deliveries,
    COUNT(*) FILTER (WHERE ae.social_success = true)::BIGINT AS success_count,
    COUNT(*) FILTER (WHERE ae.social_success = false)::BIGINT AS failure_count
  FROM agent_events ae
  WHERE ae.agent_id = p_agent_id
    AND ae.created_at >= p_start_date
    AND ae.created_at < p_end_date + INTERVAL '1 day'
    AND ae.social_platform IS NOT NULL
  GROUP BY ae.social_platform
  ORDER BY total_deliveries DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_social_stats IS 'Aggregate social delivery statistics for a given agent and date range';

-- Get DeFi protection stats
CREATE OR REPLACE FUNCTION get_defi_stats(
  p_agent_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  operation TEXT,
  total_transactions BIGINT,
  blocked_count BIGINT,
  total_value_usd NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.defi_operation AS operation,
    COUNT(*)::BIGINT AS total_transactions,
    COUNT(*) FILTER (WHERE ae.defi_blocked = true)::BIGINT AS blocked_count,
    COALESCE(SUM(ae.defi_value_usd), 0)::NUMERIC AS total_value_usd
  FROM agent_events ae
  WHERE ae.agent_id = p_agent_id
    AND ae.created_at >= p_start_date
    AND ae.created_at < p_end_date + INTERVAL '1 day'
    AND ae.defi_operation IS NOT NULL
  GROUP BY ae.defi_operation
  ORDER BY total_transactions DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_defi_stats IS 'Aggregate DeFi transaction statistics for a given agent and date range';

-- Get memory operation stats
CREATE OR REPLACE FUNCTION get_memory_stats(
  p_agent_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  operation TEXT,
  total_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.memory_operation AS operation,
    COUNT(*)::BIGINT AS total_count
  FROM agent_events ae
  WHERE ae.agent_id = p_agent_id
    AND ae.created_at >= p_start_date
    AND ae.created_at < p_end_date + INTERVAL '1 day'
    AND ae.memory_operation IS NOT NULL
  GROUP BY ae.memory_operation
  ORDER BY total_count DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_memory_stats IS 'Aggregate memory operation statistics for a given agent and date range';

-- Get token usage stats
CREATE OR REPLACE FUNCTION get_token_stats(
  p_agent_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  total_tokens BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ae.input_tokens), 0)::BIGINT as total_input_tokens,
    COALESCE(SUM(ae.output_tokens), 0)::BIGINT as total_output_tokens,
    COALESCE(SUM(ae.input_tokens) + SUM(ae.output_tokens), 0)::BIGINT as total_tokens
  FROM agent_events ae
  WHERE ae.agent_id = p_agent_id
    AND ae.created_at >= p_start_date
    AND ae.created_at < p_end_date + INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_token_stats IS 'Aggregate token usage statistics for a given agent and date range';
