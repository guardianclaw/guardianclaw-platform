-- Migration: Setup Supabase Realtime for live update tables
-- Date: 2026-03-14
-- Description: Configure Realtime broadcasting for tables that require live updates.
--              Realtime requires two steps per table:
--              1. REPLICA IDENTITY FULL — ensures UPDATE/DELETE events include full row data
--                 (without this, UPDATE events only include new values, not old row state)
--              2. ALTER PUBLICATION supabase_realtime ADD TABLE — subscribes the table
--                 to Supabase's internal replication publication
--
-- NOTE: Without this migration, any Supabase Realtime subscription to these tables
--       will receive events for INSERT but not correctly handle UPDATE/DELETE payloads.
--       New Supabase projects created from this schema will have Realtime working
--       out of the box rather than requiring manual dashboard configuration.
--
-- TABLES CONFIGURED:
-- - conversations: real-time chat session updates (active/ended status)
-- - proposals:     governance voting — live vote count updates (votes_for, votes_against)
-- - execution_logs: agent execution monitoring — live status updates
--
-- NOTE ON NAMING: The audit plan referenced "executions" and "governance_proposals"
-- as table names. The actual table names in this schema are:
-- - execution_logs (in 20260115200000_add_execution_logs.sql)
-- - proposals (in 20260105000000_initial_schema.sql)
-- These are the correct names used here.
--
-- Dependencies:
-- - conversations from 20260109100000_add_conversations.sql
-- - proposals from 20260105000000_initial_schema.sql
-- - execution_logs from 20260115200000_add_execution_logs.sql

-- ============================================
-- 1. REPLICA IDENTITY FULL
-- ============================================
-- Without FULL, UPDATE events in Realtime only include new row values.
-- FULL ensures old and new row data are both available for client-side diffing.

ALTER TABLE conversations REPLICA IDENTITY FULL;
ALTER TABLE proposals REPLICA IDENTITY FULL;
ALTER TABLE execution_logs REPLICA IDENTITY FULL;

-- ============================================
-- 2. ADD TABLES TO REALTIME PUBLICATION
-- ============================================
-- supabase_realtime is the internal publication created by Supabase.
-- Tables must be explicitly added — they are not subscribed automatically.

ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE execution_logs;

-- ============================================
-- 3. DOCUMENTATION
-- ============================================

COMMENT ON TABLE conversations IS
    'User conversation sessions. Realtime-enabled: status changes broadcast to subscribers.';

COMMENT ON TABLE proposals IS
    'Governance proposals. Realtime-enabled: vote counts (votes_for, votes_against) broadcast live.';

COMMENT ON TABLE execution_logs IS
    'Agent execution log entries. Realtime-enabled: status updates broadcast to monitoring clients.';

-- ============================================
-- 4. VERIFICATION
-- ============================================
-- After applying, verify with:
--
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('conversations', 'proposals', 'execution_logs');
--
-- Check publication membership:
-- SELECT tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime'
-- AND tablename IN ('conversations', 'proposals', 'execution_logs');
--
-- Expected: 3 rows returned (one per table).
