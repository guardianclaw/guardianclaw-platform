-- Seed Super Admin
-- Wallet: DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG

-- Create the profile first (FK requirement for admin_roles)
INSERT INTO profiles (wallet_address, display_name, plan)
VALUES (
  'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
  'Admin',
  'pro'
)
ON CONFLICT (wallet_address) DO NOTHING;

-- Then insert or update admin role
INSERT INTO admin_roles (wallet_address, role, granted_by, permissions, is_active)
VALUES (
  'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
  'super_admin',
  'DgyapGSZv9FqcK9eqcdJ3XqXSAPnhBhF9Ayu47aPS3GG',
  '{}',
  true
)
ON CONFLICT (wallet_address) DO UPDATE SET
  role = 'super_admin',
  is_active = true,
  updated_at = NOW();
