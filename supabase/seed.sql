-- claw Platform v3 - Seed Data
-- Run this after migrations to set up initial data

-- ============================================
-- SUPER ADMIN SEED
-- ============================================
-- To seed the first super_admin, uncomment and replace WALLET_ADDRESS
-- with the actual Solana wallet address of the administrator.
--
-- IMPORTANT: The wallet must exist in the profiles table first.
-- The user must have logged in at least once before being granted admin access.

-- Example (uncomment and modify):
-- INSERT INTO admin_roles (wallet_address, role, granted_by, permissions, is_active)
-- VALUES (
--   'YOUR_WALLET_ADDRESS_HERE',
--   'super_admin',
--   'YOUR_WALLET_ADDRESS_HERE',  -- Self-granted for initial admin
--   '{}',
--   true
-- )
-- ON CONFLICT (wallet_address) DO UPDATE SET
--   role = 'super_admin',
--   is_active = true,
--   updated_at = NOW();

-- ============================================
-- DEFAULT ALERT RULES
-- ============================================
-- These are created in the migration, but this ensures they exist

INSERT INTO alert_rules (name, description, metric_name, condition, threshold_value, window_minutes, severity, cooldown_minutes)
VALUES
    ('High Error Rate', 'Error rate exceeds 5%', 'error_rate', 'gt', 5.0, 5, 'critical', 15),
    ('High Latency P95', 'P95 latency exceeds 2000ms', 'p95_latency_ms', 'gt', 2000, 5, 'warning', 30),
    ('High Block Rate', 'claw block rate exceeds 20%', 'block_rate', 'gt', 20.0, 15, 'warning', 60),
    ('Rate Limit Spike', 'Rate limit hits spike above 100/min', 'rate_limit_hits', 'gt', 100, 1, 'warning', 15),
    ('Auth Failure Spike', 'Authentication failures exceed 50/hour', 'auth_failure', 'gt', 50, 60, 'warning', 60)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- INITIAL METRICS (for testing)
-- ============================================
-- Initialize metrics tables with today's date for testing purposes
-- Remove these in production after real data starts flowing

-- Insert placeholder daily metrics
INSERT INTO metrics_daily (date, total_users, new_users, active_users, total_agents, deployed_agents)
VALUES (CURRENT_DATE, 0, 0, 0, 0, 0)
ON CONFLICT (date) DO NOTHING;

-- Insert placeholder hourly metrics
INSERT INTO metrics_hourly (hour, total_requests, total_blocked)
VALUES (DATE_TRUNC('hour', NOW()), 0, 0)
ON CONFLICT (hour) DO NOTHING;
