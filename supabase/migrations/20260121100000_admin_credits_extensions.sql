-- Admin Credits Extensions Migration
-- claw Platform v3.0
-- Date: 2026-01-21
-- Description: Admin-level credit management and user extensions

-- ============================================
-- 1. CREDIT ADJUSTMENTS TABLE
-- Manual credit adjustments by admins (refunds, courtesy, corrections)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,

  -- Adjustment details
  amount DECIMAL(10, 4) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('refund', 'courtesy', 'correction', 'bonus', 'penalty')),
  reason TEXT NOT NULL,

  -- Admin tracking (hashed for privacy)
  admin_wallet_hash TEXT NOT NULL,

  -- Optional reference (ticket ID, deposit ID, etc.)
  reference_id TEXT,
  reference_type TEXT CHECK (reference_type IN ('ticket', 'deposit', 'agent_event', 'other')),

  -- Balance snapshot
  balance_before DECIMAL(10, 4),
  balance_after DECIMAL(10, 4),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_adjustments_wallet ON credit_adjustments(wallet_address);
CREATE INDEX idx_credit_adjustments_admin ON credit_adjustments(admin_wallet_hash);
CREATE INDEX idx_credit_adjustments_type ON credit_adjustments(type);
CREATE INDEX idx_credit_adjustments_created ON credit_adjustments(created_at DESC);

-- Comments
COMMENT ON TABLE credit_adjustments IS 'Manual credit adjustments by admin for refunds, courtesy credits, corrections';
COMMENT ON COLUMN credit_adjustments.admin_wallet_hash IS 'SHA-256 hash of admin wallet for privacy-preserving audit';
COMMENT ON COLUMN credit_adjustments.reference_id IS 'Optional reference to related record (ticket, deposit, etc.)';

-- ============================================
-- 2. USER NOTES TABLE
-- Internal notes by support staff for context
-- ============================================
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL REFERENCES profiles(wallet_address) ON DELETE CASCADE,

  -- Note content
  note TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'support', 'billing', 'security', 'compliance')),

  -- Admin tracking
  admin_wallet_hash TEXT NOT NULL,

  -- Metadata
  is_pinned BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_notes_wallet ON user_notes(wallet_address);
CREATE INDEX idx_user_notes_admin ON user_notes(admin_wallet_hash);
CREATE INDEX idx_user_notes_category ON user_notes(category);
CREATE INDEX idx_user_notes_pinned ON user_notes(wallet_address, is_pinned) WHERE is_pinned = TRUE;

-- Comments
COMMENT ON TABLE user_notes IS 'Internal admin notes about users for support context';
COMMENT ON COLUMN user_notes.is_pinned IS 'Pinned notes appear at the top of the list';

-- ============================================
-- 3. EXTEND PROFILES WITH SUSPENSION DETAILS
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspended_by TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

COMMENT ON COLUMN profiles.suspended_at IS 'When the account was suspended';
COMMENT ON COLUMN profiles.suspended_by IS 'Admin wallet hash who suspended the account';
COMMENT ON COLUMN profiles.suspension_reason IS 'Reason for suspension';

-- ============================================
-- 4. RLS POLICIES
-- ============================================
ALTER TABLE credit_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

-- Service role has full access (used by admin API)
CREATE POLICY "Service role can manage credit_adjustments"
  ON credit_adjustments FOR ALL
  USING (current_setting('role') = 'service_role');

CREATE POLICY "Service role can manage user_notes"
  ON user_notes FOR ALL
  USING (current_setting('role') = 'service_role');

-- ============================================
-- 5. RPC: ADMIN ADJUST CREDITS
-- Atomic credit adjustment with full audit trail
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

  -- Update credits
  UPDATE user_credits
  SET balance_usd = v_new_balance,
      total_deposited = CASE WHEN p_amount > 0 THEN total_deposited + p_amount ELSE total_deposited END,
      total_spent = CASE WHEN p_amount < 0 THEN total_spent + ABS(p_amount) ELSE total_spent END,
      updated_at = NOW()
  WHERE wallet_address = p_wallet_address;

  -- Record adjustment
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

COMMENT ON FUNCTION admin_adjust_credits IS 'Atomic credit adjustment with full audit trail. Used by admin panel.';

