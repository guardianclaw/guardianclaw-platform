-- Migration: Setup pg_cron scheduled jobs
-- Date: 2026-01-28
-- Author: claw Team
--
-- Purpose: Schedule maintenance jobs for automatic cleanup and refresh.
-- These functions already exist from previous migrations:
--   - cleanup_old_hourly_metrics() from 20260112000000_add_admin_system.sql
--   - cleanup_old_execution_logs(int) from 20260115200000_add_execution_logs.sql
--   - refresh_platform_summary() from 20260112000000_add_admin_system.sql
--
-- pg_cron must be enabled in the Supabase dashboard first:
--   Database > Extensions > pg_cron > Enable

-- Enable extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove existing jobs if re-running (idempotent)
SELECT cron.unschedule('cleanup-hourly-metrics')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-hourly-metrics');

SELECT cron.unschedule('cleanup-execution-logs')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-execution-logs');

SELECT cron.unschedule('refresh-platform-summary')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-platform-summary');

-- Schedule cleanup of hourly metrics (daily at 3 AM UTC)
-- Removes metrics older than 7 days
SELECT cron.schedule(
  'cleanup-hourly-metrics',
  '0 3 * * *',
  $$SELECT cleanup_old_hourly_metrics()$$
);

-- Schedule cleanup of execution logs (daily at 4 AM UTC)
-- Removes logs older than 30 days
SELECT cron.schedule(
  'cleanup-execution-logs',
  '0 4 * * *',
  $$SELECT cleanup_old_execution_logs(30)$$
);

-- Schedule platform summary refresh (every hour at minute 0)
-- Refreshes materialized view for admin dashboard
SELECT cron.schedule(
  'refresh-platform-summary',
  '0 * * * *',
  $$SELECT refresh_platform_summary()$$
);

-- Verification query (run manually to confirm)
-- SELECT jobid, jobname, schedule, command FROM cron.job ORDER BY jobname;
