-- Add status column to profiles
-- Required for admin system materialized views

-- Add status column if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'));

-- Create index for status queries
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);

-- Update existing profiles to active
UPDATE profiles SET status = 'active' WHERE status IS NULL;

-- Comment
COMMENT ON COLUMN profiles.status IS 'Account status: active, suspended, or deleted';
