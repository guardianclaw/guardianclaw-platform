-- Migration: Add RLS policies for llm_keys table
-- Purpose: Enforce zero-knowledge access control (SECURITY_SPEC Section 5.2)
-- Date: 2026-01-11
--
-- LLM keys are encrypted client-side and only the owner should be able to
-- access them. The server stores only encrypted blobs.

-- Helper function to get wallet from JWT (if not exists)
CREATE OR REPLACE FUNCTION current_wallet()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'wallet_address';
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "llm_keys_select_own" ON llm_keys;
DROP POLICY IF EXISTS "llm_keys_insert_own" ON llm_keys;
DROP POLICY IF EXISTS "llm_keys_update_own" ON llm_keys;
DROP POLICY IF EXISTS "llm_keys_delete_own" ON llm_keys;

-- Policy: Users can only SELECT their own keys
CREATE POLICY "llm_keys_select_own" ON llm_keys
    FOR SELECT
    USING (wallet_address = current_wallet());

-- Policy: Users can only INSERT keys for themselves
CREATE POLICY "llm_keys_insert_own" ON llm_keys
    FOR INSERT
    WITH CHECK (wallet_address = current_wallet());

-- Policy: Users can only UPDATE their own keys
CREATE POLICY "llm_keys_update_own" ON llm_keys
    FOR UPDATE
    USING (wallet_address = current_wallet())
    WITH CHECK (wallet_address = current_wallet());

-- Policy: Users can only DELETE their own keys
CREATE POLICY "llm_keys_delete_own" ON llm_keys
    FOR DELETE
    USING (wallet_address = current_wallet());

-- Add index for wallet lookup performance
CREATE INDEX IF NOT EXISTS idx_llm_keys_wallet ON llm_keys(wallet_address);

-- Add index for provider lookup (used when selecting keys by provider)
CREATE INDEX IF NOT EXISTS idx_llm_keys_provider ON llm_keys(wallet_address, provider);

-- Add comment documenting zero-knowledge architecture
COMMENT ON TABLE llm_keys IS 'Zero-knowledge encrypted LLM API keys. Server stores only encrypted blobs - never sees plaintext keys.';
