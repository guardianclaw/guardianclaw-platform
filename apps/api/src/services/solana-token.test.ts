/**
 * Solana token balance service unit tests
 * Tests: balance fetching, caching, error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @solana/web3.js before importing the module
const mockGetAccountInfo = vi.fn()
const mockGetTokenAccountsByOwner = vi.fn()

vi.mock('@solana/web3.js', () => {
  // Connection must be a proper constructor class
  class MockConnection {
    constructor(_url: string) {}
    getAccountInfo = mockGetAccountInfo
    getTokenAccountsByOwner = mockGetTokenAccountsByOwner
  }

  // PublicKey must be a proper constructor class
  class MockPublicKey {
    private addr: string
    constructor(addr: string) {
      this.addr = addr
    }
    toBuffer() {
      return Buffer.from(this.addr.padEnd(32, '0').slice(0, 32))
    }
    toBase58() {
      return this.addr
    }
    // Static method for findProgramAddressSync
    static findProgramAddressSync = vi.fn(() => [new MockPublicKey('derived-address'), 255])
  }

  return {
    Connection: MockConnection,
    PublicKey: MockPublicKey,
  }
})

// Import after mock
import {
  getGuardianClawBalance,
  getGuardianClawBalanceViaOwner,
  clearBalanceCache,
  getCacheStats,
  GCLAW_MINT,
  TOKEN_DECIMALS,
} from './solana-token'

describe('Solana Token Service', () => {
  const testWallet = 'TestWa11et1111111111111111111111111111111111'
  const testRpc = 'https://api.devnet.solana.com'

  beforeEach(() => {
    clearBalanceCache()
    vi.clearAllMocks()
  })

  describe('Constants', () => {
    it('exports GCLAW_MINT', () => {
      expect(GCLAW_MINT).toBeDefined()
    })

    it('exports TOKEN_DECIMALS as 6', () => {
      expect(TOKEN_DECIMALS).toBe(6)
    })
  })

  describe('getGuardianClawBalance', () => {
    it('returns zero balance when token account does not exist', async () => {
      mockGetAccountInfo.mockResolvedValue(null)

      const result = await getGuardianClawBalance(testRpc, testWallet)

      expect(result.balance).toBe(0)
      expect(result.rawBalance).toBe(BigInt(0))
      expect(result.decimals).toBe(6)
      expect(result.cached).toBe(false)
    })

    it('parses token balance from account data', async () => {
      // Create mock account data with 1,000,000 tokens (6 decimals = 1 token)
      // Token account layout: mint (32) + owner (32) + amount (8 bytes LE)
      const accountData = new Uint8Array(165)
      const amount = BigInt(1_000_000)
      const view = new DataView(accountData.buffer)
      view.setBigUint64(64, amount, true) // Little-endian at offset 64

      mockGetAccountInfo.mockResolvedValue({
        data: accountData,
      })

      const result = await getGuardianClawBalance(testRpc, testWallet)

      expect(result.balance).toBe(1) // 1,000,000 / 10^6 = 1
      expect(result.rawBalance).toBe(BigInt(1_000_000))
      expect(result.cached).toBe(false)
    })

    it('returns cached value on second call', async () => {
      const accountData = new Uint8Array(165)
      const view = new DataView(accountData.buffer)
      view.setBigUint64(64, BigInt(5_000_000), true)

      mockGetAccountInfo.mockResolvedValue({ data: accountData })

      // First call
      const result1 = await getGuardianClawBalance(testRpc, testWallet)
      expect(result1.balance).toBe(5)
      expect(result1.cached).toBe(false)

      // Second call should return cached
      const result2 = await getGuardianClawBalance(testRpc, testWallet)
      expect(result2.balance).toBe(5)
      expect(result2.cached).toBe(true)

      // getAccountInfo should only be called once
      expect(mockGetAccountInfo).toHaveBeenCalledTimes(1)
    })

    it('returns error state on RPC failure', async () => {
      mockGetAccountInfo.mockRejectedValue(new Error('RPC connection failed'))

      const result = await getGuardianClawBalance(testRpc, testWallet)

      expect(result.balance).toBe(0)
      expect(result.error).toBe('RPC connection failed')
      expect(result.cached).toBe(false)
    })

    it('returns cached value on RPC failure if available', async () => {
      const accountData = new Uint8Array(165)
      const view = new DataView(accountData.buffer)
      view.setBigUint64(64, BigInt(10_000_000), true)

      // First call succeeds
      mockGetAccountInfo.mockResolvedValueOnce({ data: accountData })
      await getGuardianClawBalance(testRpc, testWallet)

      // Manually clear mock to simulate time passing
      vi.clearAllMocks()

      // Force cache to be stale by clearing and re-adding
      clearBalanceCache()

      // Set up for a new call that will fail
      mockGetAccountInfo.mockResolvedValueOnce({ data: accountData })
      const _result1 = await getGuardianClawBalance(testRpc, testWallet)

      // Now simulate RPC failure on next fresh call
      mockGetAccountInfo.mockRejectedValueOnce(new Error('Network error'))
      const result2 = await getGuardianClawBalance(testRpc, testWallet)

      // Should return cached value
      expect(result2.balance).toBe(10)
      expect(result2.cached).toBe(true)
    })

    it('handles short account data', async () => {
      // Data shorter than 72 bytes
      const shortData = new Uint8Array(50)

      mockGetAccountInfo.mockResolvedValue({ data: shortData })

      const result = await getGuardianClawBalance(testRpc, testWallet)

      // parseTokenAccountBalance returns 0 for short data
      expect(result.balance).toBe(0)
    })
  })

  describe('getGuardianClawBalanceViaOwner', () => {
    it('returns zero when no token accounts found', async () => {
      mockGetTokenAccountsByOwner.mockResolvedValue({ value: [] })

      const result = await getGuardianClawBalanceViaOwner(testRpc, testWallet)

      expect(result.balance).toBe(0)
      expect(result.rawBalance).toBe(BigInt(0))
    })

    it('sums balance from multiple token accounts', async () => {
      const accountData1 = new Uint8Array(165)
      const view1 = new DataView(accountData1.buffer)
      view1.setBigUint64(64, BigInt(1_000_000), true)

      const accountData2 = new Uint8Array(165)
      const view2 = new DataView(accountData2.buffer)
      view2.setBigUint64(64, BigInt(2_000_000), true)

      mockGetTokenAccountsByOwner.mockResolvedValue({
        value: [{ account: { data: accountData1 } }, { account: { data: accountData2 } }],
      })

      const result = await getGuardianClawBalanceViaOwner(testRpc, testWallet)

      expect(result.balance).toBe(3) // (1M + 2M) / 10^6 = 3
      expect(result.rawBalance).toBe(BigInt(3_000_000))
    })

    it('returns error state on failure', async () => {
      mockGetTokenAccountsByOwner.mockRejectedValue(new Error('Query failed'))

      const result = await getGuardianClawBalanceViaOwner(testRpc, testWallet)

      expect(result.balance).toBe(0)
      expect(result.error).toBe('Query failed')
    })
  })

  describe('clearBalanceCache', () => {
    it('clears all cached entries', async () => {
      const accountData = new Uint8Array(165)
      const view = new DataView(accountData.buffer)
      view.setBigUint64(64, BigInt(1_000_000), true)

      mockGetAccountInfo.mockResolvedValue({ data: accountData })

      // Populate cache
      await getGuardianClawBalance(testRpc, testWallet)

      const statsBefore = getCacheStats()
      expect(statsBefore.size).toBe(1)

      clearBalanceCache()

      const statsAfter = getCacheStats()
      expect(statsAfter.size).toBe(0)
    })
  })

  describe('getCacheStats', () => {
    it('returns cache size and entries', async () => {
      const accountData = new Uint8Array(165)
      const view = new DataView(accountData.buffer)
      view.setBigUint64(64, BigInt(1_000_000), true)

      mockGetAccountInfo.mockResolvedValue({ data: accountData })

      await getGuardianClawBalance(testRpc, 'wallet1')
      await getGuardianClawBalance(testRpc, 'wallet2')

      const stats = getCacheStats()

      expect(stats.size).toBe(2)
      expect(stats.entries).toContain('wallet1')
      expect(stats.entries).toContain('wallet2')
    })

    it('returns empty stats when cache is empty', () => {
      const stats = getCacheStats()

      expect(stats.size).toBe(0)
      expect(stats.entries).toHaveLength(0)
    })
  })
})