-- ============================================
-- 6. RPC: GET PLATFORM CREDITS STATS
-- Aggregated credit statistics for admin dashboard
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_credits_stats()
RETURNS TABLE(
  total_balance DECIMAL(12, 4),
  total_deposited DECIMAL(12, 4),
  total_spent DECIMAL(12, 4),
  total_adjustments DECIMAL(12, 4),
  active_accounts INTEGER,
  zero_balance_accounts INTEGER,
  low_balance_accounts INTEGER,
  avg_balance DECIMAL(10, 4),
  deposits_24h INTEGER,
  deposits_7d INTEGER,
  deposits_30d INTEGER,
  revenue_24h DECIMAL(12, 4),
  revenue_7d DECIMAL(12, 4),
  revenue_30d DECIMAL(12, 4)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Current balances
    COALESCE(SUM(uc.balance_usd), 0)::DECIMAL(12, 4) as total_balance,
    COALESCE(SUM(uc.total_deposited), 0)::DECIMAL(12, 4) as total_deposited,
    COALESCE(SUM(uc.total_spent), 0)::DECIMAL(12, 4) as total_spent,

    -- Adjustments total
    COALESCE((SELECT SUM(amount) FROM credit_adjustments), 0)::DECIMAL(12, 4) as total_adjustments,

    -- Account counts
    COUNT(*)::INTEGER as active_accounts,
    COUNT(*) FILTER (WHERE uc.balance_usd = 0)::INTEGER as zero_balance_accounts,
    COUNT(*) FILTER (WHERE uc.balance_usd > 0 AND uc.balance_usd < 0.30)::INTEGER as low_balance_accounts,

    -- Average balance
    COALESCE(AVG(uc.balance_usd), 0)::DECIMAL(10, 4) as avg_balance,

    -- Deposit counts by period
    COALESCE((SELECT COUNT(*) FROM deposits WHERE created_at > NOW() - INTERVAL '24 hours'), 0)::INTEGER as deposits_24h,
    COALESCE((SELECT COUNT(*) FROM deposits WHERE created_at > NOW() - INTERVAL '7 days'), 0)::INTEGER as deposits_7d,
    COALESCE((SELECT COUNT(*) FROM deposits WHERE created_at > NOW() - INTERVAL '30 days'), 0)::INTEGER as deposits_30d,

    -- Revenue by period
    COALESCE((SELECT SUM(credits_usd) FROM deposits WHERE created_at > NOW() - INTERVAL '24 hours'), 0)::DECIMAL(12, 4) as revenue_24h,
    COALESCE((SELECT SUM(credits_usd) FROM deposits WHERE created_at > NOW() - INTERVAL '7 days'), 0)::DECIMAL(12, 4) as revenue_7d,
    COALESCE((SELECT SUM(credits_usd) FROM deposits WHERE created_at > NOW() - INTERVAL '30 days'), 0)::DECIMAL(12, 4) as revenue_30d

  FROM user_credits uc;
END;
$$;

COMMENT ON FUNCTION admin_get_credits_stats IS 'Platform-wide credit statistics for admin dashboard';

-- ============================================
-- 7. RPC: GET USER CREDITS DETAILS (ADMIN)
-- Detailed credit info for a specific user
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_user_credits(
  p_wallet_address TEXT
)
RETURNS TABLE(
  balance_usd DECIMAL(10, 4),
  total_deposited DECIMAL(10, 4),
  total_spent DECIMAL(10, 4),
  executions_remaining INTEGER,
  deposits_count BIGINT,
  adjustments_count BIGINT,
  first_deposit_at TIMESTAMPTZ,
  last_deposit_at TIMESTAMPTZ,
  last_usage_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(uc.balance_usd, 0),
    COALESCE(uc.total_deposited, 0),
    COALESCE(uc.total_spent, 0),
    FLOOR(COALESCE(uc.balance_usd, 0) / 0.003)::INTEGER,
    COALESCE((SELECT COUNT(*) FROM deposits d WHERE d.wallet_address = p_wallet_address), 0),
    COALESCE((SELECT COUNT(*) FROM credit_adjustments ca WHERE ca.wallet_address = p_wallet_address), 0),
    (SELECT MIN(d.created_at) FROM deposits d WHERE d.wallet_address = p_wallet_address),
    (SELECT MAX(d.created_at) FROM deposits d WHERE d.wallet_address = p_wallet_address),
    (SELECT MAX(ae.created_at) FROM agent_events ae
     INNER JOIN agents a ON ae.agent_id = a.id
     WHERE a.wallet_address = p_wallet_address AND ae.cost_usd > 0),
    uc.created_at
  FROM user_credits uc
  WHERE uc.wallet_address = p_wallet_address;

  -- Return zeros if no record
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      0::DECIMAL(10,4), 0::DECIMAL(10,4), 0::DECIMAL(10,4), 0::INTEGER,
      0::BIGINT, 0::BIGINT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
  END IF;
END;
$$;

COMMENT ON FUNCTION admin_get_user_credits IS 'Detailed credit information for admin user view';

-- ============================================
-- 8. RPC: GET LOW BALANCE USERS
-- Users at risk of running out of credits
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_low_balance_users(
  p_threshold DECIMAL(10, 4) DEFAULT 0.30,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  wallet_address TEXT,
  display_name TEXT,
  balance_usd DECIMAL(10, 4),
  executions_remaining INTEGER,
  last_deposit_at TIMESTAMPTZ,
  total_spent DECIMAL(10, 4)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    uc.wallet_address,
    p.display_name,
    uc.balance_usd,
    FLOOR(uc.balance_usd / 0.003)::INTEGER as executions_remaining,
    (SELECT MAX(d.created_at) FROM deposits d WHERE d.wallet_address = uc.wallet_address),
    uc.total_spent
  FROM user_credits uc
  INNER JOIN profiles p ON uc.wallet_address = p.wallet_address
  WHERE uc.balance_usd > 0 AND uc.balance_usd < p_threshold
    AND p.status = 'active'
  ORDER BY uc.balance_usd ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_get_low_balance_users IS 'Get users with low credit balance for proactive support';

-- ============================================
-- 9. RPC: SUSPEND/UNSUSPEND USER
-- Manage user account status
-- ============================================
CREATE OR REPLACE FUNCTION admin_set_user_status(
  p_wallet_address TEXT,
  p_status TEXT,
  p_admin_hash TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  previous_status TEXT,
  new_status TEXT,
  error TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_status TEXT;
BEGIN
  -- Validate status
  IF p_status NOT IN ('active', 'suspended') THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, 'INVALID_STATUS'::TEXT;
    RETURN;
  END IF;

  -- Get current status
  SELECT status INTO v_previous_status
  FROM profiles
  WHERE wallet_address = p_wallet_address
  FOR UPDATE;

  IF v_previous_status IS NULL THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, 'USER_NOT_FOUND'::TEXT;
    RETURN;
  END IF;

  -- Update status
  IF p_status = 'suspended' THEN
    UPDATE profiles
    SET status = 'suspended',
        suspended_at = NOW(),
        suspended_by = p_admin_hash,
        suspension_reason = p_reason,
        updated_at = NOW()
    WHERE wallet_address = p_wallet_address;
  ELSE
    UPDATE profiles
    SET status = 'active',
        suspended_at = NULL,
        suspended_by = NULL,
        suspension_reason = NULL,
        updated_at = NOW()
    WHERE wallet_address = p_wallet_address;
  END IF;

  RETURN QUERY SELECT true, v_previous_status, p_status, NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION admin_set_user_status IS 'Suspend or unsuspend a user account';

-- ============================================
-- 10. RPC: GET DEPOSITS (ADMIN - ALL USERS)
-- Paginated deposits across all users
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_all_deposits(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT DEFAULT NULL,
  p_token TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  wallet_address TEXT,
  display_name TEXT,
  token TEXT,
  amount DECIMAL(18, 6),
  price_usd DECIMAL(10, 4),
  credits_usd DECIMAL(10, 4),
  bonus_applied DECIMAL(4, 2),
  tx_signature TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.wallet_address,
    p.display_name,
    d.token,
    d.amount,
    d.price_usd,
    d.credits_usd,
    d.bonus_applied,
    d.tx_signature,
    d.status,
    d.created_at
  FROM deposits d
  LEFT JOIN profiles p ON d.wallet_address = p.wallet_address
  WHERE
    (p_status IS NULL OR d.status = p_status)
    AND (p_token IS NULL OR d.token = p_token)
    AND (p_start_date IS NULL OR d.created_at >= p_start_date)
    AND (p_end_date IS NULL OR d.created_at <= p_end_date)
  ORDER BY d.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_get_all_deposits IS 'Get paginated deposits for admin with optional filters';

-- ============================================
-- 11. RPC: GET ADJUSTMENTS (ADMIN)
-- Paginated credit adjustments
-- ============================================
CREATE OR REPLACE FUNCTION admin_get_all_adjustments(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_type TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  wallet_address TEXT,
  display_name TEXT,
  amount DECIMAL(10, 4),
  type TEXT,
  reason TEXT,
  admin_wallet_hash TEXT,
  reference_id TEXT,
  reference_type TEXT,
  balance_before DECIMAL(10, 4),
  balance_after DECIMAL(10, 4),
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ca.id,
    ca.wallet_address,
    p.display_name,
    ca.amount,
    ca.type,
    ca.reason,
    ca.admin_wallet_hash,
    ca.reference_id,
    ca.reference_type,
    ca.balance_before,
    ca.balance_after,
    ca.created_at
  FROM credit_adjustments ca
  LEFT JOIN profiles p ON ca.wallet_address = p.wallet_address
  WHERE
    (p_type IS NULL OR ca.type = p_type)
    AND (p_start_date IS NULL OR ca.created_at >= p_start_date)
    AND (p_end_date IS NULL OR ca.created_at <= p_end_date)
  ORDER BY ca.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION admin_get_all_adjustments IS 'Get paginated credit adjustments for admin';

-- ============================================
-- 12. TRIGGER: UPDATE user_notes.updated_at
-- ============================================
CREATE TRIGGER user_notes_updated_at
  BEFORE UPDATE ON user_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- GRANTS
-- ============================================
-- Functions are SECURITY DEFINER, so they run with owner privileges
-- No additional grants needed for authenticated users
