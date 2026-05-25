-- ClawPay Sprint 1.1 — drainer_intel: deterministic lookup table for known
-- malicious addresses, endpoints, and patterns harvested from public threat
-- feeds (Blowfish, GoPlus, ScamSniffer, custom).
--
-- Why this matters: the calibration audit (Sessão #038) confirmed what the
-- broader guardrails literature already shows — classifier-based detection
-- is a coarse perimeter filter, not a structural trust boundary. For ClawPay
-- we want payment-blocking decisions to be deterministic and explainable:
-- "blocked because pay_to=0xABC matched ScamSniffer feed entry imported
-- 2026-05-21", not "blocked because classifier confidence was 0.73".
--
-- CredibilityGateValidator (sdk/.../coinbase/x402/validators.py) consults
-- this table at validation time. Ingesters refresh rows from public feeds
-- on a schedule (Modal cron / GitHub Action), upserting by
-- (kind, value_normalized, COALESCE(network, '')).

-- ============================================================================
-- 1. Enums for fixed vocabularies
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE drainer_intel_kind AS ENUM ('address', 'endpoint', 'pattern');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE drainer_intel_severity AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. drainer_intel table
-- ============================================================================

CREATE TABLE IF NOT EXISTS drainer_intel (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Type of indicator: address (EOA / SPL token / program), endpoint (URL),
    -- or pattern (regex matched against endpoint / asset / metadata).
    kind drainer_intel_kind NOT NULL,

    -- Original value as ingested. EVM ingesters lower-case before insert;
    -- Solana base58 preserves case. Use value_normalized for equality checks.
    value text NOT NULL,

    -- Generated lower-case copy for case-insensitive lookup and dedup.
    value_normalized text GENERATED ALWAYS AS (lower(value)) STORED,

    -- Network the indicator applies to. NULL = applies regardless of network
    -- (e.g. a phishing endpoint URL). Examples: 'base', 'base-sepolia',
    -- 'solana-mainnet', 'avalanche', 'ethereum'.
    network text,

    severity drainer_intel_severity NOT NULL DEFAULT 'high',

    -- Source feed identifier ('blowfish', 'goplus', 'scamsniffer', 'manual').
    source text NOT NULL,

    -- External reference (URL or vendor ID) for traceability and dispute review.
    source_ref text,

    -- Honor flag. Ingester may flip to false when a feed retracts an entry,
    -- preserving the audit trail rather than deleting.
    active boolean NOT NULL DEFAULT true,

    -- Feed-specific payload (drainer family name, IOC tags, detection method).
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

    -- Analyst notes for manual entries.
    notes text,

    first_seen_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Compound uniqueness for upsert. COALESCE on network so NULL ('all networks')
-- still dedupes correctly (Postgres treats NULL != NULL in unique indexes
-- without this).
CREATE UNIQUE INDEX IF NOT EXISTS drainer_intel_kind_value_network_unique
    ON drainer_intel (kind, value_normalized, COALESCE(network, ''));

-- Hot path: lookup by (kind, value) with active filter.
CREATE INDEX IF NOT EXISTS drainer_intel_active_kind_value
    ON drainer_intel (kind, value_normalized)
    WHERE active;

-- Network-scoped lookups.
CREATE INDEX IF NOT EXISTS drainer_intel_network_active
    ON drainer_intel (network, kind)
    WHERE active;

-- Pattern scans iterate all active patterns; small index helps that loop.
CREATE INDEX IF NOT EXISTS drainer_intel_patterns_active
    ON drainer_intel (kind)
    WHERE kind = 'pattern' AND active;

COMMENT ON TABLE drainer_intel IS
    'Deterministic threat intel for ClawPay CredibilityGate (Sprint 1, 2026-05-21). Populated by feed ingesters (Blowfish/GoPlus/ScamSniffer) plus manual analyst entries. Used to block payments to known-bad recipients/endpoints without relying on heuristic classifiers.';

COMMENT ON COLUMN drainer_intel.kind IS
    'address: EVM/SPL/program address. endpoint: URL or host. pattern: regex applied to endpoint/asset/metadata.';

COMMENT ON COLUMN drainer_intel.value IS
    'Original value as ingested. Use value_normalized for case-insensitive equality.';

COMMENT ON COLUMN drainer_intel.network IS
    'Restrict indicator to a specific network. NULL means the indicator applies regardless of network.';

-- ============================================================================
-- 3. updated_at trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION drainer_intel_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS drainer_intel_updated_at_trg ON drainer_intel;
CREATE TRIGGER drainer_intel_updated_at_trg
    BEFORE UPDATE ON drainer_intel
    FOR EACH ROW
    EXECUTE FUNCTION drainer_intel_set_updated_at();

-- ============================================================================
-- 4. RLS — read-only for authenticated, full access for service_role
-- ============================================================================
--
-- Intel is essentially public threat data — any authenticated tenant can read
-- it to validate their own payments. Writes are restricted to the ingester
-- worker running with service_role. Tenants consume, they do not contribute
-- (manual entries are reviewed off-band).

ALTER TABLE drainer_intel ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drainer_intel_select_authenticated ON drainer_intel;
CREATE POLICY drainer_intel_select_authenticated
    ON drainer_intel
    FOR SELECT
    TO authenticated
    USING (active);

-- service_role bypasses RLS automatically — no policy needed for writes.

-- ============================================================================
-- 5. Feed-sync bookkeeping
-- ============================================================================
--
-- Tracks ingester runs so we can show "last sync from <source> at <time>" in
-- the dashboard and detect stalled feeds. Separate from drainer_intel because
-- a single sync may upsert thousands of rows but is one logical event.

CREATE TABLE IF NOT EXISTS drainer_intel_sync_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source text NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    rows_upserted integer NOT NULL DEFAULT 0,
    rows_deactivated integer NOT NULL DEFAULT 0,
    error text,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS drainer_intel_sync_log_source_started
    ON drainer_intel_sync_log (source, started_at DESC);

COMMENT ON TABLE drainer_intel_sync_log IS
    'Audit trail for drainer_intel ingester runs. One row per sync attempt.';

ALTER TABLE drainer_intel_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS drainer_intel_sync_log_select_authenticated ON drainer_intel_sync_log;
CREATE POLICY drainer_intel_sync_log_select_authenticated
    ON drainer_intel_sync_log
    FOR SELECT
    TO authenticated
    USING (true);
