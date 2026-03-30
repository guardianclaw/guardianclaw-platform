-- Credits System Migration
-- claw Platform v3.0
-- Date: 2026-01-21
-- Description: Pay-per-use credits system ($0.003/execution)

-- ============================================
-- 1. USER CREDITS TABLE
-- ============================================
CREATE TABLE user_credits (
  wallet_address TEXT PRIMARY KEY REFERENCES profiles(wallet_address) ON DELETE CASCADE,
  balance_usd DECIMAL(10, 4) DEFAULT 0 CHECK (balance_usd >= 0),
  total_deposited DECIMAL(10, 4) DEFAULT 0,
  total_spent DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. DEPOSITS HISTORY TABLE
-- ============================================
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,
  token TEXT NOT NULL CHECK (token IN ('SOL', 'USDC', 'claw')),
  amount DECIMAL(18, 6) NOT NULL,
  price_usd DECIMAL(10, 4),
  credits_usd DECIMAL(10, 4) NOT NULL,
  bonus_applied DECIMAL(4, 2) DEFAULT 1.0,
  tx_signature TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. EXTEND AGENT_EVENTS FOR COST TRACKING
-- ============================================
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 4) DEFAULT 0;
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS balance_before DECIMAL(10, 4);
ALTER TABLE agent_events ADD COLUMN IF NOT EXISTS balance_after DECIMAL(10, 4);

-- ============================================
-- 4. INDEXES
-- ============================================
CREATE INDEX idx_deposits_wallet ON deposits(wallet_address);
CREATE INDEX idx_deposits_created ON deposits(created_at DESC);
CREATE INDEX idx_deposits_status ON deposits(status);
CREATE INDEX idx_user_credits_balance ON user_credits(balance_usd);

-- ============================================
-- 5. ROW LEVEL SECURITY
-- ============================================
ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_credits
CREATE POLICY "Users can view their own credits"
  ON user_credits FOR SELECT
  USING (wallet_address = current_setting('app.current_user', true));

CREATE POLICY "Service role can manage all credits"
  ON user_credits FOR ALL
  USING (current_setting('role') = 'service_role');

-- RLS Policies for deposits
CREATE POLICY "Users can view their own deposits"
  ON deposits FOR SELECT
  USING (wallet_address = current_setting('app.current_user', true));

CREATE POLICY "Service role can manage all deposits"
  ON deposits FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================
-- 6. TRIGGER FOR updated_at
-- ============================================
CREATE TRIGGER user_credits_updated_at
  BEFORE UPDATE ON user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 7. RPC: DEDUCT CREDITS ATOMICALLY
-- ============================================
CREATE OR REPLACE FUNCTION deduct_credits(
  p_wallet_address TEXT,
  p_amount DECIMAL(10, 4)
)
RETURNS TABLE(success BOOLEAN, new_balance DECIMAL(10, 4), error TEXT)
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
    RETURN QUERY SELECT false, 0::DECIMAL(10,4), 'NO_CREDITS_ACCOUNT'::TEXT;
    RETURN;
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RETURN QUERY SELECT false, v_current_balance, 'INSUFFICIENT_CREDITS'::TEXT;
    RETURN;
  END IF;

  -- Deduct credits
  v_new_balance := v_current_balance - p_amount;

  UPDATE user_credits
  SET balance_usd = v_new_balance,
      total_spent = total_spent + p_amount,
      updated_at = NOW()
  WHERE wallet_address = p_wallet_address;

  RETURN QUERY SELECT true, v_new_balance, NULL::TEXT;
END;
$$;

-- ============================================
-- 8. RPC: ADD CREDITS (AFTER CONFIRMED DEPOSIT)
-- ============================================
CREATE OR REPLACE FUNCTION add_credits(
  p_wallet_address TEXT,
  p_amount DECIMAL(10, 4)
)
RETURNS DECIMAL(10, 4)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL(10, 4);
BEGIN
  INSERT INTO user_credits (wallet_address, balance_usd, total_deposited)
  VALUES (p_wallet_address, p_amount, p_amount)
  ON CONFLICT (wallet_address) DO UPDATE
  SET balance_usd = user_credits.balance_usd + p_amount,
      total_deposited = user_credits.total_deposited + p_amount,
      updated_at = NOW()
  RETURNING balance_usd INTO v_new_balance;

  RETURN v_new_balance;
END;
$$;

-- ============================================
-- 9. RPC: GET CREDITS SUMMARY
-- ============================================
CREATE OR REPLACE FUNCTION get_credits_summary(p_wallet_address TEXT)
RETURNS TABLE(
  balance_usd DECIMAL(10, 4),
  total_deposited DECIMAL(10, 4),
  total_spent DECIMAL(10, 4),
  executions_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(c.balance_usd, 0),
    COALESCE(c.total_deposited, 0),
    COALESCE(c.total_spent, 0),
    FLOOR(COALESCE(c.balance_usd, 0) / 0.003)::INTEGER
  FROM user_credits c
  WHERE c.wallet_address = p_wallet_address;

  -- Return zeros if no record exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::DECIMAL(10,4), 0::DECIMAL(10,4), 0::DECIMAL(10,4), 0::INTEGER;
  END IF;
END;
$$;

-- ============================================
-- 10. RPC: GET USAGE HISTORY
-- ============================================
CREATE OR REPLACE FUNCTION get_credits_usage_history(
  p_wallet_address TEXT,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  agent_id UUID,
  cost_usd DECIMAL(10, 4),
  balance_after DECIMAL(10, 4),
  event_type TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ae.id,
    ae.agent_id,
    ae.cost_usd,
    ae.balance_after,
    ae.event_type,
    ae.created_at
  FROM agent_events ae
  INNER JOIN agents a ON ae.agent_id = a.id
  WHERE a.wallet_address = p_wallet_address
    AND ae.cost_usd > 0
  ORDER BY ae.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ============================================
-- 11. RPC: INIT USER CREDITS (IDEMPOTENT)
-- ============================================
CREATE OR REPLACE FUNCTION init_user_credits(p_wallet_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_credits (wallet_address, balance_usd, total_deposited, total_spent)
  VALUES (p_wallet_address, 0, 0, 0)
  ON CONFLICT (wallet_address) DO NOTHING;

  RETURN true;
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE user_credits IS 'User credit balances for pay-per-use model';
COMMENT ON TABLE deposits IS 'Deposit history from SOL/USDC/claw payments';
COMMENT ON FUNCTION deduct_credits IS 'Atomically deducts credits with race condition protection';
COMMENT ON FUNCTION add_credits IS 'Adds credits after confirmed deposit (upserts)';
COMMENT ON FUNCTION get_credits_summary IS 'Returns credit balance and remaining executions';
