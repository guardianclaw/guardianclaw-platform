-- Migration: 004_webhooks
-- Date: 2026-01-13
-- Description: Add webhook triggers and delivery system for external integrations
--
-- This migration adds:
-- 1. webhooks - Inbound webhook triggers for external systems
-- 2. webhook_endpoints - Outbound delivery destinations
-- 3. webhook_deliveries - Delivery audit log (metadata only per SECURITY_SPEC)

-- ============================================
-- WEBHOOKS (inbound triggers)
-- ============================================
-- Allows external systems (Discord, Telegram, Slack, custom apps)
-- to trigger agent execution via HTTP POST with HMAC signature.
CREATE TABLE webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default Webhook',
    -- HMAC-SHA256 signing secret storage
    -- For HMAC verification we need the original secret, not just a hash.
    -- We store it encrypted with AES-256-GCM using the server's JWT_SECRET as key.
    secret_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted secret
    secret_iv TEXT NOT NULL,         -- Initialization vector for AES-GCM
    secret_prefix TEXT NOT NULL,     -- First 8 chars for identification (unencrypted)
    is_active BOOLEAN DEFAULT true,
    -- Rate limiting per webhook (requests per minute)
    rate_limit INTEGER DEFAULT 60 CHECK (rate_limit >= 1 AND rate_limit <= 1000),
    -- Optional IP whitelist (empty = allow all)
    allowed_ips TEXT[] DEFAULT '{}',
    -- Metadata passthrough configuration
    -- If true, metadata from trigger request is passed to agent
    pass_metadata BOOLEAN DEFAULT true,
    -- Statistics (no content stored)
    trigger_count BIGINT DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WEBHOOK ENDPOINTS (outbound delivery)
-- ============================================
-- Configures where agent responses are delivered after execution.
-- Supports retry with exponential backoff.
CREATE TABLE webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default Endpoint',
    -- Destination URL (must be HTTPS in production)
    url TEXT NOT NULL,
    -- HMAC-SHA256 signing secret for outbound requests
    -- Allows recipient to verify payload authenticity.
    -- For HMAC signing we need the original secret, not just a hash.
    -- We store it encrypted with AES-256-GCM using the server's JWT_SECRET as key.
    secret_encrypted TEXT NOT NULL,  -- AES-256-GCM encrypted secret
    secret_iv TEXT NOT NULL,         -- Initialization vector for AES-GCM
    secret_prefix TEXT NOT NULL,     -- First 8 chars for identification (unencrypted)
    -- Custom headers to include in delivery requests
    -- Stored as JSON object: {"Authorization": "Bearer xxx"}
    headers JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    -- Retry configuration
    retry_count INTEGER DEFAULT 3 CHECK (retry_count >= 0 AND retry_count <= 10),
    timeout_ms INTEGER DEFAULT 30000 CHECK (timeout_ms >= 1000 AND timeout_ms <= 120000),
    -- Event filters (empty = deliver all events)
    -- Examples: ["agent.response", "agent.blocked"]
    event_types TEXT[] DEFAULT '{}',
    -- Statistics (no content stored)
    delivery_count BIGINT DEFAULT 0,
    success_count BIGINT DEFAULT 0,
    failure_count BIGINT DEFAULT 0,
    last_delivery_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WEBHOOK DELIVERIES (delivery audit log)
-- ============================================
-- Tracks delivery attempts for debugging, monitoring, and retry processing.
-- Payload is stored encrypted (AES-256-GCM) to enable retries while maintaining security.
CREATE TABLE webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    -- Execution reference (if triggered by webhook)
    execution_id UUID,
    -- Event type being delivered
    event_type TEXT NOT NULL DEFAULT 'agent.response',
    -- Encrypted payload for retry processing
    -- Stored with AES-256-GCM encryption using server's JWT_SECRET
    -- This enables retries while keeping payload secure at rest
    payload_encrypted TEXT NOT NULL,
    payload_iv TEXT NOT NULL,
    -- Delivery status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    -- Attempt tracking
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    next_attempt_at TIMESTAMPTZ,
    -- Response metadata (no body content)
    response_status INTEGER,
    response_time_ms INTEGER,
    -- Error tracking (sanitized, no PII)
    error_code TEXT,
    error_message TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================
