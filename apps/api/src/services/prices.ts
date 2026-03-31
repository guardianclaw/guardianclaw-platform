/**
 * Token Price Service
 * Real-time price fetching with caching and multiple fallback sources
 *
 * Sources (in order of priority):
 * 1. Jupiter Price API (primary for Solana ecosystem)
 * 2. DexScreener (fallback for $GCLAW)
 * 3. CoinGecko (fallback for SOL)
 */

// Token addresses
export const TOKEN_ADDRESSES = {
  SOL: 'So11111111111111111111111111111111111111112', // Wrapped SOL
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  GCLAW: '', // Set when $GCLAW token is deployed
} as const

export type TokenSymbol = keyof typeof TOKEN_ADDRESSES

// Price data structure
export interface TokenPrice {
  symbol: TokenSymbol
  priceUsd: number
  source: string
  timestamp: number
}

export interface PriceResponse {
  prices: Record<TokenSymbol, TokenPrice>
  cached: boolean
  cacheAge: number
  fetchedAt: string
}

// Cache configuration
const CACHE_TTL_MS = 60_000 // 60 seconds
const FETCH_TIMEOUT_MS = 5_000 // 5 second timeout per source

// In-memory cache
let priceCache: PriceResponse | null = null
let lastFetchTime = 0

/**
 * Fallback prices (updated to reasonable values as of Jan 2026)
 * These are only used if ALL external sources fail
 */
const FALLBACK_PRICES: Record<TokenSymbol, number> = {
  SOL: 250, // Approximate SOL price
  USDC: 1.0, // Stablecoin
  GCLAW: 0.0001, // Conservative estimate
}

/**
 * Fetch with timeout wrapper
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'GuardianClaw-Platform/1.0',
      },
    })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetch prices from Jupiter Price API
 * Best source for Solana ecosystem tokens
 */
