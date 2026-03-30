-- Admin System Tables
-- Phase 8: Platform Administration & Monitoring
-- Per ADMIN_SPEC (snug-fluttering-whale.md)

-- ============================================
-- ADMIN ROLES (Wallet-based Authorization)
-- ============================================
-- Role assignments for admin access
-- Roles: super_admin, admin, support, viewer
CREATE TABLE IF NOT EXISTS admin_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'support', 'viewer')),
    -- Who granted this role (for audit purposes)
    granted_by TEXT REFERENCES profiles(wallet_address),
    -- Custom permissions override (JSON)
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- Indexes for admin_roles
CREATE INDEX IF NOT EXISTS idx_admin_roles_wallet ON admin_roles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_admin_roles_role ON admin_roles(role);
CREATE INDEX IF NOT EXISTS idx_admin_roles_active ON admin_roles(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE admin_roles IS 'Admin role assignments. wallet-based authorization for platform management.';
COMMENT ON COLUMN admin_roles.role IS 'Role level: super_admin > admin > support > viewer';
COMMENT ON COLUMN admin_roles.permissions IS 'Custom permission overrides: {dashboards: [], actions: []}';

-- ============================================
-- ADMIN AUDIT LOG (Action Tracking)
-- ============================================
-- Trail of all admin actions for compliance and security
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Admin wallet is hashed for privacy
    admin_wallet_hash TEXT NOT NULL,
    -- Action performed (e.g., "POST /admin/users/:wallet/extend-plan")
    action TEXT NOT NULL,
    -- Target type and ID
    target_type TEXT,  -- 'user', 'agent', 'subscription', 'alert', 'role', etc.
    target_id TEXT,    -- ID of affected resource
    -- Details of the action (no PII)
    details JSONB DEFAULT '{}',
    -- Request metadata
    ip_hash TEXT,
    request_id TEXT,
    -- Result
    status_code INTEGER,
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for admin_audit_log
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_wallet_hash);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_log(target_type, target_id);

-- Comments
COMMENT ON TABLE admin_audit_log IS 'Audit trail for all admin actions. Retention: indefinite for compliance.';
COMMENT ON COLUMN admin_audit_log.admin_wallet_hash IS 'SHA-256 hash of admin wallet address';
COMMENT ON COLUMN admin_audit_log.details IS 'Action details - must not contain PII';

-- ============================================
-- METRICS DAILY (Aggregated Platform Metrics)
-- ============================================
-- Daily aggregated metrics for dashboards and reporting
CREATE TABLE IF NOT EXISTS metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE,

    -- User metrics
    total_users INTEGER DEFAULT 0,
    new_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,  -- DAU

    -- Plan distribution
    users_free INTEGER DEFAULT 0,
    users_starter INTEGER DEFAULT 0,
    users_pro INTEGER DEFAULT 0,

    -- Agent metrics
    total_agents INTEGER DEFAULT 0,
    new_agents INTEGER DEFAULT 0,
    deployed_agents INTEGER DEFAULT 0,

    -- Request metrics
    total_requests BIGINT DEFAULT 0,
    total_blocked BIGINT DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,

    -- claw gate blocks
    claw_truth_blocks INTEGER DEFAULT 0,
    claw_harm_blocks INTEGER DEFAULT 0,
    claw_scope_blocks INTEGER DEFAULT 0,
    claw_purpose_blocks INTEGER DEFAULT 0,

    -- Financial metrics (in smallest unit)
    revenue_sol BIGINT DEFAULT 0,       -- lamports
    revenue_usdc BIGINT DEFAULT 0,      -- micro-USDC
    revenue_claw BIGINT DEFAULT 0,  -- smallest $claw unit
    new_subscriptions INTEGER DEFAULT 0,
    churned_subscriptions INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for metrics_daily
CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily(date DESC);

-- Comments
COMMENT ON TABLE metrics_daily IS 'Daily aggregated platform metrics. Used by admin dashboards.';
COMMENT ON COLUMN metrics_daily.active_users IS 'Daily Active Users (DAU) - users with at least 1 request';

