-- Add execution tracking columns to proposals table
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS executed_by TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS execution_notes TEXT;

-- Ensure discussion_end_at exists (may already be present)
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS discussion_end_at TIMESTAMPTZ;
