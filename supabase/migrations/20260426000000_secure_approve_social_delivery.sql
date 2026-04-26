-- Move ownership check into approve_social_delivery RPC
-- Closes F-05 / P1.1 from auditoria 2026-04-23.
--
-- Previous version (mig 20260130000000) only checked status='draft'. The handler
-- did the wallet_address ownership check after the state transition and reverted
-- on failure, leaving a TOCTOU race: a concurrent caller could observe the
-- 'pending' record before the revert. This migration enforces ownership inside
-- the same UPDATE statement, removing the race entirely.

DROP FUNCTION IF EXISTS approve_social_delivery(UUID);

CREATE OR REPLACE FUNCTION approve_social_delivery(
  p_delivery_id UUID,
  p_wallet_address TEXT
)
RETURNS JSON AS $$
DECLARE
  v_delivery RECORD;
BEGIN
  -- Single-statement atomic transition: state change AND ownership check in
  -- one UPDATE. If the wallet does not own the agent, or the row is not in
  -- draft, zero rows match and FOUND becomes false.
  UPDATE social_deliveries sd
  SET status = 'pending', attempts = 1
  FROM agents a
  WHERE sd.id = p_delivery_id
    AND sd.status = 'draft'
    AND sd.agent_id = a.id
    AND a.wallet_address = p_wallet_address
  RETURNING
    sd.id,
    sd.agent_id,
    sd.credential_id,
    sd.platform,
    sd.content,
    sd.delivery_config,
    a.name AS agent_name
  INTO v_delivery;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Delivery not found, not in draft, or not owned by caller'
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'delivery_id', v_delivery.id,
    'agent_id', v_delivery.agent_id,
    'agent_name', v_delivery.agent_name,
    'credential_id', v_delivery.credential_id,
    'platform', v_delivery.platform,
    'content', v_delivery.content,
    'delivery_config', v_delivery.delivery_config
  );
END;
$$ LANGUAGE plpgsql;