-- ============================================
-- METRICS HOURLY (Real-time Metrics)
-- ============================================
-- Hourly metrics for real-time monitoring (retain 7 days)
CREATE TABLE IF NOT EXISTS metrics_hourly (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hour TIMESTAMPTZ NOT NULL,  -- Truncated to hour

    -- Request metrics
    total_requests INTEGER DEFAULT 0,
    total_blocked INTEGER DEFAULT 0,
    avg_latency_ms INTEGER DEFAULT 0,
    p95_latency_ms INTEGER DEFAULT 0,
    error_4xx INTEGER DEFAULT 0,
    error_5xx INTEGER DEFAULT 0,

    -- Rate limiting
    rate_limit_hits INTEGER DEFAULT 0,

    -- claw blocks by gate
    claw_truth_blocks INTEGER DEFAULT 0,
    claw_harm_blocks INTEGER DEFAULT 0,
    claw_scope_blocks INTEGER DEFAULT 0,
    claw_purpose_blocks INTEGER DEFAULT 0,

    -- Auth events
    auth_success INTEGER DEFAULT 0,
    auth_failure INTEGER DEFAULT 0,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hour)
);

-- Index for metrics_hourly
CREATE INDEX IF NOT EXISTS idx_metrics_hourly_hour ON metrics_hourly(hour DESC);

-- Comments
COMMENT ON TABLE metrics_hourly IS 'Hourly metrics for real-time dashboards. Retention: 7 days.';

-- ============================================
-- ALERTS (Active and Historical)
-- ============================================
-- Platform alerts triggered by rules or manual
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Alert type (e.g., 'high_latency', 'error_spike', 'security', 'capacity')
    type TEXT NOT NULL,
    -- Severity level
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    -- Alert details
    title TEXT NOT NULL,
    description TEXT,
    -- Metric that triggered (if automatic)
    metric_name TEXT,
    metric_value REAL,
    threshold_value REAL,
    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    -- Resolution tracking
    acknowledged_by TEXT,  -- Wallet hash of admin
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts(status) WHERE status = 'active';

-- Comments
COMMENT ON TABLE alerts IS 'Platform alerts for admin monitoring. Auto-generated or manual.';

-- ============================================
-- ALERT RULES (Configurable Thresholds)
-- ============================================
-- Rules that automatically generate alerts
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    -- Metric to monitor
    metric_name TEXT NOT NULL,
    -- Condition: 'gt', 'lt', 'gte', 'lte', 'eq', 'spike'
    condition TEXT NOT NULL CHECK (condition IN ('gt', 'lt', 'gte', 'lte', 'eq', 'spike')),
    threshold_value REAL NOT NULL,
    -- Time window for evaluation (minutes)
    window_minutes INTEGER DEFAULT 5,
    -- Resulting alert severity
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    -- Enable/disable
    is_enabled BOOLEAN DEFAULT true,
    -- Notification channels (for future use)
    notification_channels TEXT[] DEFAULT '{}',
    -- Cooldown between alerts (minutes)
    cooldown_minutes INTEGER DEFAULT 15,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for alert_rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(is_enabled) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric_name);

-- Comments
COMMENT ON TABLE alert_rules IS 'Configurable alert rules. Evaluated by scheduled job.';
COMMENT ON COLUMN alert_rules.condition IS 'Comparison: gt (>), lt (<), gte (>=), lte (<=), eq (=), spike (% change)';
COMMENT ON COLUMN alert_rules.cooldown_minutes IS 'Minimum time between alerts of same type';

-- ============================================
-- REVENUE DAILY (Financial Tracking)
-- ============================================
-- Detailed revenue tracking by plan and token
CREATE TABLE IF NOT EXISTS revenue_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    plan TEXT NOT NULL,
    payment_token TEXT NOT NULL,
    -- Counts
    subscription_count INTEGER DEFAULT 0,
    -- Amounts (in smallest unit)
    total_amount BIGINT DEFAULT 0,
    -- USD equivalent at time of payment (for reporting)
    usd_equivalent REAL DEFAULT 0,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, plan, payment_token)
);

