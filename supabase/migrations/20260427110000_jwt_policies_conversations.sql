-- JWT-claims RLS policies for conversations + conversation_messages + conversation_context.
--
-- Continues Frente B.1 (audit F-01 / P0.1). Same shape as 20260427000000
-- (llm_keys) and 20260427100000 (agents): parallel PERMISSIVE policies that
-- match when the request JWT carries wallet_address. The existing
-- current_setting('app.wallet_address') policies stay; PERMISSIVE policies
-- OR, so non-migrated routes keep working through service-role bypass.
--
-- conversations has wallet_address directly. conversation_messages and
-- conversation_context flow ownership via JOIN through conversations.

-- ============================================
-- conversations
-- ============================================

CREATE POLICY conversations_select_jwt ON conversations
    FOR SELECT
    USING (wallet_address = jwt_wallet_address());

CREATE POLICY conversations_insert_jwt ON conversations
    FOR INSERT
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY conversations_update_jwt ON conversations
    FOR UPDATE
    USING (wallet_address = jwt_wallet_address())
    WITH CHECK (wallet_address = jwt_wallet_address());

CREATE POLICY conversations_delete_jwt ON conversations
    FOR DELETE
    USING (wallet_address = jwt_wallet_address());

-- ============================================
-- conversation_messages — ownership via conversations JOIN
-- ============================================

CREATE POLICY conversation_messages_select_jwt ON conversation_messages
    FOR SELECT
    USING (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY conversation_messages_insert_jwt ON conversation_messages
    FOR INSERT
    WITH CHECK (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY conversation_messages_update_jwt ON conversation_messages
    FOR UPDATE
    USING (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    )
    WITH CHECK (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY conversation_messages_delete_jwt ON conversation_messages
    FOR DELETE
    USING (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );

-- ============================================
-- conversation_context — ownership via conversations JOIN
-- ============================================

CREATE POLICY conversation_context_select_jwt ON conversation_context
    FOR SELECT
    USING (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY conversation_context_insert_jwt ON conversation_context
    FOR INSERT
    WITH CHECK (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY conversation_context_update_jwt ON conversation_context
    FOR UPDATE
    USING (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    )
    WITH CHECK (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );

CREATE POLICY conversation_context_delete_jwt ON conversation_context
    FOR DELETE
    USING (
      conversation_id IN (
        SELECT id FROM conversations WHERE wallet_address = jwt_wallet_address()
      )
    );
