-- Migration: 20260128000000_add_conversations_rls_policies
-- Date: 2026-01-28
-- Description: Add missing RLS policies for conversations, conversation_messages, and conversation_context tables
-- Author: claw Team
--
-- CONTEXT:
-- The original migration (20260109100000_add_conversations.sql) enabled RLS on these tables
-- but did not create the actual policies. This left the tables in a locked state where:
-- - All queries as authenticated user would fail with "permission denied"
-- - Only service_role operations would succeed
--
-- The API uses service_role (via SUPABASE_SERVICE_KEY) which bypasses RLS, so this issue
-- did not manifest in production. However, RLS policies are required for defense-in-depth
-- security and to enable future direct database access patterns.
--
-- SOLUTION:
-- This migration creates comprehensive RLS policies following the established patterns from:
-- - 20260125000000_agent_alert_rules.sql (most recent, complete pattern)
-- - 20260111100000_add_llm_keys_rls_policies.sql (CRUD operations pattern)
--
-- POLICY DESIGN:
-- 1. conversations table: Direct wallet_address ownership check
-- 2. conversation_messages table: Indirect ownership via parent conversation
-- 3. conversation_context table: Indirect ownership via parent conversation
-- 4. Service role bypass: Allows API and scheduled workers to operate
--
-- STANDARD VARIABLE: app.wallet_address (set by API middleware)
--
-- Dependencies:
-- - conversations from 20260109100000_add_conversations.sql
-- - conversation_messages from 20260109100000_add_conversations.sql
-- - conversation_context from 20260109100000_add_conversations.sql

-- ============================================
-- 1. CONVERSATIONS TABLE POLICIES
-- ============================================
-- Direct ownership: conversations.wallet_address = current user

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS conversations_select_policy ON conversations;
DROP POLICY IF EXISTS conversations_insert_policy ON conversations;
DROP POLICY IF EXISTS conversations_update_policy ON conversations;
DROP POLICY IF EXISTS conversations_delete_policy ON conversations;
DROP POLICY IF EXISTS conversations_service_policy ON conversations;

-- Policy: Users can only SELECT their own conversations
CREATE POLICY conversations_select_policy ON conversations
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only INSERT conversations for themselves
CREATE POLICY conversations_insert_policy ON conversations
    FOR INSERT
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only UPDATE their own conversations
CREATE POLICY conversations_update_policy ON conversations
    FOR UPDATE
    USING (wallet_address = current_setting('app.wallet_address', true))
    WITH CHECK (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Users can only DELETE their own conversations
CREATE POLICY conversations_delete_policy ON conversations
    FOR DELETE
    USING (wallet_address = current_setting('app.wallet_address', true));

-- Policy: Service role can perform all operations (API and scheduled workers)
CREATE POLICY conversations_service_policy ON conversations
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 2. CONVERSATION_MESSAGES TABLE POLICIES
-- ============================================
-- Indirect ownership: messages belong to a conversation owned by the user

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS conversation_messages_select_policy ON conversation_messages;
DROP POLICY IF EXISTS conversation_messages_insert_policy ON conversation_messages;
DROP POLICY IF EXISTS conversation_messages_update_policy ON conversation_messages;
DROP POLICY IF EXISTS conversation_messages_delete_policy ON conversation_messages;
DROP POLICY IF EXISTS conversation_messages_service_policy ON conversation_messages;

-- Policy: Users can only SELECT messages from their own conversations
CREATE POLICY conversation_messages_select_policy ON conversation_messages
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only INSERT messages into their own conversations
CREATE POLICY conversation_messages_insert_policy ON conversation_messages
    FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only UPDATE messages in their own conversations
CREATE POLICY conversation_messages_update_policy ON conversation_messages
    FOR UPDATE
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    )
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only DELETE messages from their own conversations
CREATE POLICY conversation_messages_delete_policy ON conversation_messages
    FOR DELETE
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Service role can perform all operations
CREATE POLICY conversation_messages_service_policy ON conversation_messages
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 3. CONVERSATION_CONTEXT TABLE POLICIES
-- ============================================
-- Indirect ownership: context belongs to a conversation owned by the user

