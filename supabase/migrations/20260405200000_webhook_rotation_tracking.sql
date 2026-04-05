-- Migration: Add webhook secret rotation tracking
-- Date: 2026-04-05
-- Description: Tracks when webhook secrets were last rotated for security auditing.

ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;

COMMENT ON COLUMN webhooks.rotated_at IS 'Timestamp of last secret rotation';
