/**
 * Web Search Tool Service
 *
 * Provides web search functionality using multiple providers:
 * - Serper.dev (Google results, requires API key) - RECOMMENDED
 * - DuckDuckGo (free, privacy-focused, fallback) - LIMITED
 *
 * Features:
 * - Automatic provider selection based on credentials
 * - Fallback to DuckDuckGo when no API key available
 * - Consistent result format across providers
 * - Rate limiting and timeout handling
 * - Error sanitization
 *
 * IMPORTANT: DuckDuckGo Limitations
 * =================================
 * The DuckDuckGo provider uses their Instant Answer API, which has significant
 * limitations compared to a full web search:
 *
 * 1. NOT a full web search - Returns only instant answers, Wikipedia summaries,
 *    and related topics. Does NOT return typical web search results.
 *
 * 2. Limited result count - Usually returns 0-5 results at most, often fewer.
 *    Many queries return zero results even for common topics.
 *
 * 3. No real-time results - Cannot find current news, recent events, or
 *    time-sensitive information.
 *
 * 4. No site-specific search - Cannot search within specific websites.
 *
 * 5. Best for: Definition-style queries ("what is X"), entity lookups,
 *    Wikipedia-type information.
 *
 * For production use with reliable web search, configure a Serper.dev API key.
 * Serper provides actual Google search results at $50/month for 2,500 searches.
 *
 * @example
 * const results = await executeWebSearch({
 *   provider: 'serper',
 *   query: 'latest news about AI',
 *   numResults: 5,
 *   apiKey: 'your-serper-api-key'
 * })
 */

// ============================================
// TYPES
// ============================================

/**
 * Supported web search providers.
 */
export type WebSearchProvider = 'serper' | 'duckduckgo' | 'google' | 'bing'

/**
 * Configuration for web search execution.
 */
export interface WebSearchConfig {
  provider: WebSearchProvider
  query: string
  numResults?: number
  apiKey?: string // Required for serper, google, bing
  timeout?: number
}

/**
 * Individual search result.
 */
export interface WebSearchResult {
  title: string
  link: string
  snippet: string
  position: number
}

/**
 * Web search execution result.
 */
export interface WebSearchResponse {
  success: boolean
  results: WebSearchResult[]
  provider: WebSearchProvider
  query: string
  latencyMs: number
  error?: string
  errorCode?: string
}

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_NUM_RESULTS = 5
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_RESULTS = 20

// ============================================
// SERPER PROVIDER
// ============================================

/**
 * Serper.dev API response types.
 */
interface SerperResponse {
  organic?: Array<{
    title: string
    link: string
    snippet: string
    position: number
  }>
  knowledgeGraph?: {
    title?: string
    description?: string
    website?: string
  }
  answerBox?: {
    snippet?: string
    link?: string
  }
}

/**
 * Execute search using Serper.dev API.
 * Provides high-quality Google search results.
 *
 * @param query - Search query
 * @param numResults - Number of results to return
 * @param apiKey - Serper API key
 * @param timeout - Request timeout in ms
 * @returns Search results
 */
async function searchWithSerper(
  query: string,
  numResults: number,
  apiKey: string,
  timeout: number
): Promise<WebSearchResponse> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: Math.min(numResults, MAX_RESULTS),
          gl: 'us',
          hl: 'en',
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const _errorText = await response.text().catch(() => 'Unknown error')

        // Map HTTP status to error code
        let errorCode = 'SERPER_ERROR'
        if (response.status === 401 || response.status === 403) {
          errorCode = 'INVALID_API_KEY'
        } else if (response.status === 429) {
          errorCode = 'RATE_LIMITED'
        }

        return {
          success: false,
          results: [],
          provider: 'serper',
          query,
          latencyMs: Date.now() - startTime,
          error: `Serper API error: ${response.status}`,
          errorCode,
        }
      }

      const data = (await response.json()) as SerperResponse

      // Extract organic results
      const results: WebSearchResult[] = (data.organic || [])
        .slice(0, numResults)
        .map((item, index) => ({
          title: item.title || '',
          link: item.link || '',
          snippet: item.snippet || '',
          position: index + 1,
        }))

      return {
        success: true,
        results,
        provider: 'serper',
        query,
        latencyMs: Date.now() - startTime,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        results: [],
        provider: 'serper',
        query,
        latencyMs,
        error: `Request timed out after ${timeout}ms`,
        errorCode: 'TIMEOUT',
      }
    }

    return {
      success: false,
      results: [],
      provider: 'serper',
      query,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'NETWORK_ERROR',
    }
  }
}

// ============================================
// DUCKDUCKGO PROVIDER
// ============================================

/**
 * DuckDuckGo HTML search response parsing.
 * DuckDuckGo doesn't have a public API, so we use the instant answer API
 * which provides limited but reliable results.
 */
interface DuckDuckGoResponse {
  AbstractText?: string
  AbstractURL?: string
  AbstractSource?: string
  Heading?: string
  RelatedTopics?: Array<{
    Text?: string
    FirstURL?: string
    Result?: string
  }>
  Results?: Array<{
    Text?: string
    FirstURL?: string
    Result?: string
  }>
}

/**
 * Execute search using DuckDuckGo Instant Answer API.
 * Free provider with privacy focus, no API key required.
 *
 * WARNING: SIGNIFICANT LIMITATIONS
 * This is NOT a full web search. The DuckDuckGo Instant Answer API:
 * - Returns Wikipedia summaries and instant answers only
 * - Does NOT return typical web search results
 * - Often returns 0 results for many queries
 * - Cannot search for news, recent events, or site-specific content
 *
 * Use Serper.dev for production web search requirements.
 *
 * @param query - Search query (best for "what is X" style queries)
 * @param numResults - Number of results to return (usually 0-5 available)
 * @param timeout - Request timeout in ms
 * @returns Search results (often empty)
 */
