-- Add 'draft' status to social_deliveries
-- Allows holding deliveries for manual approval before sending

-- Extend status check constraint to include 'draft'
ALTER TABLE social_deliveries
DROP CONSTRAINT IF EXISTS social_deliveries_status_check;

ALTER TABLE social_deliveries
ADD CONSTRAINT social_deliveries_status_check
CHECK (status IN ('pending', 'success', 'failed', 'rate_limited', 'draft'));

-- Approve a draft delivery (transitions from draft to pending)
CREATE OR REPLACE FUNCTION approve_social_delivery(p_delivery_id UUID)
RETURNS JSON AS $$
DECLARE
  v_delivery RECORD;
BEGIN
  SELECT * INTO v_delivery
  FROM social_deliveries
  WHERE id = p_delivery_id AND status = 'draft';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Not found or not draft');
  END IF;

  UPDATE social_deliveries
  SET status = 'pending', attempts = 1
  WHERE id = p_delivery_id;

  RETURN json_build_object(
    'success', true,
    'delivery_id', p_delivery_id,
    'agent_id', v_delivery.agent_id,
    'credential_id', v_delivery.credential_id,
    'platform', v_delivery.platform,
    'content', v_delivery.content,
    'delivery_config', v_delivery.delivery_config
  );
END;
$$ LANGUAGE plpgsql;

-- Partial index for fast draft lookups
CREATE INDEX IF NOT EXISTS idx_social_deliveries_draft
ON social_deliveries(agent_id, created_at DESC)
WHERE status = 'draft';
