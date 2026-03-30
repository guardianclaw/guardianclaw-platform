-- claw Platform Database Schema
-- Version: 3.0
-- Date: 2026-01-05

-- Using gen_random_uuid() which is native to PostgreSQL 13+

-- ============================================
-- PROFILES (wallet-based)
-- ============================================
CREATE TABLE profiles (
    wallet_address TEXT PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'pro')),
    plan_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUTH SESSIONS
-- ============================================
CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    nonce TEXT NOT NULL,
    signature TEXT,
    token_hash TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- ============================================
-- AGENTS
-- ============================================
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'bot',
    framework TEXT NOT NULL DEFAULT 'langchain',
    flow JSONB NOT NULL DEFAULT '{"nodes": [], "edges": []}',
    config JSONB NOT NULL DEFAULT '{}',
    claw_config JSONB NOT NULL DEFAULT '{
        "protection_level": "standard",
        "gates": {"credibility": true, "avoidance": true, "limits": true, "worth": true},
        "sdk_version": "auto"
    }',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'testing', 'deployed', 'archived')),
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEPLOYMENTS
-- ============================================
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'failed')),
    config_snapshot JSONB NOT NULL,
    endpoint_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    stopped_at TIMESTAMPTZ
);

-- ============================================
-- API KEYS
-- ============================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Default',
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    rate_limit INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- ============================================
-- LLM KEYS (zero-knowledge encrypted per ADR-004)
-- ============================================
CREATE TABLE llm_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    -- Encrypted client-side, server never sees plaintext
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    salt TEXT NOT NULL,
    key_preview TEXT NOT NULL, -- Last 4 chars only
    name TEXT DEFAULT 'Default',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, provider, name)
);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT REFERENCES profiles(wallet_address) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro')),
    payment_token TEXT NOT NULL,
    amount_lamports BIGINT NOT NULL,
    tx_signature TEXT UNIQUE NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGENT EVENTS (metadata only per SECURITY_SPEC)
-- ============================================
CREATE TABLE agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    -- No prompt/output content stored
    input_tokens INTEGER,
    output_tokens INTEGER,
    claw_blocked BOOLEAN DEFAULT false,
    claw_gate TEXT,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USAGE DAILY
-- ============================================
CREATE TABLE usage_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT REFERENCES profiles(wallet_address),
    agent_id UUID REFERENCES agents(id),
    date DATE NOT NULL,
    requests_count INTEGER DEFAULT 0,
    blocked_count INTEGER DEFAULT 0,
    total_latency_ms BIGINT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wallet_address, agent_id, date)
);

-- ============================================
-- GOVERNANCE: PROPOSALS
-- ============================================
CREATE TABLE proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    author_wallet TEXT REFERENCES profiles(wallet_address),
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'passed', 'rejected', 'executed')),
    votes_for BIGINT DEFAULT 0,
    votes_against BIGINT DEFAULT 0,
    snapshot_slot BIGINT,
    voting_ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GOVERNANCE: VOTES
-- ============================================
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    wallet_address TEXT REFERENCES profiles(wallet_address),
    vote_power BIGINT NOT NULL,
    vote_direction TEXT NOT NULL CHECK (vote_direction IN ('for', 'against')),
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proposal_id, wallet_address)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_agents_wallet ON agents(wallet_address);
CREATE INDEX idx_agents_status ON agents(status);
CREATE INDEX idx_events_agent ON agent_events(agent_id);
CREATE INDEX idx_events_created ON agent_events(created_at);
CREATE INDEX idx_usage_date ON usage_daily(date);
CREATE INDEX idx_usage_wallet ON usage_daily(wallet_address);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_sessions_wallet ON auth_sessions(wallet_address);
CREATE INDEX idx_sessions_expires ON auth_sessions(expires_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FUNCTIONS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
