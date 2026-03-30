/**
 * DNS Resolver Tests
 *
 * Tests for DNS rebinding protection via DNS-over-HTTPS resolution.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  isPrivateIp,
  validateResolvedIp,
  resolveAndValidate,
  resolveAndValidateUrl,
  extractHostname,
} from './dns-resolver'

describe('dns-resolver', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ============================================
  // IP VALIDATION
  // ============================================

  describe('isPrivateIp', () => {
    describe('IPv4 private ranges', () => {
      it('detects loopback (127.x.x.x)', () => {
        expect(isPrivateIp('127.0.0.1')).toBe(true)
        expect(isPrivateIp('127.1.2.3')).toBe(true)
        expect(isPrivateIp('127.255.255.255')).toBe(true)
      })

      it('detects Class A private (10.x.x.x)', () => {
        expect(isPrivateIp('10.0.0.1')).toBe(true)
        expect(isPrivateIp('10.255.255.255')).toBe(true)
      })

      it('detects Class B private (172.16-31.x.x)', () => {
        expect(isPrivateIp('172.16.0.1')).toBe(true)
        expect(isPrivateIp('172.31.255.255')).toBe(true)
        // 172.15.x.x is NOT private
        expect(isPrivateIp('172.15.0.1')).toBe(false)
        // 172.32.x.x is NOT private
        expect(isPrivateIp('172.32.0.1')).toBe(false)
      })

      it('detects Class C private (192.168.x.x)', () => {
        expect(isPrivateIp('192.168.0.1')).toBe(true)
        expect(isPrivateIp('192.168.1.100')).toBe(true)
        // 192.167.x.x is NOT private
        expect(isPrivateIp('192.167.0.1')).toBe(false)
      })

      it('detects link-local (169.254.x.x)', () => {
        expect(isPrivateIp('169.254.0.1')).toBe(true)
        expect(isPrivateIp('169.254.169.254')).toBe(true)
      })

      it('detects current network (0.x.x.x)', () => {
        expect(isPrivateIp('0.0.0.0')).toBe(true)
        expect(isPrivateIp('0.1.2.3')).toBe(true)
      })

      it('detects multicast (224.x.x.x)', () => {
        expect(isPrivateIp('224.0.0.1')).toBe(true)
      })

      it('detects reserved (240.x.x.x)', () => {
        expect(isPrivateIp('240.0.0.1')).toBe(true)
      })
    })

    describe('IPv6 private ranges', () => {
      it('detects loopback (::1)', () => {
        expect(isPrivateIp('::1')).toBe(true)
      })

      it('detects private (fc00::)', () => {
        expect(isPrivateIp('fc00::1')).toBe(true)
        expect(isPrivateIp('FC00::1')).toBe(true)
      })

      it('detects ULA (fd00::)', () => {
        expect(isPrivateIp('fd00::1')).toBe(true)
      })

      it('detects link-local (fe80::)', () => {
        expect(isPrivateIp('fe80::1')).toBe(true)
        expect(isPrivateIp('FE80::1')).toBe(true)
      })

      it('detects IPv4-mapped private addresses', () => {
        expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true)
        expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true)
        expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true)
      })
    })

    describe('public IPs', () => {
      it('allows public IPv4 addresses', () => {
        expect(isPrivateIp('8.8.8.8')).toBe(false)
        expect(isPrivateIp('1.1.1.1')).toBe(false)
        expect(isPrivateIp('142.250.80.46')).toBe(false)
        expect(isPrivateIp('104.16.132.229')).toBe(false)
      })

      it('allows public IPv6 addresses', () => {
        expect(isPrivateIp('2001:4860:4860::8888')).toBe(false)
        expect(isPrivateIp('2606:4700:4700::1111')).toBe(false)
      })
    })
  })

  describe('validateResolvedIp', () => {
    it('returns safe for public IPs', () => {
      const result = validateResolvedIp('8.8.8.8')
      expect(result.safe).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('returns unsafe for private IPs', () => {
      const result = validateResolvedIp('192.168.1.1')
      expect(result.safe).toBe(false)
      expect(result.error).toContain('private')
    })

    it('returns unsafe for empty IP', () => {
      const result = validateResolvedIp('')
      expect(result.safe).toBe(false)
      expect(result.error).toContain('Empty')
    })
  })

  // ============================================
  // HOSTNAME EXTRACTION
  // ============================================

  describe('extractHostname', () => {
    it('extracts hostname from URL', () => {
      expect(extractHostname('https://api.example.com/path')).toBe('api.example.com')
      expect(extractHostname('http://localhost:3000/api')).toBe('localhost')
      expect(extractHostname('https://192.168.1.1:8080/data')).toBe('192.168.1.1')
    })

    it('returns null for invalid URLs', () => {
      expect(extractHostname('not-a-url')).toBeNull()
      expect(extractHostname('')).toBeNull()
    })
  })

  // ============================================
  // DNS RESOLUTION
  // ============================================

  describe('resolveAndValidate', () => {
    it('returns invalid for empty hostname', async () => {
      const result = await resolveAndValidate('')
      expect(result.safe).toBe(false)
      expect(result.errorCode).toBe('INVALID_HOSTNAME')
    })

    it('validates IP addresses directly without DNS lookup', async () => {
      // Public IP should be safe
      const publicResult = await resolveAndValidate('8.8.8.8')
      expect(publicResult.safe).toBe(true)
      expect(publicResult.ip).toBe('8.8.8.8')

      // Private IP should be blocked
      const privateResult = await resolveAndValidate('192.168.1.1')
      expect(privateResult.safe).toBe(false)
      expect(privateResult.errorCode).toBe('PRIVATE_IP_RESOLVED')
    })

    it('resolves real hostname via DoH', async () => {
      // Mock fetch to simulate DoH response
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [{ type: 1, data: '142.250.80.46' }], // Google's IP
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/dns-json' },
          }
        )
      )

      const result = await resolveAndValidate('google.com')
      expect(result.safe).toBe(true)
      expect(result.ip).toBe('142.250.80.46')
    })

    it('blocks hostname resolving to private IP', async () => {
      // Mock fetch to simulate DoH response with private IP
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [{ type: 1, data: '192.168.1.1' }],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/dns-json' },
          }
        )
      )

      const result = await resolveAndValidate('evil.attacker.com')
      expect(result.safe).toBe(false)
      expect(result.errorCode).toBe('PRIVATE_IP_RESOLVED')
      expect(result.ip).toBe('192.168.1.1')
    })

    it('handles DNS resolution failure', async () => {
      // Mock fetch to simulate failed DoH responses
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response(JSON.stringify({ Status: 3 }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ Status: 3 }), { status: 200 }))

      const result = await resolveAndValidate('nonexistent.invalid')
      expect(result.safe).toBe(false)
      expect(result.errorCode).toBe('DNS_RESOLUTION_FAILED')
    })

    it('falls back to second DoH provider on failure', async () => {
      // First provider fails, second succeeds
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(new Response('', { status: 500 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              Status: 0,
              Answer: [{ type: 1, data: '8.8.8.8' }],
            }),
            { status: 200 }
          )
        )

      const result = await resolveAndValidate('example.com')
      expect(result.safe).toBe(true)
      expect(result.ip).toBe('8.8.8.8')
    })
  })

  describe('resolveAndValidateUrl', () => {
    it('extracts hostname and validates', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            Status: 0,
            Answer: [{ type: 1, data: '104.16.132.229' }],
          }),
          { status: 200 }
        )
      )

      const result = await resolveAndValidateUrl('https://api.example.com/data')
      expect(result.safe).toBe(true)
    })

    it('returns error for invalid URL', async () => {
      const result = await resolveAndValidateUrl('not-a-url')
      expect(result.safe).toBe(false)
      expect(result.errorCode).toBe('INVALID_HOSTNAME')
    })
  })
})
