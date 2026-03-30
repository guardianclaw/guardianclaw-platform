-- Migration: 20260125000000_agent_alert_rules
-- Date: 2026-01-25
-- Description: Create agent-level alert rules and history tables for per-agent monitoring
-- Author: claw Team
--
-- This migration adds:
-- 1. agent_alert_rules - User-configurable alert rules for monitoring specific agent metrics
-- 2. agent_alert_history - Historical record of alert triggers for auditing
-- 3. Helper functions for alert evaluation (used by scheduled worker)
--
-- NOTE: These tables are DISTINCT from the admin-level alert_rules table (admin system).
-- - admin alert_rules: Platform-wide monitoring (error rates, latency across all agents)
-- - agent_alert_rules: Per-agent monitoring (specific agent metrics, user-configurable)
--
-- Dependencies:
-- - profiles(wallet_address) from 20260105000000_initial_schema.sql
-- - agents(id) from 20260105000000_initial_schema.sql
-- - execution_logs from 20260115200000_add_execution_logs.sql

-- ============================================
-- 1. AGENT ALERT RULES TABLE
-- ============================================

-- Agent-level alert rules allow users to define thresholds for monitoring their specific agents.
-- When a metric exceeds the threshold, an alert is triggered and notifications are sent.

CREATE TABLE agent_alert_rules (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,

    -- Rule identification
    name TEXT NOT NULL,
    description TEXT,

    -- Rule configuration
    rule_type TEXT NOT NULL CHECK (rule_type IN (
        'error_rate',       -- Percentage of errors in a time window
        'latency_p95',      -- 95th percentile latency exceeds threshold
        'latency_p99',      -- 99th percentile latency exceeds threshold
        'block_rate',       -- Percentage of blocked requests
        'success_rate',     -- Success rate falls below threshold
        'request_volume'    -- Request count exceeds/falls below threshold
    )),
    threshold NUMERIC NOT NULL CHECK (threshold >= 0),
    window_minutes INTEGER NOT NULL DEFAULT 60 CHECK (window_minutes > 0 AND window_minutes <= 1440),
    comparison TEXT NOT NULL DEFAULT 'gt' CHECK (comparison IN ('gt', 'gte', 'lt', 'lte', 'eq')),

    -- Notification configuration
    notification_channel TEXT NOT NULL CHECK (notification_channel IN ('email', 'webhook', 'slack')),
    notification_target TEXT NOT NULL, -- Email address, webhook URL, or Slack webhook
    cooldown_minutes INTEGER NOT NULL DEFAULT 60 CHECK (cooldown_minutes >= 0 AND cooldown_minutes <= 1440),

    -- Alert behavior
    consecutive_threshold INTEGER NOT NULL DEFAULT 1 CHECK (consecutive_threshold > 0),
    severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),

    -- State tracking
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_triggered_at TIMESTAMPTZ,
    last_value NUMERIC,
    consecutive_triggers INTEGER NOT NULL DEFAULT 0,
    last_checked_at TIMESTAMPTZ,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. AGENT ALERT HISTORY TABLE
-- ============================================

-- Stores a history of all agent-level alert triggers for auditing and analysis.

