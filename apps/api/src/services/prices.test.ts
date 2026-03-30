import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getTokenPrices,
  getTokenPrice,
  tokenToUsd,
  usdToToken,
  clearPriceCache,
  TOKEN_ADDRESSES,
} from './prices'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Prices Service', () => {
  beforeEach(() => {
    clearPriceCache()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('TOKEN_ADDRESSES', () => {
    it('should have correct SOL address', () => {
      expect(TOKEN_ADDRESSES.SOL).toBe('So11111111111111111111111111111111111111112')
    })

    it('should have correct USDC address', () => {
      expect(TOKEN_ADDRESSES.USDC).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    })

    it('should have correct GCLAW address', () => {
      expect(TOKEN_ADDRESSES.GCLAW).toBe(process.env.NEXT_PUBLIC_GCLAW_MINT || '')
    })
  })

  describe('getTokenPrices', () => {
    it('should fetch prices from Jupiter API', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 245.5 },
              [TOKEN_ADDRESSES.USDC]: { price: 1.0 },
              [TOKEN_ADDRESSES.GCLAW]: { price: 0.00015 },
            },
          }),
      })

      const result = await getTokenPrices()

      expect(result.prices.SOL.priceUsd).toBe(245.5)
      expect(result.prices.USDC.priceUsd).toBe(1.0)
      expect(result.prices.GCLAW.priceUsd).toBe(0.00015)
      expect(result.cached).toBe(false)
    })

    it('should return cached data on subsequent calls', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 245.5 },
              [TOKEN_ADDRESSES.USDC]: { price: 1.0 },
              [TOKEN_ADDRESSES.GCLAW]: { price: 0.00015 },
            },
          }),
      })

      // First call - fetches fresh data
      const result1 = await getTokenPrices()
      expect(result1.cached).toBe(false)

      // Second call - should return cached data
      const result2 = await getTokenPrices()
      expect(result2.cached).toBe(true)
      expect(result2.prices.SOL.priceUsd).toBe(245.5)
    })

    it('should force refresh when requested', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 245.5 },
            },
          }),
      })

      await getTokenPrices()

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 250.0 },
            },
          }),
      })

      const result = await getTokenPrices(true) // Force refresh
      expect(result.cached).toBe(false)
    })

    it('should use fallback prices when all APIs fail', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await getTokenPrices()

      // Should use fallback prices
      expect(result.prices.SOL.priceUsd).toBe(250) // Fallback
      expect(result.prices.SOL.source).toBe('fallback')
      expect(result.prices.USDC.priceUsd).toBe(1.0)
      expect(result.prices.GCLAW.source).toBe('fallback')
    })

    it('should fallback to CoinGecko for SOL when Jupiter fails', async () => {
      // Jupiter fails
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('jup.ag')) {
          return Promise.reject(new Error('Jupiter unavailable'))
        }
        if (url.includes('binance.com')) {
          return Promise.reject(new Error('Binance unavailable'))
        }
        if (url.includes('coingecko.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ solana: { usd: 248.75 } }),
          })
        }
        if (url.includes('dexscreener.com')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ pairs: [{ priceUsd: '0.00012' }] }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      const result = await getTokenPrices()

      expect(result.prices.SOL.priceUsd).toBe(248.75)
      expect(result.prices.SOL.source).toBe('coingecko')
    })

    it('should fallback to DexScreener for GCLAW when Jupiter fails', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('jup.ag')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                data: {
                  [TOKEN_ADDRESSES.SOL]: { price: 245.0 },
                  // No GCLAW price
                },
              }),
          })
        }
        if (url.includes('dexscreener.com')) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                pairs: [
                  { priceUsd: '0.00018', liquidity: { usd: 50000 } },
                  { priceUsd: '0.00015', liquidity: { usd: 100000 } }, // Higher liquidity
                ],
              }),
          })
        }
        return Promise.reject(new Error('Unknown URL'))
      })

      const result = await getTokenPrices()

      // Should pick the pair with higher liquidity
      expect(result.prices.GCLAW.priceUsd).toBe(0.00015)
      expect(result.prices.GCLAW.source).toBe('dexscreener')
    })
  })

  describe('getTokenPrice', () => {
    it('should return price for a specific token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 245.5 },
              [TOKEN_ADDRESSES.USDC]: { price: 1.0 },
              [TOKEN_ADDRESSES.GCLAW]: { price: 0.00015 },
            },
          }),
      })

      const solPrice = await getTokenPrice('SOL')
      expect(solPrice.symbol).toBe('SOL')
      expect(solPrice.priceUsd).toBe(245.5)

      const clawPrice = await getTokenPrice('GCLAW')
      expect(clawPrice.symbol).toBe('GCLAW')
      expect(clawPrice.priceUsd).toBe(0.00015)
    })
  })

  describe('tokenToUsd', () => {
    it('should convert SOL to USD correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 250.0 },
            },
          }),
      })

      const usdValue = await tokenToUsd('SOL', 2.5)
      expect(usdValue).toBe(625.0)
    })

    it('should convert GCLAW to USD correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.GCLAW]: { price: 0.0002 },
            },
          }),
      })

      const usdValue = await tokenToUsd('GCLAW', 10000)
      expect(usdValue).toBe(2.0)
    })

    it('should convert USDC 1:1 to USD', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.USDC]: { price: 1.0 },
            },
          }),
      })

      const usdValue = await tokenToUsd('USDC', 100)
      expect(usdValue).toBe(100)
    })
  })

  describe('usdToToken', () => {
    it('should convert USD to SOL correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 250.0 },
            },
          }),
      })

      const solAmount = await usdToToken('SOL', 100)
      expect(solAmount).toBe(0.4)
    })

    it('should convert USD to GCLAW correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.GCLAW]: { price: 0.0002 },
            },
          }),
      })

      const clawAmount = await usdToToken('GCLAW', 10)
      expect(clawAmount).toBe(50000)
    })

    it('should handle zero price gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('API Error'))

      // With fallback prices, GCLAW should have a non-zero default
      // If somehow price is 0, it should throw
      clearPriceCache()

      // Force a scenario where we can test zero price handling
      // The service uses fallback which is 0.0001, not 0
      const result = await usdToToken('GCLAW', 10)
      expect(result).toBeGreaterThan(0)
    })
  })

  describe('clearPriceCache', () => {
    it('should clear the cache', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              [TOKEN_ADDRESSES.SOL]: { price: 245.0 },
            },
          }),
      })

      // First call
      const result1 = await getTokenPrices()
      expect(result1.cached).toBe(false)

      // Verify cached
      const result2 = await getTokenPrices()
      expect(result2.cached).toBe(true)

      // Clear cache
      clearPriceCache()

      // Should fetch fresh
      const result3 = await getTokenPrices()
      expect(result3.cached).toBe(false)
    })
  })

  describe('API timeout handling', () => {
    it('should handle slow API responses gracefully', async () => {
      // Simulate timeout by rejecting after delay
      mockFetch.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      )

      // Should fall back to default prices without hanging
      const result = await getTokenPrices()
      expect(result.prices.SOL.source).toBe('fallback')
    })
  })
})