-- Drop any existing policies (idempotent)
DROP POLICY IF EXISTS conversation_context_select_policy ON conversation_context;
DROP POLICY IF EXISTS conversation_context_insert_policy ON conversation_context;
DROP POLICY IF EXISTS conversation_context_update_policy ON conversation_context;
DROP POLICY IF EXISTS conversation_context_delete_policy ON conversation_context;
DROP POLICY IF EXISTS conversation_context_service_policy ON conversation_context;

-- Policy: Users can only SELECT context from their own conversations
CREATE POLICY conversation_context_select_policy ON conversation_context
    FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only INSERT context into their own conversations
CREATE POLICY conversation_context_insert_policy ON conversation_context
    FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only UPDATE context in their own conversations
CREATE POLICY conversation_context_update_policy ON conversation_context
    FOR UPDATE
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    )
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Users can only DELETE context from their own conversations
CREATE POLICY conversation_context_delete_policy ON conversation_context
    FOR DELETE
    USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE wallet_address = current_setting('app.wallet_address', true)
        )
    );

-- Policy: Service role can perform all operations
CREATE POLICY conversation_context_service_policy ON conversation_context
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ============================================
-- 4. POLICY COMMENTS (Documentation)
-- ============================================

COMMENT ON POLICY conversations_select_policy ON conversations IS
    'RLS: Users can only view their own conversations (defense-in-depth)';

COMMENT ON POLICY conversations_insert_policy ON conversations IS
    'RLS: Users can only create conversations for themselves';

COMMENT ON POLICY conversations_update_policy ON conversations IS
    'RLS: Users can only modify their own conversations';

COMMENT ON POLICY conversations_delete_policy ON conversations IS
    'RLS: Users can only delete their own conversations';

COMMENT ON POLICY conversations_service_policy ON conversations IS
    'RLS: Service role bypass for API and scheduled workers';

COMMENT ON POLICY conversation_messages_select_policy ON conversation_messages IS
    'RLS: Users can only view messages from their own conversations';

COMMENT ON POLICY conversation_messages_insert_policy ON conversation_messages IS
    'RLS: Users can only add messages to their own conversations';

COMMENT ON POLICY conversation_messages_update_policy ON conversation_messages IS
    'RLS: Users can only modify messages in their own conversations';

COMMENT ON POLICY conversation_messages_delete_policy ON conversation_messages IS
    'RLS: Users can only delete messages from their own conversations';

COMMENT ON POLICY conversation_messages_service_policy ON conversation_messages IS
    'RLS: Service role bypass for API and scheduled workers';

COMMENT ON POLICY conversation_context_select_policy ON conversation_context IS
    'RLS: Users can only view context from their own conversations';

COMMENT ON POLICY conversation_context_insert_policy ON conversation_context IS
    'RLS: Users can only create context for their own conversations';

COMMENT ON POLICY conversation_context_update_policy ON conversation_context IS
    'RLS: Users can only modify context in their own conversations';

COMMENT ON POLICY conversation_context_delete_policy ON conversation_context IS
    'RLS: Users can only delete context from their own conversations';

COMMENT ON POLICY conversation_context_service_policy ON conversation_context IS
    'RLS: Service role bypass for API and scheduled workers';

-- ============================================
-- 5. VERIFICATION QUERY (for testing)
-- ============================================
-- Run this query after migration to verify policies were created:
--
-- SELECT
--     schemaname,
--     tablename,
--     policyname,
--     permissive,
--     roles,
--     cmd,
--     qual IS NOT NULL AS has_using,
--     with_check IS NOT NULL AS has_with_check
-- FROM pg_policies
-- WHERE tablename IN ('conversations', 'conversation_messages', 'conversation_context')
-- ORDER BY tablename, policyname;
--
-- Expected: 15 policies (5 per table: select, insert, update, delete, service)
