import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Hono } from 'hono'
import { pricesRoutes } from './prices'

// Mock the prices service
vi.mock('../services/prices', () => ({
  getTokenPrices: vi.fn(),
  getTokenPrice: vi.fn(),
  tokenToUsd: vi.fn(),
  usdToToken: vi.fn(),
  TOKEN_ADDRESSES: {
    SOL: 'So11111111111111111111111111111111111111112',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    GCLAW: '',
  },
}))

import { getTokenPrices, getTokenPrice, tokenToUsd, usdToToken } from '../services/prices'

const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
}

interface PricesResponse {
  success: boolean
  data: {
    prices: Record<string, { symbol: string; priceUsd: number; source: string; timestamp: number }>
    cached: boolean
    cacheAge: number
    fetchedAt: string
  }
}

interface ErrorResponse {
  success: boolean
  error: string
  valid_symbols?: string[]
  message?: string
}

interface ConvertResponse {
  success: boolean
  data: {
    from: string
    to: string
    input_amount: number
    output_amount: number
    rate: number
  }
}

interface AddressesResponse {
  success: boolean
  data: Record<string, string>
}

describe('Prices Routes', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.route('/prices', pricesRoutes)
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('GET /prices', () => {
    it('should return all token prices', async () => {
      const mockPrices = {
        prices: {
          SOL: { symbol: 'SOL', priceUsd: 245.5, source: 'jupiter', timestamp: Date.now() },
          USDC: { symbol: 'USDC', priceUsd: 1.0, source: 'fixed', timestamp: Date.now() },
          GCLAW: {
            symbol: 'GCLAW',
            priceUsd: 0.00015,
            source: 'dexscreener',
            timestamp: Date.now(),
          },
        },
        cached: false,
        cacheAge: 0,
        fetchedAt: new Date().toISOString(),
      }

      vi.mocked(getTokenPrices).mockResolvedValue(mockPrices)

      const res = await app.request('/prices', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as PricesResponse

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.prices.SOL.priceUsd).toBe(245.5)
      expect(data.data.prices.USDC.priceUsd).toBe(1.0)
      expect(data.data.prices.GCLAW.priceUsd).toBe(0.00015)
    })

    it('should respect Cache-Control header', async () => {
      vi.mocked(getTokenPrices).mockResolvedValue({
        prices: {
          SOL: { symbol: 'SOL', priceUsd: 245.5, source: 'jupiter', timestamp: Date.now() },
          USDC: { symbol: 'USDC', priceUsd: 1.0, source: 'fixed', timestamp: Date.now() },
          GCLAW: { symbol: 'GCLAW', priceUsd: 0.00015, source: 'jupiter', timestamp: Date.now() },
        },
        cached: true,
        cacheAge: 15000,
        fetchedAt: new Date().toISOString(),
      })

      const res = await app.request('/prices', { method: 'GET' }, mockEnv)

      expect(res.headers.get('Cache-Control')).toBe('public, max-age=30')
    })

    it('should force refresh when refresh=true', async () => {
      vi.mocked(getTokenPrices).mockResolvedValue({
        prices: {
          SOL: { symbol: 'SOL', priceUsd: 250.0, source: 'jupiter', timestamp: Date.now() },
          USDC: { symbol: 'USDC', priceUsd: 1.0, source: 'fixed', timestamp: Date.now() },
          GCLAW: { symbol: 'GCLAW', priceUsd: 0.00015, source: 'jupiter', timestamp: Date.now() },
        },
        cached: false,
        cacheAge: 0,
        fetchedAt: new Date().toISOString(),
      })

      const res = await app.request('/prices?refresh=true', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as PricesResponse

      expect(res.status).toBe(200)
      expect(vi.mocked(getTokenPrices)).toHaveBeenCalledWith(true)
      expect(data.data.cached).toBe(false)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(getTokenPrices).mockRejectedValue(new Error('Service unavailable'))

      const res = await app.request('/prices', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as ErrorResponse

      expect(res.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch token prices')
    })
  })

  describe('GET /prices/:symbol', () => {
    it('should return price for SOL', async () => {
      vi.mocked(getTokenPrice).mockResolvedValue({
        symbol: 'SOL',
        priceUsd: 245.5,
        source: 'jupiter',
        timestamp: Date.now(),
      })

      const res = await app.request('/prices/SOL', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as {
        success: boolean
        data: { symbol: string; priceUsd: number }
      }

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.symbol).toBe('SOL')
      expect(data.data.priceUsd).toBe(245.5)
    })

    it('should return price for GCLAW (case insensitive)', async () => {
      vi.mocked(getTokenPrice).mockResolvedValue({
        symbol: 'GCLAW',
        priceUsd: 0.00015,
        source: 'dexscreener',
        timestamp: Date.now(),
      })

      const res = await app.request('/prices/gclaw', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as {
        success: boolean
        data: { symbol: string; priceUsd: number }
      }

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.symbol).toBe('GCLAW')
    })

    it('should reject invalid symbol', async () => {
      const res = await app.request('/prices/INVALID', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as ErrorResponse

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid token symbol')
      expect(data.valid_symbols).toContain('SOL')
      expect(data.valid_symbols).toContain('USDC')
      expect(data.valid_symbols).toContain('GCLAW')
    })
  })

  describe('GET /prices/convert', () => {
    it('should convert SOL to USD', async () => {
      vi.mocked(tokenToUsd).mockResolvedValue(490.0) // 2 SOL * $245

      const res = await app.request(
        '/prices/convert?from=SOL&to=USD&amount=2',
        { method: 'GET' },
        mockEnv
      )
      const data = (await res.json()) as ConvertResponse

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.from).toBe('SOL')
      expect(data.data.to).toBe('USD')
      expect(data.data.input_amount).toBe(2)
      expect(data.data.output_amount).toBe(490.0)
    })

    it('should convert USD to GCLAW', async () => {
      vi.mocked(usdToToken).mockResolvedValue(50000) // $10 at $0.0002

      const res = await app.request(
        '/prices/convert?from=USD&to=GCLAW&amount=10',
        { method: 'GET' },
        mockEnv
      )
      const data = (await res.json()) as ConvertResponse

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.from).toBe('USD')
      expect(data.data.to).toBe('GCLAW')
      expect(data.data.output_amount).toBe(50000)
    })

    it('should convert token to token via USD', async () => {
      vi.mocked(tokenToUsd).mockResolvedValue(245.0) // 1 SOL to USD
      vi.mocked(usdToToken).mockResolvedValue(245) // USD to USDC

      const res = await app.request(
        '/prices/convert?from=SOL&to=USDC&amount=1',
        { method: 'GET' },
        mockEnv
      )
      const data = (await res.json()) as ConvertResponse

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.from).toBe('SOL')
      expect(data.data.to).toBe('USDC')
    })

    it('should return USD to USD unchanged', async () => {
      const res = await app.request(
        '/prices/convert?from=USD&to=USD&amount=100',
        { method: 'GET' },
        mockEnv
      )
      const data = (await res.json()) as ConvertResponse

      expect(res.status).toBe(200)
      expect(data.data.input_amount).toBe(100)
      expect(data.data.output_amount).toBe(100)
      expect(data.data.rate).toBe(1)
    })

    it('should reject invalid parameters', async () => {
      const res = await app.request(
        '/prices/convert?from=INVALID&to=USD&amount=1',
        { method: 'GET' },
        mockEnv
      )
      const data = (await res.json()) as ErrorResponse

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid conversion parameters')
    })

    it('should reject negative amounts', async () => {
      const res = await app.request(
        '/prices/convert?from=SOL&to=USD&amount=-5',
        { method: 'GET' },
        mockEnv
      )
      const data = (await res.json()) as ErrorResponse

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should reject missing parameters', async () => {
      const res = await app.request('/prices/convert?from=SOL', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as ErrorResponse

      expect(res.status).toBe(400)
      expect(data.success).toBe(false)
    })
  })

  describe('GET /prices/addresses', () => {
    it('should return all token addresses', async () => {
      const res = await app.request('/prices/addresses', { method: 'GET' }, mockEnv)
      const data = (await res.json()) as AddressesResponse

      expect(res.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.SOL).toBe('So11111111111111111111111111111111111111112')
      expect(data.data.USDC).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
      expect(data.data.GCLAW).toBe('')
    })

    it('should have long cache header for addresses', async () => {
      const res = await app.request('/prices/addresses', { method: 'GET' }, mockEnv)

      expect(res.headers.get('Cache-Control')).toBe('public, max-age=3600')
    })
  })
})
