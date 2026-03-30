-- Migration: Add key_salt column to api_keys table
-- Purpose: Support PBKDF2-SHA256 hashing for API keys (SECURITY_SPEC Section 3.3)
-- Date: 2026-01-11
--
-- This migration adds a salt column for PBKDF2 key hashing.
-- Existing keys without salt will use legacy SHA-256 verification (backwards compatible).

-- Add key_salt column (nullable for backwards compatibility with existing keys)
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_salt TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN api_keys.key_salt IS 'PBKDF2 salt for key hashing (null = legacy SHA-256)';

-- Create index on key_prefix for efficient lookup (used in PBKDF2 verification flow)
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
