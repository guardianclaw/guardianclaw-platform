-- ClawPay Sprint 4 — pre-flight simulation field on clawpay_audit_events.
--
-- Sprints 1-3 covered keyword detection (deprecated), drainer-intel lookup,
-- and provider distinction. Sprint 4 adds on-chain pre-flight simulation
-- via Helius (Solana) and Tenderly (EVM). The simulator returns a structured
-- result the dashboard needs to render: status, balance changes, ownership
-- reassignments, log excerpts, raw error.
--
-- We store the entire SimulationResult.to_audit_dict() payload as JSONB —
-- the shape is provider-agnostic and stable across releases, so it survives
-- a schema migration. Querying by status uses a functional index on the
-- jsonb 'status' key.
--
-- Default NULL means the row was created without simulation data (the
-- common case before this migration, and any caller that explicitly opts
-- out of pre-flight simulation). The Avoidance gate already treats absent
-- simulation as a no-op risk_factor, so adding the column does not change
-- runtime semantics for existing callers.

ALTER TABLE clawpay_audit_events
    ADD COLUMN IF NOT EXISTS simulation jsonb;

COMMENT ON COLUMN clawpay_audit_events.simulation IS
    'Optional pre-flight simulation outcome (Sprint 4, 2026-05-21). Provider-agnostic shape: {status, provider, message, balance_changes[], ownership_changes[], logs_excerpt[], raw_error, duration_ms}. NULL when no SimulationProvider was configured.';

-- Hot path: "show me events where the simulation flagged a balance discrepancy".
-- The dashboard filters and the alerts engine both want sub-second lookups
-- by simulation.status, so a functional GIN-on-text index keeps the
-- working set scan-free.
CREATE INDEX IF NOT EXISTS clawpay_audit_events_simulation_status
    ON clawpay_audit_events ((simulation ->> 'status'))
    WHERE simulation IS NOT NULL;