-- Index for revenue_daily
CREATE INDEX IF NOT EXISTS idx_revenue_daily_date ON revenue_daily(date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_plan ON revenue_daily(plan);

-- Comments
COMMENT ON TABLE revenue_daily IS 'Daily revenue breakdown by plan and payment token.';
COMMENT ON COLUMN revenue_daily.total_amount IS 'Total in smallest unit (lamports for SOL, etc.)';
COMMENT ON COLUMN revenue_daily.usd_equivalent IS 'USD value at time of payment for reporting';

-- ============================================
-- MATERIALIZED VIEWS
-- ============================================

-- Platform Summary (refresh hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_platform_summary AS
SELECT
    (SELECT COUNT(*) FROM profiles WHERE status = 'active') as total_users,
    (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND plan = 'free') as free_users,
    (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND plan = 'starter') as starter_users,
    (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND plan = 'pro') as pro_users,
    (SELECT COUNT(*) FROM agents) as total_agents,
    (SELECT COUNT(*) FROM agents WHERE status = 'deployed') as deployed_agents,
    (SELECT COALESCE(SUM(requests_count), 0) FROM usage_daily WHERE date = CURRENT_DATE) as requests_today,
    (SELECT COALESCE(SUM(blocked_count), 0) FROM usage_daily WHERE date = CURRENT_DATE) as blocked_today,
    (SELECT COUNT(*) FROM alerts WHERE status = 'active') as active_alerts,
    NOW() as refreshed_at;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_platform_summary ON mv_platform_summary(refreshed_at);

COMMENT ON MATERIALIZED VIEW mv_platform_summary IS 'Platform summary stats. Refresh hourly.';

-- ============================================
-- AGGREGATION FUNCTIONS
-- ============================================

-- Aggregate hourly metrics (call every hour)
CREATE OR REPLACE FUNCTION aggregate_hourly_metrics()
RETURNS void AS $$
DECLARE
    last_hour TIMESTAMPTZ := DATE_TRUNC('hour', NOW() - INTERVAL '1 hour');
BEGIN
    INSERT INTO metrics_hourly (
        hour,
        total_requests,
        total_blocked,
        claw_truth_blocks,
        claw_harm_blocks,
        claw_scope_blocks,
        claw_purpose_blocks
    )
    SELECT
        last_hour,
        COUNT(*)::INTEGER,
        COUNT(*) FILTER (WHERE claw_blocked = true)::INTEGER,
        COUNT(*) FILTER (WHERE claw_gate LIKE 'truth%')::INTEGER,
        COUNT(*) FILTER (WHERE claw_gate LIKE 'harm%')::INTEGER,
        COUNT(*) FILTER (WHERE claw_gate LIKE 'scope%')::INTEGER,
        COUNT(*) FILTER (WHERE claw_gate LIKE 'purpose%')::INTEGER
    FROM agent_events
    WHERE created_at >= last_hour AND created_at < last_hour + INTERVAL '1 hour'
    ON CONFLICT (hour) DO UPDATE SET
        total_requests = EXCLUDED.total_requests,
        total_blocked = EXCLUDED.total_blocked,
        claw_truth_blocks = EXCLUDED.claw_truth_blocks,
        claw_harm_blocks = EXCLUDED.claw_harm_blocks,
        claw_scope_blocks = EXCLUDED.claw_scope_blocks,
        claw_purpose_blocks = EXCLUDED.claw_purpose_blocks,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_hourly_metrics IS 'Aggregate metrics for the previous hour. Call via cron every hour.';

-- Aggregate daily metrics (call at midnight UTC)
CREATE OR REPLACE FUNCTION aggregate_daily_metrics()
RETURNS void AS $$
DECLARE
    yesterday DATE := CURRENT_DATE - INTERVAL '1 day';
BEGIN
    INSERT INTO metrics_daily (
        date,
        total_users,
        new_users,
        active_users,
        total_agents,
        new_agents,
        deployed_agents,
        total_requests,
        total_blocked,
        users_free,
        users_starter,
        users_pro,
        claw_truth_blocks,
        claw_harm_blocks,
        claw_scope_blocks,
        claw_purpose_blocks
    )
    VALUES (
        yesterday,
        (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND created_at < yesterday + INTERVAL '1 day'),
        (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND DATE(created_at) = yesterday),
        (SELECT COUNT(DISTINCT wallet_address) FROM usage_daily WHERE date = yesterday AND requests_count > 0),
        (SELECT COUNT(*) FROM agents WHERE created_at < yesterday + INTERVAL '1 day'),
        (SELECT COUNT(*) FROM agents WHERE DATE(created_at) = yesterday),
        (SELECT COUNT(*) FROM agents WHERE status = 'deployed' AND created_at < yesterday + INTERVAL '1 day'),
        (SELECT COALESCE(SUM(requests_count), 0) FROM usage_daily WHERE date = yesterday),
        (SELECT COALESCE(SUM(blocked_count), 0) FROM usage_daily WHERE date = yesterday),
        (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND plan = 'free'),
        (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND plan = 'starter'),
        (SELECT COUNT(*) FROM profiles WHERE status = 'active' AND plan = 'pro'),
        (SELECT COALESCE(SUM(claw_truth_blocks), 0) FROM metrics_hourly WHERE DATE(hour) = yesterday),
        (SELECT COALESCE(SUM(claw_harm_blocks), 0) FROM metrics_hourly WHERE DATE(hour) = yesterday),
        (SELECT COALESCE(SUM(claw_scope_blocks), 0) FROM metrics_hourly WHERE DATE(hour) = yesterday),
        (SELECT COALESCE(SUM(claw_purpose_blocks), 0) FROM metrics_hourly WHERE DATE(hour) = yesterday)
    )
    ON CONFLICT (date) DO UPDATE SET
        total_users = EXCLUDED.total_users,
        new_users = EXCLUDED.new_users,
        active_users = EXCLUDED.active_users,
        total_agents = EXCLUDED.total_agents,
        new_agents = EXCLUDED.new_agents,
        deployed_agents = EXCLUDED.deployed_agents,
        total_requests = EXCLUDED.total_requests,
        total_blocked = EXCLUDED.total_blocked,
        users_free = EXCLUDED.users_free,
        users_starter = EXCLUDED.users_starter,
        users_pro = EXCLUDED.users_pro,
        claw_truth_blocks = EXCLUDED.claw_truth_blocks,
        claw_harm_blocks = EXCLUDED.claw_harm_blocks,
        claw_scope_blocks = EXCLUDED.claw_scope_blocks,
        claw_purpose_blocks = EXCLUDED.claw_purpose_blocks,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION aggregate_daily_metrics IS 'Aggregate metrics for previous day. Call via cron at 00:05 UTC.';

-- Refresh platform summary view
CREATE OR REPLACE FUNCTION refresh_platform_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_platform_summary;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_platform_summary IS 'Refresh platform summary view. Call via cron every hour.';

-- Cleanup old hourly metrics (retain 7 days)
CREATE OR REPLACE FUNCTION cleanup_old_hourly_metrics()
RETURNS void AS $$
BEGIN
    DELETE FROM metrics_hourly
    WHERE hour < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_hourly_metrics IS 'Remove hourly metrics older than 7 days. Call via cron daily.';

-- ============================================
-- DEFAULT ALERT RULES
-- ============================================
-- Insert default alert rules for common scenarios
INSERT INTO alert_rules (name, description, metric_name, condition, threshold_value, window_minutes, severity, cooldown_minutes)
VALUES
    ('High Error Rate', 'Error rate exceeds 5%', 'error_rate', 'gt', 5.0, 5, 'critical', 15),
    ('High Latency P95', 'P95 latency exceeds 2000ms', 'p95_latency_ms', 'gt', 2000, 5, 'warning', 30),
    ('High Block Rate', 'claw block rate exceeds 20%', 'block_rate', 'gt', 20.0, 15, 'warning', 60),
    ('Rate Limit Spike', 'Rate limit hits spike above 100/min', 'rate_limit_hits', 'gt', 100, 1, 'warning', 15),
    ('Auth Failure Spike', 'Authentication failures exceed 50/hour', 'auth_failure', 'gt', 50, 60, 'warning', 60)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- RLS POLICIES
-- ============================================
-- Admin tables are accessed via service role, no RLS needed for user access
-- But we add basic policies for future extensibility

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE metrics_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_daily ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API)
-- No user-level policies - admin tables are API-only access

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant usage to authenticated role for potential future direct access
GRANT SELECT ON mv_platform_summary TO authenticated;
