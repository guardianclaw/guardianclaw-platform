-- Job Executions History Table
-- Phase 5: Cron Job Monitoring & Audit Trail
-- Tracks all scheduled job executions for debugging and monitoring

-- ============================================
-- JOB EXECUTIONS (Cron Job History)
-- ============================================
-- Persistent record of every cron job execution
CREATE TABLE IF NOT EXISTS job_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Job identification
    job_name TEXT NOT NULL,
    cron_pattern TEXT NOT NULL,
    -- Execution details
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    -- Status: 'running', 'success', 'failed', 'timeout'
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed', 'timeout')),
    -- Error details if failed
    error_message TEXT,
    error_stack TEXT,
    -- Job output/metrics (e.g., rows processed, records cleaned up)
    details JSONB DEFAULT '{}',
    -- Environment info
    environment TEXT,
    worker_id TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for job_executions
CREATE INDEX IF NOT EXISTS idx_job_executions_job_name ON job_executions(job_name);
CREATE INDEX IF NOT EXISTS idx_job_executions_started ON job_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);
CREATE INDEX IF NOT EXISTS idx_job_executions_job_status ON job_executions(job_name, status);
-- Composite index for health check queries
CREATE INDEX IF NOT EXISTS idx_job_executions_recent ON job_executions(job_name, started_at DESC);

-- Comments
COMMENT ON TABLE job_executions IS 'Audit trail for cron job executions. Used by /admin/cron/health endpoint.';
COMMENT ON COLUMN job_executions.job_name IS 'Job identifier (e.g., aggregate_hourly_metrics, check_alert_rules)';
COMMENT ON COLUMN job_executions.cron_pattern IS 'Cron expression that triggered this job';
COMMENT ON COLUMN job_executions.details IS 'Job-specific output: {rows_processed, records_deleted, alerts_created, etc.}';
COMMENT ON COLUMN job_executions.worker_id IS 'Cloudflare Worker instance ID for distributed tracing';

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE job_executions ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by API and cron jobs)
-- No user-level policies - this is an internal monitoring table

-- ============================================
-- CLEANUP FUNCTION
-- ============================================
-- Remove old job execution records (retain 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_job_executions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM job_executions
    WHERE started_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_job_executions IS 'Remove job executions older than 30 days. Returns count of deleted records.';

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Get latest execution for each job (for health check)
CREATE OR REPLACE FUNCTION get_job_health_status()
RETURNS TABLE (
    job_name TEXT,
    last_run TIMESTAMPTZ,
    last_status TEXT,
    last_duration_ms INTEGER,
    last_error TEXT,
    runs_24h INTEGER,
    failures_24h INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH latest AS (
        SELECT DISTINCT ON (je.job_name)
            je.job_name,
            je.started_at,
            je.status,
            je.duration_ms,
            je.error_message
        FROM job_executions je
        ORDER BY je.job_name, je.started_at DESC
    ),
    stats AS (
        SELECT
            je.job_name,
            COUNT(*)::INTEGER as total_runs,
            COUNT(*) FILTER (WHERE je.status = 'failed')::INTEGER as total_failures
        FROM job_executions je
        WHERE je.started_at > NOW() - INTERVAL '24 hours'
        GROUP BY je.job_name
    )
    SELECT
        l.job_name,
        l.started_at as last_run,
        l.status as last_status,
        l.duration_ms as last_duration_ms,
        l.error_message as last_error,
        COALESCE(s.total_runs, 0) as runs_24h,
        COALESCE(s.total_failures, 0) as failures_24h
    FROM latest l
    LEFT JOIN stats s ON l.job_name = s.job_name
    ORDER BY l.job_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_job_health_status IS 'Returns health status for all jobs. Used by /admin/cron/health endpoint.';

-- Record job start (returns job execution ID)
CREATE OR REPLACE FUNCTION record_job_start(
    p_job_name TEXT,
    p_cron_pattern TEXT,
    p_environment TEXT DEFAULT NULL,
    p_worker_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO job_executions (job_name, cron_pattern, environment, worker_id, status)
    VALUES (p_job_name, p_cron_pattern, p_environment, p_worker_id, 'running')
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_job_start IS 'Record job execution start. Returns execution ID for subsequent update.';

-- Record job completion
CREATE OR REPLACE FUNCTION record_job_finish(
    p_execution_id UUID,
    p_status TEXT,
    p_details JSONB DEFAULT '{}',
    p_error_message TEXT DEFAULT NULL,
    p_error_stack TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_started TIMESTAMPTZ;
BEGIN
    -- Get start time for duration calculation
    SELECT started_at INTO v_started
    FROM job_executions
    WHERE id = p_execution_id;

    -- Update the execution record
    UPDATE job_executions
    SET
        finished_at = NOW(),
        duration_ms = EXTRACT(MILLISECONDS FROM (NOW() - v_started))::INTEGER,
        status = p_status,
        details = p_details,
        error_message = p_error_message,
        error_stack = p_error_stack
    WHERE id = p_execution_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION record_job_finish IS 'Record job execution completion with status and details.';