CREATE TABLE agent_alert_history (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign key to alert rule
    alert_rule_id UUID NOT NULL REFERENCES agent_alert_rules(id) ON DELETE CASCADE,

    -- Trigger details
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metric_value NUMERIC NOT NULL,
    threshold NUMERIC NOT NULL,
    comparison TEXT NOT NULL,
    window_minutes INTEGER NOT NULL,

    -- Notification details
    notification_sent BOOLEAN NOT NULL DEFAULT false,
    notification_sent_at TIMESTAMPTZ,
    notification_error TEXT,

    -- Resolution (optional)
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT, -- 'auto' or wallet address

    -- Context
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 3. INDEXES
-- ============================================

-- agent_alert_rules indexes
CREATE INDEX idx_agent_alert_rules_agent_id ON agent_alert_rules(agent_id);
CREATE INDEX idx_agent_alert_rules_wallet ON agent_alert_rules(wallet_address);
CREATE INDEX idx_agent_alert_rules_active ON agent_alert_rules(is_active) WHERE is_active = true;
CREATE INDEX idx_agent_alert_rules_last_checked ON agent_alert_rules(last_checked_at) WHERE is_active = true;

-- agent_alert_history indexes
CREATE INDEX idx_agent_alert_history_rule_id ON agent_alert_history(alert_rule_id);
CREATE INDEX idx_agent_alert_history_triggered ON agent_alert_history(triggered_at DESC);
CREATE INDEX idx_agent_alert_history_unresolved ON agent_alert_history(alert_rule_id, resolved_at) WHERE resolved_at IS NULL;

-- ============================================
-- 4. TRIGGERS
-- ============================================

-- Automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_agent_alert_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_alert_rules_updated_at
    BEFORE UPDATE ON agent_alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_agent_alert_rules_updated_at();

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE agent_alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_alert_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own alert rules
-- Note: Uses app.wallet_address for consistency with other migrations
-- The API uses service role which bypasses RLS; these policies are defense-in-depth
CREATE POLICY agent_alert_rules_select_policy ON agent_alert_rules
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY agent_alert_rules_insert_policy ON agent_alert_rules
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY agent_alert_rules_update_policy ON agent_alert_rules
    FOR UPDATE
    USING (wallet_address = current_setting('app.wallet_address', true));

CREATE POLICY agent_alert_rules_delete_policy ON agent_alert_rules
    FOR DELETE
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only see history for their own rules
CREATE POLICY agent_alert_history_select_policy ON agent_alert_history
    FOR SELECT
    USING (
        alert_rule_id IN (
            SELECT id FROM agent_alert_rules
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Service role bypass policy (for scheduled worker and API)
CREATE POLICY agent_alert_rules_service_policy ON agent_alert_rules
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

CREATE POLICY agent_alert_history_service_policy ON agent_alert_history
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 6. HELPER FUNCTIONS (used by scheduled worker)
-- ============================================

-- Function to get active agent alert rules that need checking
CREATE OR REPLACE FUNCTION get_agent_alerts_to_check(p_check_interval_minutes INTEGER DEFAULT 5)
RETURNS TABLE (
    id UUID,
    agent_id UUID,
    rule_type TEXT,
    threshold NUMERIC,
    window_minutes INTEGER,
    comparison TEXT,
    notification_channel TEXT,
    notification_target TEXT,
    cooldown_minutes INTEGER,
    consecutive_threshold INTEGER,
    consecutive_triggers INTEGER,
    last_triggered_at TIMESTAMPTZ,
    severity TEXT,
    name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ar.id,
        ar.agent_id,
        ar.rule_type,
        ar.threshold,
        ar.window_minutes,
        ar.comparison,
        ar.notification_channel,
        ar.notification_target,
        ar.cooldown_minutes,
        ar.consecutive_threshold,
        ar.consecutive_triggers,
        ar.last_triggered_at,
        ar.severity,
        ar.name
    FROM agent_alert_rules ar
    WHERE ar.is_active = true
    AND (
        ar.last_checked_at IS NULL
        OR ar.last_checked_at < NOW() - (p_check_interval_minutes || ' minutes')::interval
    )
    ORDER BY ar.last_checked_at NULLS FIRST
    LIMIT 100;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record agent alert trigger
CREATE OR REPLACE FUNCTION record_agent_alert_trigger(
    p_alert_rule_id UUID,
    p_metric_value NUMERIC,
    p_notification_sent BOOLEAN DEFAULT false,
    p_notification_error TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_history_id UUID;
    v_threshold NUMERIC;
    v_comparison TEXT;
    v_window_minutes INTEGER;
BEGIN
    -- Get rule details
    SELECT threshold, comparison, window_minutes
    INTO v_threshold, v_comparison, v_window_minutes
    FROM agent_alert_rules
    WHERE id = p_alert_rule_id;

    -- Insert history record
    INSERT INTO agent_alert_history (
        alert_rule_id,
        metric_value,
        threshold,
        comparison,
        window_minutes,
        notification_sent,
        notification_sent_at,
        notification_error,
        metadata
    ) VALUES (
        p_alert_rule_id,
        p_metric_value,
        v_threshold,
        v_comparison,
        v_window_minutes,
        p_notification_sent,
        CASE WHEN p_notification_sent THEN NOW() ELSE NULL END,
        p_notification_error,
        p_metadata
    )
    RETURNING id INTO v_history_id;

    -- Update rule state
    UPDATE agent_alert_rules
    SET
        last_triggered_at = NOW(),
        last_value = p_metric_value,
        consecutive_triggers = consecutive_triggers + 1,
        last_checked_at = NOW()
    WHERE id = p_alert_rule_id;

    RETURN v_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reset consecutive triggers (when metric returns to normal)
CREATE OR REPLACE FUNCTION reset_agent_alert_consecutive(p_alert_rule_id UUID, p_current_value NUMERIC)
RETURNS VOID AS $$
BEGIN
    UPDATE agent_alert_rules
    SET
        consecutive_triggers = 0,
        last_value = p_current_value,
        last_checked_at = NOW()
    WHERE id = p_alert_rule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate agent metrics for alert evaluation
CREATE OR REPLACE FUNCTION get_agent_metrics_for_alerts(
    p_agent_id UUID,
    p_window_minutes INTEGER
)
RETURNS TABLE (
    total_requests BIGINT,
    success_count BIGINT,
    error_count BIGINT,
    blocked_count BIGINT,
    error_rate NUMERIC,
    success_rate NUMERIC,
    block_rate NUMERIC,
    latency_p95 NUMERIC,
    latency_p99 NUMERIC
) AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
BEGIN
    v_window_start := NOW() - (p_window_minutes || ' minutes')::interval;

    RETURN QUERY
    WITH metrics AS (
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE el.status = 'success') AS successes,
            COUNT(*) FILTER (WHERE el.status = 'error') AS errors,
            COUNT(*) FILTER (WHERE el.status = 'blocked') AS blocked,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY el.latency_ms) AS p95,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY el.latency_ms) AS p99
        FROM execution_logs el
        WHERE el.agent_id = p_agent_id
        AND el.created_at >= v_window_start
    )
    SELECT
        m.total AS total_requests,
        m.successes AS success_count,
        m.errors AS error_count,
        m.blocked AS blocked_count,
        CASE WHEN m.total > 0 THEN (m.errors::NUMERIC / m.total * 100) ELSE 0 END AS error_rate,
        CASE WHEN m.total > 0 THEN (m.successes::NUMERIC / m.total * 100) ELSE 0 END AS success_rate,
        CASE WHEN m.total > 0 THEN (m.blocked::NUMERIC / m.total * 100) ELSE 0 END AS block_rate,
        COALESCE(m.p95, 0) AS latency_p95,
        COALESCE(m.p99, 0) AS latency_p99
    FROM metrics m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. COMMENTS
-- ============================================

COMMENT ON TABLE agent_alert_rules IS 'User-configurable alert rules for monitoring specific agent metrics';
COMMENT ON TABLE agent_alert_history IS 'Historical record of agent alert triggers for auditing';

COMMENT ON COLUMN agent_alert_rules.rule_type IS 'Type of metric to monitor: error_rate, latency_p95, latency_p99, block_rate, success_rate, request_volume';
COMMENT ON COLUMN agent_alert_rules.threshold IS 'Numeric threshold value for the alert';
COMMENT ON COLUMN agent_alert_rules.window_minutes IS 'Time window in minutes for metric calculation (1-1440)';
COMMENT ON COLUMN agent_alert_rules.comparison IS 'Comparison operator: gt (>), gte (>=), lt (<), lte (<=), eq (=)';
COMMENT ON COLUMN agent_alert_rules.consecutive_threshold IS 'Number of consecutive triggers required before sending notification';
COMMENT ON COLUMN agent_alert_rules.severity IS 'Alert severity level: info, warning, critical';
COMMENT ON COLUMN agent_alert_rules.cooldown_minutes IS 'Minimum time between notifications for the same rule';

COMMENT ON FUNCTION get_agent_alerts_to_check IS 'Returns active alert rules that need checking (called by scheduled worker)';
COMMENT ON FUNCTION record_agent_alert_trigger IS 'Records an alert trigger and updates rule state';
COMMENT ON FUNCTION reset_agent_alert_consecutive IS 'Resets consecutive trigger count when metric returns to normal';
COMMENT ON FUNCTION get_agent_metrics_for_alerts IS 'Calculates agent metrics from execution_logs for alert evaluation';