-- Webhooks
CREATE INDEX idx_webhooks_agent_id ON webhooks(agent_id);
CREATE INDEX idx_webhooks_active ON webhooks(agent_id, is_active) WHERE is_active = true;

-- Webhook Endpoints
CREATE INDEX idx_webhook_endpoints_agent_id ON webhook_endpoints(agent_id);
CREATE INDEX idx_webhook_endpoints_active ON webhook_endpoints(agent_id, is_active) WHERE is_active = true;

-- Webhook Deliveries
CREATE INDEX idx_webhook_deliveries_endpoint ON webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_agent ON webhook_deliveries(agent_id);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status)
    WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_next_attempt ON webhook_deliveries(next_attempt_at)
    WHERE status = 'retrying' AND next_attempt_at IS NOT NULL;
CREATE INDEX idx_webhook_deliveries_created ON webhook_deliveries(created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- FUNCTIONS
-- ============================================

-- Increment webhook trigger count (called on successful trigger)
CREATE OR REPLACE FUNCTION increment_webhook_trigger(p_webhook_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE webhooks
    SET
        trigger_count = trigger_count + 1,
        last_triggered_at = NOW()
    WHERE id = p_webhook_id;
END;
$$ LANGUAGE plpgsql;

-- Record webhook error (called on trigger failure)
CREATE OR REPLACE FUNCTION record_webhook_error(p_webhook_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE webhooks
    SET last_error_at = NOW()
    WHERE id = p_webhook_id;
END;
$$ LANGUAGE plpgsql;

-- Increment endpoint delivery stats
CREATE OR REPLACE FUNCTION update_endpoint_stats(
    p_endpoint_id UUID,
    p_success BOOLEAN
)
RETURNS void AS $$
BEGIN
    IF p_success THEN
        UPDATE webhook_endpoints
        SET
            delivery_count = delivery_count + 1,
            success_count = success_count + 1,
            last_delivery_at = NOW(),
            last_success_at = NOW()
        WHERE id = p_endpoint_id;
    ELSE
        UPDATE webhook_endpoints
        SET
            delivery_count = delivery_count + 1,
            failure_count = failure_count + 1,
            last_delivery_at = NOW(),
            last_failure_at = NOW()
        WHERE id = p_endpoint_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Get pending deliveries for retry processing
CREATE OR REPLACE FUNCTION get_pending_deliveries(p_limit INTEGER DEFAULT 100)
RETURNS TABLE (
    delivery_id UUID,
    endpoint_id UUID,
    agent_id UUID,
    event_type TEXT,
    attempts INTEGER,
    max_attempts INTEGER,
    payload_encrypted TEXT,
    payload_iv TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id AS delivery_id,
        d.endpoint_id,
        d.agent_id,
        d.event_type,
        d.attempts,
        d.max_attempts,
        d.payload_encrypted,
        d.payload_iv
    FROM webhook_deliveries d
    JOIN webhook_endpoints e ON d.endpoint_id = e.id
    WHERE d.status = 'retrying'
        AND d.next_attempt_at <= NOW()
        AND e.is_active = true
    ORDER BY d.next_attempt_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old delivery records (retention: 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_deliveries(p_retention_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_deliveries
    WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
        AND status IN ('success', 'failed');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE webhooks IS 'Inbound webhook triggers for external system integration';
COMMENT ON TABLE webhook_endpoints IS 'Outbound webhook delivery destinations';
COMMENT ON TABLE webhook_deliveries IS 'Delivery audit log (metadata only, no content per SECURITY_SPEC)';

COMMENT ON COLUMN webhooks.secret_encrypted IS 'AES-256-GCM encrypted secret for HMAC signature verification';
COMMENT ON COLUMN webhook_endpoints.secret_encrypted IS 'AES-256-GCM encrypted secret for HMAC signature generation';
COMMENT ON COLUMN webhooks.allowed_ips IS 'Optional IP whitelist, empty array allows all IPs';
COMMENT ON COLUMN webhook_endpoints.headers IS 'Custom headers as JSON, e.g. {"Authorization": "Bearer ..."}';
COMMENT ON COLUMN webhook_deliveries.error_message IS 'Sanitized error message, no PII';
