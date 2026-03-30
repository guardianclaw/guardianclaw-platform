-- Fix Credits Atomicity Migration
-- claw Platform v3.0
-- Date: 2026-01-31
-- Description: Atomic deposits, improved deduct_credits, admin adjust fix

-- Drop old deduct_credits (return type changed: added balance_before column)
DROP FUNCTION IF EXISTS deduct_credits(TEXT, DECIMAL);

-- ============================================
-- 1. ATOMIC DEPOSIT PROCESSING (FIX #1)
-- Combines deposit record + credit update in single transaction
-- Also handles duplicate tx_signature via UNIQUE constraint
-- ============================================
CREATE OR REPLACE FUNCTION process_deposit(
  p_wallet_address TEXT,
  p_token TEXT,
  p_amount DECIMAL(18, 6),
  p_price_usd DECIMAL(10, 4),
  p_credits_usd DECIMAL(10, 4),
  p_bonus_applied DECIMAL(4, 2),
  p_tx_signature TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  deposit_id UUID,
  new_balance DECIMAL(10, 4),
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deposit_id UUID;
  v_new_balance DECIMAL(10, 4);
BEGIN
  -- Insert deposit (UNIQUE constraint on tx_signature prevents replay)
  BEGIN
    INSERT INTO deposits (wallet_address, token, amount, price_usd, credits_usd, bonus_applied, tx_signature, status)
    VALUES (p_wallet_address, p_token, p_amount, p_price_usd, p_credits_usd, p_bonus_applied, p_tx_signature, 'confirmed')
    RETURNING id INTO v_deposit_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT false, NULL::UUID, 0::DECIMAL(10,4), 'DUPLICATE_TRANSACTION'::TEXT;
    RETURN;
  END;

  -- Add credits (upsert)
  INSERT INTO user_credits (wallet_address, balance_usd, total_deposited)
  VALUES (p_wallet_address, p_credits_usd, p_credits_usd)
  ON CONFLICT (wallet_address) DO UPDATE
  SET balance_usd = user_credits.balance_usd + p_credits_usd,
      total_deposited = user_credits.total_deposited + p_credits_usd,
      updated_at = NOW()
  RETURNING balance_usd INTO v_new_balance;

  RETURN QUERY SELECT true, v_deposit_id, v_new_balance, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION process_deposit IS 'Atomic deposit: inserts record + updates credits in single transaction';

-- ============================================
-- 2. IMPROVED DEDUCT CREDITS (FIX #6)
-- Now returns balance_before from the locked row
-- ============================================
CREATE OR REPLACE FUNCTION deduct_credits(
  p_wallet_address TEXT,
  p_amount DECIMAL(10, 4)
)
RETURNS TABLE(success BOOLEAN, balance_before DECIMAL(10, 4), new_balance DECIMAL(10, 4), error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL(10, 4);
  v_new_balance DECIMAL(10, 4);
BEGIN
  -- Lock row for update to prevent race conditions
  SELECT balance_usd INTO v_current_balance
  FROM user_credits
  WHERE wallet_address = p_wallet_address
  FOR UPDATE;

  -- Check if wallet exists
  IF v_current_balance IS NULL THEN
    RETURN QUERY SELECT false, 0::DECIMAL(10,4), 0::DECIMAL(10,4), 'NO_CREDITS_ACCOUNT'::TEXT;
    RETURN;
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, v_current_balance, 'INSUFFICIENT_CREDITS'::TEXT;
    RETURN;
  END IF;

  -- Deduct credits
  v_new_balance := v_current_balance - p_amount;

  UPDATE user_credits
  SET balance_usd = v_new_balance,
      total_spent = total_spent + p_amount,
      updated_at = NOW()
  WHERE wallet_address = p_wallet_address;

  RETURN QUERY SELECT true, v_current_balance, v_new_balance, NULL::TEXT;
END;
$$;

-- ============================================
-- 3. FIX ADMIN ADJUST CREDITS (FIX #8)
-- Adjustments should NOT inflate total_deposited or total_spent
-- ============================================
CREATE OR REPLACE FUNCTION admin_adjust_credits(
  p_wallet_address TEXT,
  p_amount DECIMAL(10, 4),
  p_type TEXT,
  p_reason TEXT,
  p_admin_hash TEXT,
  p_reference_id TEXT DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  new_balance DECIMAL(10, 4),
  adjustment_id UUID,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance DECIMAL(10, 4);
  v_new_balance DECIMAL(10, 4);
  v_adjustment_id UUID;
BEGIN
  -- Get current balance with lock
  SELECT balance_usd INTO v_current_balance
  FROM user_credits
  WHERE wallet_address = p_wallet_address
  FOR UPDATE;

  -- Create account if doesn't exist
  IF v_current_balance IS NULL THEN
    INSERT INTO user_credits (wallet_address, balance_usd, total_deposited, total_spent)
    VALUES (p_wallet_address, 0, 0, 0);
    v_current_balance := 0;
  END IF;

  -- Calculate new balance
  v_new_balance := v_current_balance + p_amount;

  -- Check if resulting balance would be negative
  IF v_new_balance < 0 THEN
    RETURN QUERY SELECT false, v_current_balance, NULL::UUID, 'INSUFFICIENT_BALANCE'::TEXT;
    RETURN;
  END IF;

  -- Update balance only (adjustments are not real deposits/spending)
  UPDATE user_credits
  SET balance_usd = v_new_balance,
      updated_at = NOW()
  WHERE wallet_address = p_wallet_address;

  -- Record adjustment with full audit trail
  INSERT INTO credit_adjustments (
    wallet_address,
    amount,
    type,
    reason,
    admin_wallet_hash,
    reference_id,
    reference_type,
    balance_before,
    balance_after
  )
  VALUES (
    p_wallet_address,
    p_amount,
    p_type,
    p_reason,
    p_admin_hash,
    p_reference_id,
    p_reference_type,
    v_current_balance,
    v_new_balance
  )
  RETURNING id INTO v_adjustment_id;

  RETURN QUERY SELECT true, v_new_balance, v_adjustment_id, NULL::TEXT;
END;
$$;
