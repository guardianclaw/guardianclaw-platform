-- Migration: 20260125100000_fix_credits_rls_variable
-- Date: 2026-01-25
-- Description: Standardize RLS variable from app.current_user to app.wallet_address
-- Author: claw Team
--
-- This migration fixes an inconsistency where credits_system.sql used
-- app.current_user instead of the standard app.wallet_address variable.
--
-- The standard variable is app.wallet_address (used by 90% of migrations).
-- This ensures consistency across the codebase and prevents confusion.
--
-- Dependencies:
-- - user_credits from 20260121000000_credits_system.sql
-- - deposits from 20260121000000_credits_system.sql

-- ============================================
-- 1. FIX user_credits RLS POLICY
-- ============================================

-- Drop the old policy with incorrect variable
DROP POLICY IF EXISTS "Users can view their own credits" ON user_credits;

-- Create new policy with correct variable
CREATE POLICY "Users can view their own credits"
    ON user_credits
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- ============================================
-- 2. FIX deposits RLS POLICY
-- ============================================

-- Drop the old policy with incorrect variable
DROP POLICY IF EXISTS "Users can view their own deposits" ON deposits;

-- Create new policy with correct variable
CREATE POLICY "Users can view their own deposits"
    ON deposits
    FOR SELECT
    USING (wallet_address = current_setting('app.wallet_address', true));

-- ============================================
-- 3. VERIFICATION COMMENTS
-- ============================================

COMMENT ON POLICY "Users can view their own credits" ON user_credits IS
    'RLS policy using app.wallet_address (standardized in 20260125100000)';

COMMENT ON POLICY "Users can view their own deposits" ON deposits IS
    'RLS policy using app.wallet_address (standardized in 20260125100000)';
