#!/usr/bin/env npx tsx

/**
 * Seed Super Admin Script
 *
 * Usage:
 *   npx tsx scripts/seed-admin.ts <wallet_address>
 *
 * Example:
 *   npx tsx scripts/seed-admin.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU
 *
 * Requirements:
 *   - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables
 *   - The wallet must exist in profiles (user must have logged in once)
 */

import { createClient } from '@supabase/supabase-js'

async function main() {
  const walletAddress = process.argv[2]

  if (!walletAddress) {
    console.error('Usage: npx tsx scripts/seed-admin.ts <wallet_address>')
    console.error('')
    console.error('Example:')
    console.error('  npx tsx scripts/seed-admin.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU')
    process.exit(1)
  }

  // Validate wallet address format (Solana base58)
  if (!/^[A-Za-z0-9]{32,44}$/.test(walletAddress)) {
    console.error('Error: Invalid wallet address format')
    console.error('Solana wallet addresses are 32-44 base58 characters')
    process.exit(1)
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing environment variables')
    console.error('Required: SUPABASE_URL, SUPABASE_SERVICE_KEY')
    console.error('')
    console.error('Set them with:')
    console.error('  export SUPABASE_URL=https://your-project.supabase.co')
    console.error('  export SUPABASE_SERVICE_KEY=your-service-key')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('Checking if wallet exists in profiles...')

  // Check if wallet exists in profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('wallet_address, display_name')
    .eq('wallet_address', walletAddress)
    .single()

  if (profileError || !profile) {
    console.error('Error: Wallet not found in profiles')
    console.error('')
    console.error('The user must log in at least once before being granted admin access.')
    console.error('Ask them to:')
    console.error('  1. Connect their wallet at https://guardianclaw.org')
    console.error('  2. Complete the sign-in process')
    console.error('')
    console.error('Then run this script again.')
    process.exit(1)
  }

  console.log(`Found user: ${profile.display_name || walletAddress.slice(0, 8) + '...'}`)

  // Check if already an admin
  const { data: existingRole } = await supabase
    .from('admin_roles')
    .select('role, is_active')
    .eq('wallet_address', walletAddress)
    .single()

  if (existingRole) {
    if (existingRole.role === 'super_admin' && existingRole.is_active) {
      console.log('User is already a super_admin')
      process.exit(0)
    }

    // Update existing role
    console.log(`Upgrading existing ${existingRole.role} to super_admin...`)

    const { error: updateError } = await supabase
      .from('admin_roles')
      .update({
        role: 'super_admin',
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress)

    if (updateError) {
      console.error('Error updating role:', updateError.message)
      process.exit(1)
    }

    console.log('Successfully upgraded to super_admin!')
  } else {
    // Create new role
    console.log('Granting super_admin role...')

    const { error: insertError } = await supabase
      .from('admin_roles')
      .insert({
        wallet_address: walletAddress,
        role: 'super_admin',
        granted_by: walletAddress, // Self-granted for initial admin
        permissions: {},
        is_active: true,
      })

    if (insertError) {
      console.error('Error granting role:', insertError.message)
      process.exit(1)
    }

    console.log('Successfully granted super_admin role!')
  }

  console.log('')
  console.log('The user can now access the admin dashboard at:')
  console.log('  https://guardianclaw.org/admin')
  console.log('')
  console.log('Permissions:')
  console.log('  - Full access to all dashboards')
  console.log('  - Can manage alert rules')
  console.log('  - Can grant admin roles to other users')
  console.log('  - Can perform all support actions')
}

main().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
