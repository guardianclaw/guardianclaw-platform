/**
 * Token Prices Routes
 * Real-time token price API with caching
 *
 * Endpoints:
 * - GET /prices         - Get all token prices (SOL, USDC, GCLAW)
 * - GET /prices/:symbol - Get price for a specific token
 */

import { Hono } from 'hono'
import { z } from 'zod'
import {
  getTokenPrices,
  getTokenPrice,
  tokenToUsd,
  usdToToken,
  type TokenSymbol,
  TOKEN_ADDRESSES,
} from '../services/prices'

type Bindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
}

export const pricesRoutes = new Hono<{ Bindings: Bindings }>()

// Validation
const symbolSchema = z.enum(['SOL', 'USDC', 'GCLAW'])

const convertSchema = z.object({
  from: z.enum(['SOL', 'USDC', 'GCLAW', 'USD']),
  to: z.enum(['SOL', 'USDC', 'GCLAW', 'USD']),
  amount: z.coerce.number().positive(),
})

/**
 * GET /prices
 * Get all token prices with source and cache info
 */
pricesRoutes.get('/', async (c) => {
  try {
    const forceRefresh = c.req.query('refresh') === 'true'
    const response = await getTokenPrices(forceRefresh)

    // Set cache headers
    c.header('Cache-Control', 'public, max-age=30')

    return c.json({
      success: true,
      data: response,
    })
  } catch (error) {
    console.error('[Prices] Error fetching prices:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to fetch token prices',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

/**
 * GET /prices/convert
 * Convert between tokens and USD
 * Query params: from, to, amount
 * Example: /prices/convert?from=SOL&to=USD&amount=1
 * NOTE: Must be defined before /:symbol to avoid being caught by wildcard
 */
pricesRoutes.get('/convert', async (c) => {
  try {
    const query = {
      from: c.req.query('from'),
      to: c.req.query('to'),
      amount: c.req.query('amount'),
    }

    const parsed = convertSchema.safeParse(query)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Invalid conversion parameters',
          details: parsed.error.issues,
          example: '/prices/convert?from=SOL&to=USD&amount=1',
        },
        400
      )
    }

    const { from, to, amount } = parsed.data

    let result: number

    if (from === 'USD' && to !== 'USD') {
      // USD to token
      result = await usdToToken(to as TokenSymbol, amount)
    } else if (from !== 'USD' && to === 'USD') {
      // Token to USD
      result = await tokenToUsd(from as TokenSymbol, amount)
    } else if (from !== 'USD' && to !== 'USD') {
      // Token to token (via USD)
      const usdValue = await tokenToUsd(from as TokenSymbol, amount)
      result = await usdToToken(to as TokenSymbol, usdValue)
    } else {
      // USD to USD
      result = amount
    }

    c.header('Cache-Control', 'public, max-age=30')

    return c.json({
      success: true,
      data: {
        from,
        to,
        input_amount: amount,
        output_amount: result,
        rate: result / amount,
      },
    })
  } catch (error) {
    console.error('[Prices] Error converting:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to convert',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    )
  }
})

/**
 * GET /prices/addresses
 * Get token mint addresses
 * NOTE: Must be defined before /:symbol to avoid being caught by wildcard
 */
pricesRoutes.get('/addresses', (c) => {
  c.header('Cache-Control', 'public, max-age=3600')

  return c.json({
    success: true,
    data: TOKEN_ADDRESSES,
  })
})

/**
 * GET /prices/:symbol
 * Get price for a specific token (SOL, USDC, or GCLAW)
 * NOTE: Must be defined AFTER /convert and /addresses routes
 */
pricesRoutes.get('/:symbol', async (c) => {
  try {
    const symbol = c.req.param('symbol').toUpperCase()

    // Validate symbol
    const parsed = symbolSchema.safeParse(symbol)
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          error: 'Invalid token symbol',
          valid_symbols: ['SOL', 'USDC', 'GCLAW'],
        },
        400
      )
    }

    const price = await getTokenPrice(parsed.data as TokenSymbol)

    c.header('Cache-Control', 'public, max-age=30')

    return c.json({
      success: true,
      data: price,
    })
  } catch (error) {
    console.error('[Prices] Error fetching price:', error)
    return c.json(
      {
        success: false,
        error: 'Failed to fetch token price',
      },
      500
    )
  }
})