async function fetchFromJupiter(): Promise<Partial<Record<TokenSymbol, number>>> {
  const prices: Partial<Record<TokenSymbol, number>> = {}

  try {
    const ids = Object.values(TOKEN_ADDRESSES).join(',')
    const response = await fetchWithTimeout(`https://price.jup.ag/v6/price?ids=${ids}`)

    if (!response.ok) {
      throw new Error(`Jupiter API returned ${response.status}`)
    }

    const data = (await response.json()) as { data?: Record<string, { price?: number }> }

    // Map addresses back to symbols
    for (const [symbol, address] of Object.entries(TOKEN_ADDRESSES)) {
      const priceData = data.data?.[address]
      if (priceData?.price && typeof priceData.price === 'number') {
        prices[symbol as TokenSymbol] = priceData.price
      }
    }
  } catch (error) {
    console.warn(
      '[Prices] Jupiter fetch failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  return prices
}

/**
 * Fetch SOL price from CoinGecko
 * Reliable fallback for SOL specifically
 */
async function fetchSolFromCoinGecko(): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
    )

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`)
    }

    const data = (await response.json()) as { solana?: { usd?: number } }
    const price = data.solana?.usd

    if (typeof price === 'number' && price > 0) {
      return price
    }
  } catch (error) {
    console.warn(
      '[Prices] CoinGecko fetch failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  return null
}

/**
 * Fetch GCLAW price from DexScreener
 * Best source for newer tokens not on major exchanges
 */
async function fetchGuardianClawFromDexScreener(): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${TOKEN_ADDRESSES.GCLAW}`
    )

    if (!response.ok) {
      throw new Error(`DexScreener API returned ${response.status}`)
    }

    const data = (await response.json()) as {
      pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }>
    }

    // Get the most liquid pair
    const pairs = data.pairs || []
    if (pairs.length > 0) {
      // Sort by liquidity and get the best price
      const sortedPairs = pairs
        .filter((p): p is { priceUsd: string; liquidity?: { usd?: number } } => Boolean(p.priceUsd))
        .sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))

      if (sortedPairs.length > 0) {
        const price = parseFloat(sortedPairs[0].priceUsd)
        if (!isNaN(price) && price > 0) {
          return price
        }
      }
    }
  } catch (error) {
    console.warn(
      '[Prices] DexScreener fetch failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  return null
}

/**
 * Fetch Solana price from Binance
 * Additional fallback
 */
async function fetchSolFromBinance(): Promise<number | null> {
  try {
    const response = await fetchWithTimeout(
      'https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT'
    )

    if (!response.ok) {
      throw new Error(`Binance API returned ${response.status}`)
    }

    const data = (await response.json()) as { price?: string }
    const price = parseFloat(data.price || '0')

    if (!isNaN(price) && price > 0) {
      return price
    }
  } catch (error) {
    console.warn(
      '[Prices] Binance fetch failed:',
      error instanceof Error ? error.message : 'Unknown error'
    )
  }

  return null
}

/**
 * Aggregate prices from multiple sources with fallbacks
 */
async function fetchAllPrices(): Promise<Record<TokenSymbol, TokenPrice>> {
  const now = Date.now()
  const result: Record<TokenSymbol, TokenPrice> = {} as Record<TokenSymbol, TokenPrice>

  // Start all fetches in parallel
  const [jupiterPrices, coinGeckoSol, binanceSol, dexScreenerGuardianClaw] = await Promise.all([
    fetchFromJupiter(),
    fetchSolFromCoinGecko(),
    fetchSolFromBinance(),
    fetchGuardianClawFromDexScreener(),
  ])

  // SOL price: Jupiter > Binance > CoinGecko > Fallback
  let solPrice = jupiterPrices.SOL
  let solSource = 'jupiter'

  if (!solPrice && binanceSol) {
    solPrice = binanceSol
    solSource = 'binance'
  }

  if (!solPrice && coinGeckoSol) {
    solPrice = coinGeckoSol
    solSource = 'coingecko'
  }

  if (!solPrice) {
    solPrice = FALLBACK_PRICES.SOL
    solSource = 'fallback'
  }

  result.SOL = {
    symbol: 'SOL',
    priceUsd: solPrice,
    source: solSource,
    timestamp: now,
  }

  // USDC price: Always $1 (stablecoin)
  result.USDC = {
    symbol: 'USDC',
    priceUsd: jupiterPrices.USDC || 1.0,
    source: jupiterPrices.USDC ? 'jupiter' : 'fixed',
    timestamp: now,
  }

  // GCLAW price: Jupiter > DexScreener > Fallback
  let clawPrice = jupiterPrices.GCLAW
  let clawSource = 'jupiter'

  if (!clawPrice && dexScreenerGuardianClaw) {
    clawPrice = dexScreenerGuardianClaw
    clawSource = 'dexscreener'
  }

  if (!clawPrice) {
    clawPrice = FALLBACK_PRICES.GCLAW
    clawSource = 'fallback'
  }

  result.GCLAW = {
    symbol: 'GCLAW',
    priceUsd: clawPrice,
    source: clawSource,
    timestamp: now,
  }

  return result
}

/**
 * Get current token prices with caching
 * Returns cached data if within TTL, otherwise fetches fresh data
 */
export async function getTokenPrices(forceRefresh = false): Promise<PriceResponse> {
  const now = Date.now()
  const cacheAge = now - lastFetchTime

  // Return cached data if valid and not forcing refresh
  if (!forceRefresh && priceCache && cacheAge < CACHE_TTL_MS) {
    return {
      ...priceCache,
      cached: true,
      cacheAge,
    }
  }

  // Fetch fresh prices
  const prices = await fetchAllPrices()
  const fetchedAt = new Date().toISOString()

  // Update cache
  priceCache = {
    prices,
    cached: false,
    cacheAge: 0,
    fetchedAt,
  }
  lastFetchTime = now

  return priceCache
}

/**
 * Get price for a specific token
 */
export async function getTokenPrice(symbol: TokenSymbol): Promise<TokenPrice> {
  const response = await getTokenPrices()
  return response.prices[symbol]
}

/**
 * Convert token amount to USD
 */
export async function tokenToUsd(symbol: TokenSymbol, amount: number): Promise<number> {
  const price = await getTokenPrice(symbol)
  return amount * price.priceUsd
}

/**
 * Convert USD to token amount
 */
export async function usdToToken(symbol: TokenSymbol, usdAmount: number): Promise<number> {
  const price = await getTokenPrice(symbol)
  if (price.priceUsd === 0) {
    throw new Error(`Cannot convert: ${symbol} price is zero`)
  }
  return usdAmount / price.priceUsd
}

/**
 * Clear the price cache (useful for testing)
 */
export function clearPriceCache(): void {
  priceCache = null
  lastFetchTime = 0
}
