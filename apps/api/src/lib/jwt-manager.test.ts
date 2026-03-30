/**
 * JWT Manager Tests
 *
 * Comprehensive tests for JWT management with ES256 and HS256 support.
 * Tests token creation, verification, and all edge cases.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as jose from 'jose'
import {
  JWTManager,
  JWT_CONFIG,
  createJWTManager,
  getJWTManager,
  resetJWTManager,
  generateES256KeyPair,
} from './jwt-manager'

// Generate test ES256 key pair
let testES256PrivateKey: string
let testES256PublicKey: string

async function setupTestKeys() {
  const { privateKey, publicKey } = await jose.generateKeyPair('ES256', {
    extractable: true,
  })

  const privateJwk = await jose.exportJWK(privateKey)
  const publicJwk = await jose.exportJWK(publicKey)

  testES256PrivateKey = JSON.stringify(privateJwk)
  testES256PublicKey = JSON.stringify(publicJwk)
}

// HS256 test secret
const testHS256Secret = 'test-jwt-secret-with-minimum-32-chars!'

describe('JWT_CONFIG', () => {
  it('has correct algorithm', () => {
    expect(JWT_CONFIG.ALGORITHM).toBe('ES256')
  })

  it('has correct issuer', () => {
    expect(JWT_CONFIG.ISSUER).toBe('guardianclaw.org')
  })

  it('has correct audience', () => {
    expect(JWT_CONFIG.AUDIENCE).toBe('claw-api')
  })

  it('has correct default expiry', () => {
    expect(JWT_CONFIG.DEFAULT_EXPIRY).toBe('1h')
  })
})

describe('JWTManager', () => {
  beforeEach(async () => {
    resetJWTManager()
    await setupTestKeys()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialize', () => {
    it('initializes with ES256 keys', async () => {
      const manager = new JWTManager()
      await manager.initialize(testES256PrivateKey, testES256PublicKey)

      expect(manager.hasES256()).toBe(true)
      expect(manager.hasHS256()).toBe(false)
    })

    it('initializes with HS256 secret', async () => {
      const manager = new JWTManager()
      await manager.initialize(undefined, undefined, testHS256Secret)

      expect(manager.hasES256()).toBe(false)
      expect(manager.hasHS256()).toBe(true)
    })

    it('initializes with both ES256 and HS256', async () => {
      const manager = new JWTManager()
      await manager.initialize(testES256PrivateKey, testES256PublicKey, testHS256Secret)

      expect(manager.hasES256()).toBe(true)
      expect(manager.hasHS256()).toBe(true)
    })

    it('derives public key from private if not provided', async () => {
      const manager = new JWTManager()
      await manager.initialize(testES256PrivateKey, undefined, undefined)

      expect(manager.hasES256()).toBe(true)
    })

    it('throws error when no keys provided', async () => {
      const manager = new JWTManager()

      await expect(manager.initialize()).rejects.toThrow('No valid signing keys provided')
    })

    it('skips if already initialized', async () => {
      const manager = new JWTManager()
      await manager.initialize(undefined, undefined, testHS256Secret)

      // Second initialize should do nothing
      await manager.initialize(testES256PrivateKey, testES256PublicKey)

      // Should still only have HS256 from first init
      expect(manager.hasES256()).toBe(false)
      expect(manager.hasHS256()).toBe(true)
    })

    it('falls back to HS256 on ES256 key import error', async () => {
      const manager = new JWTManager()
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await manager.initialize('invalid-json', undefined, testHS256Secret)

      expect(manager.hasES256()).toBe(false)
      expect(manager.hasHS256()).toBe(true)
      expect(consoleSpy).toHaveBeenCalled()
    })
  })

  describe('createToken with ES256', () => {
    let manager: JWTManager

    beforeEach(async () => {
      manager = new JWTManager()
      await manager.initialize(testES256PrivateKey, testES256PublicKey)
    })

    it('creates valid ES256 token', async () => {
      const result = await manager.createToken({
        sub: 'test-wallet',
        plan: 'pro',
      })

      expect(result.token).toBeDefined()
      expect(result.jti).toBeDefined()
      expect(result.expiresAt).toBeGreaterThan(Date.now())

      // Verify token header
      const header = jose.decodeProtectedHeader(result.token)
      expect(header.alg).toBe('ES256')
      expect(header.typ).toBe('JWT')
    })

    it('includes all claims in token', async () => {
      const result = await manager.createToken({
        sub: 'test-wallet',
        plan: 'enterprise',
        sessionId: 'session-123',
        ipHash: 'hashed-ip',
      })

      const decoded = jose.decodeJwt(result.token)

      expect(decoded.sub).toBe('test-wallet')
      expect(decoded.plan).toBe('enterprise')
      expect(decoded.sessionId).toBe('session-123')
      expect(decoded.ipHash).toBe('hashed-ip')
      expect(decoded.jti).toBe(result.jti)
      expect(decoded.iss).toBe(JWT_CONFIG.ISSUER)
      expect(decoded.aud).toBe(JWT_CONFIG.AUDIENCE)
    })

    it('respects custom expiry in hours', async () => {
      const result = await manager.createToken({ sub: 'wallet', plan: 'free' }, '2h')

      const decoded = jose.decodeJwt(result.token)
      const expectedExpiry = Math.floor(Date.now() / 1000) + 2 * 3600

      expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5)
      expect(decoded.exp).toBeLessThan(expectedExpiry + 5)
    })

    it('respects custom expiry in minutes', async () => {
      const result = await manager.createToken({ sub: 'wallet', plan: 'free' }, '30m')

      const decoded = jose.decodeJwt(result.token)
      const expectedExpiry = Math.floor(Date.now() / 1000) + 30 * 60

      expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5)
      expect(decoded.exp).toBeLessThan(expectedExpiry + 5)
    })

    it('respects custom expiry in days', async () => {
      const result = await manager.createToken({ sub: 'wallet', plan: 'free' }, '1d')

      const decoded = jose.decodeJwt(result.token)
      const expectedExpiry = Math.floor(Date.now() / 1000) + 86400

      expect(decoded.exp).toBeGreaterThan(expectedExpiry - 5)
      expect(decoded.exp).toBeLessThan(expectedExpiry + 5)
    })

    it('throws when not initialized', async () => {
      const uninitManager = new JWTManager()

      await expect(uninitManager.createToken({ sub: 'wallet', plan: 'free' })).rejects.toThrow(
        'Not initialized'
      )
    })
  })

  describe('createToken with HS256', () => {
    let manager: JWTManager

    beforeEach(async () => {
      manager = new JWTManager()
      await manager.initialize(undefined, undefined, testHS256Secret)
    })

    it('creates valid HS256 token', async () => {
      const result = await manager.createToken({
        sub: 'test-wallet',
        plan: 'free',
      })

      expect(result.token).toBeDefined()
      expect(result.jti).toBeDefined()

      const header = jose.decodeProtectedHeader(result.token)
      expect(header.alg).toBe('HS256')
    })

    it('includes all standard claims', async () => {
      const result = await manager.createToken({
        sub: 'test-wallet',
        plan: 'starter',
      })

      const decoded = jose.decodeJwt(result.token)

      expect(decoded.iss).toBe(JWT_CONFIG.ISSUER)
      expect(decoded.aud).toBe(JWT_CONFIG.AUDIENCE)
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp).toBeDefined()
    })
  })

  describe('verifyToken with ES256', () => {
    let manager: JWTManager

    beforeEach(async () => {
      manager = new JWTManager()
      await manager.initialize(testES256PrivateKey, testES256PublicKey)
    })

    it('verifies valid ES256 token', async () => {
      const { token } = await manager.createToken({
        sub: 'test-wallet',
        plan: 'pro',
      })

      const result = await manager.verifyToken(token)

      expect(result.valid).toBe(true)
      expect(result.payload?.sub).toBe('test-wallet')
      expect(result.payload?.plan).toBe('pro')
      expect(result.algorithm).toBe('ES256')
    })

    it('returns error for expired token', async () => {
      // Create a token that expires immediately
      const _secret = new TextEncoder().encode(testHS256Secret)
      const expiredToken = await new jose.SignJWT({ sub: 'wallet', plan: 'free' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .setIssuer(JWT_CONFIG.ISSUER)
        .setAudience(JWT_CONFIG.AUDIENCE)
        .sign(await jose.importJWK(JSON.parse(testES256PrivateKey), 'ES256'))

      const result = await manager.verifyToken(expiredToken)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token expired')
    })

    it('returns error for wrong issuer', async () => {
      const privateKey = await jose.importJWK(JSON.parse(testES256PrivateKey), 'ES256')
      const wrongIssuerToken = await new jose.SignJWT({ sub: 'wallet', plan: 'free' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .setIssuer('wrong-issuer')
        .setAudience(JWT_CONFIG.AUDIENCE)
        .sign(privateKey)

      const result = await manager.verifyToken(wrongIssuerToken)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token claim validation failed')
    })

    it('returns error for wrong audience', async () => {
      const privateKey = await jose.importJWK(JSON.parse(testES256PrivateKey), 'ES256')
      const wrongAudienceToken = await new jose.SignJWT({ sub: 'wallet', plan: 'free' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .setIssuer(JWT_CONFIG.ISSUER)
        .setAudience('wrong-audience')
        .sign(privateKey)

      const result = await manager.verifyToken(wrongAudienceToken)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token claim validation failed')
    })

    it('returns error for invalid signature', async () => {
      const { token } = await manager.createToken({
        sub: 'wallet',
        plan: 'free',
      })

      // Tamper with signature
      const parts = token.split('.')
      parts[2] = 'tampered-signature'
      const tamperedToken = parts.join('.')

      const result = await manager.verifyToken(tamperedToken)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Token verification failed')
    })

    it('returns error for malformed token', async () => {
      const result = await manager.verifyToken('not-a-valid-jwt')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid token format')
    })

    it('returns error when not initialized', async () => {
      const uninitManager = new JWTManager()

      const result = await uninitManager.verifyToken('some-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('JWT Manager not initialized')
    })
  })

  describe('verifyToken with HS256', () => {
    let manager: JWTManager

    beforeEach(async () => {
      manager = new JWTManager()
      await manager.initialize(undefined, undefined, testHS256Secret)
    })

    it('verifies valid HS256 token', async () => {
      const { token } = await manager.createToken({
        sub: 'test-wallet',
        plan: 'starter',
      })

      const result = await manager.verifyToken(token)

      expect(result.valid).toBe(true)
      expect(result.payload?.sub).toBe('test-wallet')
      expect(result.algorithm).toBe('HS256')
    })

    it('verifies legacy HS256 token without audience', async () => {
      // Simulate legacy token without audience claim
      const secret = new TextEncoder().encode(testHS256Secret)
      const legacyToken = await new jose.SignJWT({ sub: 'wallet', plan: 'free' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .setIssuer(JWT_CONFIG.ISSUER)
        // No audience set - simulating legacy token
        .sign(secret)

      const result = await manager.verifyToken(legacyToken)

      expect(result.valid).toBe(true)
      expect(result.algorithm).toBe('HS256')
    })
  })

  describe('verifyToken with mixed algorithms', () => {
    let manager: JWTManager

    beforeEach(async () => {
      manager = new JWTManager()
      await manager.initialize(testES256PrivateKey, testES256PublicKey, testHS256Secret)
    })

    it('verifies ES256 token when both available', async () => {
      const privateKey = await jose.importJWK(JSON.parse(testES256PrivateKey), 'ES256')
      const token = await new jose.SignJWT({ sub: 'wallet', plan: 'free' })
        .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .setIssuer(JWT_CONFIG.ISSUER)
        .setAudience(JWT_CONFIG.AUDIENCE)
        .sign(privateKey)

      const result = await manager.verifyToken(token)

      expect(result.valid).toBe(true)
      expect(result.algorithm).toBe('ES256')
    })

    it('verifies HS256 token when both available', async () => {
      const secret = new TextEncoder().encode(testHS256Secret)
      const token = await new jose.SignJWT({ sub: 'wallet', plan: 'free' })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .setIssuer(JWT_CONFIG.ISSUER)
        .sign(secret)

      const result = await manager.verifyToken(token)

      expect(result.valid).toBe(true)
      expect(result.algorithm).toBe('HS256')
    })

    it('returns error for unsupported algorithm', async () => {
      // Create a fake token with unsupported algorithm
      const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
      const payload = btoa(JSON.stringify({ sub: 'wallet' }))
      const fakeToken = `${header}.${payload}.fake-signature`

      const result = await manager.verifyToken(fakeToken)

      expect(result.valid).toBe(false)
      expect(result.error).toContain('Unsupported algorithm')
    })
  })

  describe('decodeToken', () => {
    let manager: JWTManager

    beforeEach(async () => {
      manager = new JWTManager()
      await manager.initialize(testES256PrivateKey, testES256PublicKey)
    })

    it('decodes valid token without verification', async () => {
      const { token } = await manager.createToken({
        sub: 'test-wallet',
        plan: 'pro',
        sessionId: 'session-456',
      })

      const decoded = manager.decodeToken(token)

      expect(decoded).not.toBeNull()
      expect(decoded?.sub).toBe('test-wallet')
      expect(decoded?.plan).toBe('pro')
      expect(decoded?.sessionId).toBe('session-456')
    })

    it('decodes expired token (no verification)', async () => {
      const privateKey = await jose.importJWK(JSON.parse(testES256PrivateKey), 'ES256')
      const expiredToken = await new jose.SignJWT({ sub: 'wallet', plan: 'free' })
        .setProtectedHeader({ alg: 'ES256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(privateKey)

      const decoded = manager.decodeToken(expiredToken)

      expect(decoded).not.toBeNull()
      expect(decoded?.sub).toBe('wallet')
    })

    it('returns null for malformed token', () => {
      const decoded = manager.decodeToken('not-a-jwt')

      expect(decoded).toBeNull()
    })

    it('returns null for invalid base64', () => {
      const decoded = manager.decodeToken('invalid.base64.here!!!')

      expect(decoded).toBeNull()
    })
  })
})

describe('generateES256KeyPair', () => {
  it('generates valid key pair', async () => {
    const { privateKey, publicKey } = await generateES256KeyPair()

    expect(privateKey).toBeDefined()
    expect(publicKey).toBeDefined()

    // Private key should have 'd' component
    expect(privateKey.d).toBeDefined()
    expect(privateKey.kty).toBe('EC')
    expect(privateKey.crv).toBe('P-256')

    // Public key should NOT have 'd' component
    expect(publicKey.d).toBeUndefined()
    expect(publicKey.kty).toBe('EC')
    expect(publicKey.crv).toBe('P-256')
  })

  it('generates keys with matching kid', async () => {
    const { privateKey, publicKey } = await generateES256KeyPair()

    expect(privateKey.kid).toBeDefined()
    expect(publicKey.kid).toBeDefined()
    expect(privateKey.kid).toBe(publicKey.kid)
  })

  it('generates usable keys', async () => {
    const { privateKey, publicKey } = await generateES256KeyPair()

    const manager = new JWTManager()
    await manager.initialize(JSON.stringify(privateKey), JSON.stringify(publicKey))

    const { token } = await manager.createToken({
      sub: 'test-wallet',
      plan: 'free',
    })

    const result = await manager.verifyToken(token)

    expect(result.valid).toBe(true)
    expect(result.algorithm).toBe('ES256')
  })
})

describe('createJWTManager', () => {
  beforeEach(async () => {
    resetJWTManager()
    await setupTestKeys()
  })

  it('creates manager with ES256 keys', async () => {
    const manager = await createJWTManager({
      JWT_ES256_PRIVATE_KEY: testES256PrivateKey,
      JWT_ES256_PUBLIC_KEY: testES256PublicKey,
    })

    expect(manager.hasES256()).toBe(true)
    expect(manager.hasHS256()).toBe(false)
  })

  it('creates manager with HS256 secret', async () => {
    const manager = await createJWTManager({
      JWT_SECRET: testHS256Secret,
    })

    expect(manager.hasES256()).toBe(false)
    expect(manager.hasHS256()).toBe(true)
  })

  it('creates manager with both', async () => {
    const manager = await createJWTManager({
      JWT_ES256_PRIVATE_KEY: testES256PrivateKey,
      JWT_ES256_PUBLIC_KEY: testES256PublicKey,
      JWT_SECRET: testHS256Secret,
    })

    expect(manager.hasES256()).toBe(true)
    expect(manager.hasHS256()).toBe(true)
  })
})

describe('getJWTManager (singleton)', () => {
  beforeEach(async () => {
    resetJWTManager()
    await setupTestKeys()
  })

  it('returns same instance on multiple calls', async () => {
    const manager1 = await getJWTManager({ JWT_SECRET: testHS256Secret })
    const manager2 = await getJWTManager({ JWT_SECRET: testHS256Secret })

    expect(manager1).toBe(manager2)
  })

  it('ignores subsequent env changes', async () => {
    // First call with HS256 only
    const manager1 = await getJWTManager({ JWT_SECRET: testHS256Secret })
    expect(manager1.hasES256()).toBe(false)

    // Second call with ES256 - should be ignored
    const manager2 = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: testES256PrivateKey,
      JWT_ES256_PUBLIC_KEY: testES256PublicKey,
    })

    expect(manager2.hasES256()).toBe(false) // Still no ES256
    expect(manager1).toBe(manager2)
  })
})

describe('resetJWTManager', () => {
  beforeEach(async () => {
    await setupTestKeys()
  })

  it('allows new instance after reset', async () => {
    // First manager with HS256
    const manager1 = await getJWTManager({ JWT_SECRET: testHS256Secret })
    expect(manager1.hasHS256()).toBe(true)
    expect(manager1.hasES256()).toBe(false)

    // Reset
    resetJWTManager()

    // New manager with ES256
    const manager2 = await getJWTManager({
      JWT_ES256_PRIVATE_KEY: testES256PrivateKey,
      JWT_ES256_PUBLIC_KEY: testES256PublicKey,
    })

    expect(manager2.hasES256()).toBe(true)
    expect(manager1).not.toBe(manager2)
  })
})

describe('Integration: Full Token Lifecycle', () => {
  beforeEach(async () => {
    resetJWTManager()
    await setupTestKeys()
  })

  it('ES256: create, verify, and decode cycle', async () => {
    const manager = await createJWTManager({
      JWT_ES256_PRIVATE_KEY: testES256PrivateKey,
      JWT_ES256_PUBLIC_KEY: testES256PublicKey,
    })

    // Create
    const { token, jti, expiresAt } = await manager.createToken({
      sub: 'wallet-address',
      plan: 'enterprise',
      sessionId: 'sess-123',
    })

    expect(token).toBeDefined()
    expect(jti).toBeDefined()
    expect(expiresAt).toBeGreaterThan(Date.now())

    // Verify
    const verifyResult = await manager.verifyToken(token)
    expect(verifyResult.valid).toBe(true)
    expect(verifyResult.payload?.sub).toBe('wallet-address')
    expect(verifyResult.payload?.plan).toBe('enterprise')
    expect(verifyResult.payload?.jti).toBe(jti)
    expect(verifyResult.algorithm).toBe('ES256')

    // Decode
    const decoded = manager.decodeToken(token)
    expect(decoded?.sub).toBe('wallet-address')
    expect(decoded?.jti).toBe(jti)
  })

  it('HS256: create, verify, and decode cycle', async () => {
    const manager = await createJWTManager({
      JWT_SECRET: testHS256Secret,
    })

    // Create
    const { token, jti } = await manager.createToken({
      sub: 'wallet-address',
      plan: 'starter',
    })

    // Verify
    const verifyResult = await manager.verifyToken(token)
    expect(verifyResult.valid).toBe(true)
    expect(verifyResult.payload?.sub).toBe('wallet-address')
    expect(verifyResult.payload?.jti).toBe(jti)
    expect(verifyResult.algorithm).toBe('HS256')

    // Decode
    const decoded = manager.decodeToken(token)
    expect(decoded?.sub).toBe('wallet-address')
  })

  it('prefers ES256 when both available', async () => {
    const manager = await createJWTManager({
      JWT_ES256_PRIVATE_KEY: testES256PrivateKey,
      JWT_ES256_PUBLIC_KEY: testES256PublicKey,
      JWT_SECRET: testHS256Secret,
    })

    const { token } = await manager.createToken({
      sub: 'wallet',
      plan: 'free',
    })

    const header = jose.decodeProtectedHeader(token)
    expect(header.alg).toBe('ES256')

    const verifyResult = await manager.verifyToken(token)
    expect(verifyResult.algorithm).toBe('ES256')
  })
})