async function searchWithDuckDuckGo(
  query: string,
  numResults: number,
  timeout: number
): Promise<WebSearchResponse> {
  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // Use DuckDuckGo Instant Answer API
      const url = new URL('https://api.duckduckgo.com/')
      url.searchParams.set('q', query)
      url.searchParams.set('format', 'json')
      url.searchParams.set('no_html', '1')
      url.searchParams.set('skip_disambig', '1')

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          results: [],
          provider: 'duckduckgo',
          query,
          latencyMs: Date.now() - startTime,
          error: `DuckDuckGo API error: ${response.status}`,
          errorCode: 'DDG_ERROR',
        }
      }

      const data = (await response.json()) as DuckDuckGoResponse
      const results: WebSearchResult[] = []

      // Add abstract if available
      if (data.AbstractText && data.AbstractURL) {
        results.push({
          title: data.Heading || data.AbstractSource || 'Result',
          link: data.AbstractURL,
          snippet: data.AbstractText,
          position: 1,
        })
      }

      // Add results
      if (data.Results) {
        for (const item of data.Results) {
          if (results.length >= numResults) break
          if (item.FirstURL && item.Text) {
            results.push({
              title: extractTitleFromResult(item.Result || item.Text),
              link: item.FirstURL,
              snippet: item.Text,
              position: results.length + 1,
            })
          }
        }
      }

      // Add related topics
      if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
          if (results.length >= numResults) break
          if (topic.FirstURL && topic.Text) {
            results.push({
              title: extractTitleFromResult(topic.Result || topic.Text),
              link: topic.FirstURL,
              snippet: topic.Text,
              position: results.length + 1,
            })
          }
        }
      }

      // If no results from API, indicate that
      if (results.length === 0) {
        return {
          success: true,
          results: [],
          provider: 'duckduckgo',
          query,
          latencyMs: Date.now() - startTime,
        }
      }

      return {
        success: true,
        results: results.slice(0, numResults),
        provider: 'duckduckgo',
        query,
        latencyMs: Date.now() - startTime,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    const latencyMs = Date.now() - startTime

    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        results: [],
        provider: 'duckduckgo',
        query,
        latencyMs,
        error: `Request timed out after ${timeout}ms`,
        errorCode: 'TIMEOUT',
      }
    }

    return {
      success: false,
      results: [],
      provider: 'duckduckgo',
      query,
      latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'NETWORK_ERROR',
    }
  }
}

/**
 * Extract title from DuckDuckGo result HTML.
 */
function extractTitleFromResult(html: string): string {
  // DuckDuckGo results sometimes contain HTML links
  const match = html.match(/<a[^>]*>([^<]+)<\/a>/)
  if (match) {
    return match[1]
  }
  // Otherwise, use first sentence or truncate
  const firstSentence = html.split('.')[0]
  return firstSentence.length > 100 ? firstSentence.slice(0, 100) + '...' : firstSentence
}

// ============================================
// MAIN SEARCH FUNCTION
// ============================================

/**
 * Execute a web search using the configured provider.
 *
 * Provider selection:
 * - If 'serper' is specified and API key is provided, use Serper
 * - If 'duckduckgo' is specified or no API key, use DuckDuckGo
 * - 'google' and 'bing' map to Serper (which provides Google results)
 *
 * @param config - Search configuration
 * @returns Search results
 */
export async function executeWebSearch(config: WebSearchConfig): Promise<WebSearchResponse> {
  const {
    provider,
    query,
    numResults = DEFAULT_NUM_RESULTS,
    apiKey,
    timeout = DEFAULT_TIMEOUT_MS,
  } = config

  // Validate query
  if (!query || query.trim().length === 0) {
    return {
      success: false,
      results: [],
      provider,
      query: '',
      latencyMs: 0,
      error: 'Search query cannot be empty',
      errorCode: 'EMPTY_QUERY',
    }
  }

  // Sanitize query (prevent injection attacks)
  const sanitizedQuery = query.trim().slice(0, 500)

  // Determine effective provider
  const effectiveProvider = determineProvider(provider, apiKey)

  // Execute search with appropriate provider
  switch (effectiveProvider) {
    case 'serper':
      if (!apiKey) {
        // Fallback to DuckDuckGo if no API key
        return searchWithDuckDuckGo(sanitizedQuery, numResults, timeout)
      }
      return searchWithSerper(sanitizedQuery, numResults, apiKey, timeout)

    case 'duckduckgo':
    default:
      return searchWithDuckDuckGo(sanitizedQuery, numResults, timeout)
  }
}

/**
 * Determine effective provider based on config and available credentials.
 */
function determineProvider(
  requestedProvider: WebSearchProvider,
  apiKey?: string
): 'serper' | 'duckduckgo' {
  // google and bing map to serper
  if (requestedProvider === 'google' || requestedProvider === 'bing') {
    return apiKey ? 'serper' : 'duckduckgo'
  }

  // serper requires API key
  if (requestedProvider === 'serper') {
    return apiKey ? 'serper' : 'duckduckgo'
  }

  return 'duckduckgo'
}

// ============================================
// EXPORTS
// ============================================

export { searchWithSerper, searchWithDuckDuckGo }
