/**
 * Generate ES256 Key Pair for JWT Signing
 *
 * Run with: npx tsx scripts/generate-es256-keys.ts
 *
 * This generates a P-256 (secp256r1) ECDSA key pair in JWK format.
 * Store the private key as a Cloudflare secret: JWT_ES256_PRIVATE_KEY
 * The public key can be stored as a variable or embedded in code.
 */

import * as jose from 'jose'

async function main() {
  console.log('Generating ES256 key pair for JWT signing...\n')

  const { privateKey, publicKey } = await jose.generateKeyPair('ES256', {
    extractable: true,
  })

  const privateJwk = await jose.exportJWK(privateKey)
  const publicJwk = await jose.exportJWK(publicKey)

  // Add key ID for rotation support
  const kid = crypto.randomUUID()
  privateJwk.kid = kid
  publicJwk.kid = kid

  console.log('='.repeat(60))
  console.log('PRIVATE KEY (store as secret: JWT_ES256_PRIVATE_KEY)')
  console.log('='.repeat(60))
  console.log(JSON.stringify(privateJwk))
  console.log()

  console.log('='.repeat(60))
  console.log('PUBLIC KEY (can be stored as variable: JWT_ES256_PUBLIC_KEY)')
  console.log('='.repeat(60))
  console.log(JSON.stringify(publicJwk))
  console.log()

  console.log('='.repeat(60))
  console.log('SETUP INSTRUCTIONS')
  console.log('='.repeat(60))
  console.log(`
1. Store the private key as a Cloudflare secret:
   wrangler secret put JWT_ES256_PRIVATE_KEY --env staging
   wrangler secret put JWT_ES256_PRIVATE_KEY --env production
   (paste the private key JSON when prompted)

2. Optionally store the public key:
   wrangler secret put JWT_ES256_PUBLIC_KEY --env staging
   wrangler secret put JWT_ES256_PUBLIC_KEY --env production

3. Keep JWT_SECRET for backwards compatibility with existing tokens.

4. The system will:
   - Sign new tokens with ES256
   - Verify both ES256 and HS256 tokens
   - Old tokens remain valid until they expire
`)
}

main().catch(console.error)
