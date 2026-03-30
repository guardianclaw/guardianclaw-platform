/**
 * Web Search Service Tests
 *
 * Tests for web search functionality including:
 * - Serper.dev integration
 * - DuckDuckGo fallback
 * - Error handling
 * - Provider selection
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { executeWebSearch, searchWithSerper, searchWithDuckDuckGo } from './web-search'

// ============================================
// SERPER TESTS
// ============================================

describe('searchWithSerper', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns results on successful search', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          organic: [
            {
              title: 'Result 1',
              link: 'https://example.com/1',
              snippet: 'This is the first result',
              position: 1,
            },
            {
              title: 'Result 2',
              link: 'https://example.com/2',
              snippet: 'This is the second result',
              position: 2,
            },
          ],
        }),
        { status: 200 }
      )
    )

    const result = await searchWithSerper('test query', 5, 'test-api-key', 10000)

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(2)
    expect(result.results[0].title).toBe('Result 1')
    expect(result.results[0].link).toBe('https://example.com/1')
    expect(result.provider).toBe('serper')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('handles 401 unauthorized error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Invalid API key', { status: 401 })
    )

    const result = await searchWithSerper('test query', 5, 'invalid-key', 10000)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('INVALID_API_KEY')
    expect(result.results).toHaveLength(0)
  })

  it('handles 429 rate limit error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('Rate limited', { status: 429 })
    )

    const result = await searchWithSerper('test query', 5, 'test-key', 10000)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('RATE_LIMITED')
  })

  it('handles network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const result = await searchWithSerper('test query', 5, 'test-key', 10000)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NETWORK_ERROR')
  })

  it('handles timeout', async () => {
    const abortError = new Error('Aborted')
    abortError.name = 'AbortError'
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(abortError)

    const result = await searchWithSerper('test query', 5, 'test-key', 100)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('TIMEOUT')
  })

  it('respects numResults limit', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          organic: Array.from({ length: 20 }, (_, i) => ({
            title: `Result ${i + 1}`,
            link: `https://example.com/${i + 1}`,
            snippet: `Snippet ${i + 1}`,
            position: i + 1,
          })),
        }),
        { status: 200 }
      )
    )

    const result = await searchWithSerper('test query', 3, 'test-key', 10000)

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(3)
  })
})

// ============================================
// DUCKDUCKGO TESTS
// ============================================

describe('searchWithDuckDuckGo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns results from abstract', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          Heading: 'Test Topic',
          AbstractText: 'This is a comprehensive abstract about the topic.',
          AbstractURL: 'https://wikipedia.org/wiki/Test',
          AbstractSource: 'Wikipedia',
        }),
        { status: 200 }
      )
    )

    const result = await searchWithDuckDuckGo('test query', 5, 10000)

    expect(result.success).toBe(true)
    expect(result.results.length).toBeGreaterThan(0)
    expect(result.results[0].title).toBe('Test Topic')
    expect(result.results[0].link).toBe('https://wikipedia.org/wiki/Test')
    expect(result.provider).toBe('duckduckgo')
  })

  it('returns results from related topics', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          RelatedTopics: [
            {
              Text: 'Related topic 1 description',
              FirstURL: 'https://example.com/related1',
              Result:
                '<a href="https://example.com/related1">Related Topic 1</a>Related topic 1 description',
            },
            {
              Text: 'Related topic 2 description',
              FirstURL: 'https://example.com/related2',
              Result:
                '<a href="https://example.com/related2">Related Topic 2</a>Related topic 2 description',
            },
          ],
        }),
        { status: 200 }
      )
    )

    const result = await searchWithDuckDuckGo('test query', 5, 10000)

    expect(result.success).toBe(true)
    expect(result.results.length).toBe(2)
  })

  it('handles empty results', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({}), { status: 200 })
    )

    const result = await searchWithDuckDuckGo('obscure query', 5, 10000)

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(0)
  })

  it('handles network errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'))

    const result = await searchWithDuckDuckGo('test query', 5, 10000)

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('NETWORK_ERROR')
  })
})

// ============================================
// MAIN SEARCH FUNCTION TESTS
// ============================================

describe('executeWebSearch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses serper when provider and apiKey are provided', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          organic: [
            { title: 'Test', link: 'https://test.com', snippet: 'Test snippet', position: 1 },
          ],
        }),
        { status: 200 }
      )
    )

    const result = await executeWebSearch({
      provider: 'serper',
      query: 'test',
      apiKey: 'test-key',
    })

    expect(result.success).toBe(true)
    expect(result.provider).toBe('serper')
    expect(fetchSpy).toHaveBeenCalledWith(expect.stringContaining('serper.dev'), expect.any(Object))
  })

  it('falls back to duckduckgo when no apiKey', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ RelatedTopics: [] }), { status: 200 }))

    const result = await executeWebSearch({
      provider: 'serper',
      query: 'test',
      // No apiKey
    })

    expect(result.provider).toBe('duckduckgo')
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('duckduckgo.com'),
      expect.any(Object)
    )
  })

  it('uses duckduckgo when explicitly requested', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ RelatedTopics: [] }), { status: 200 })
    )

    const result = await executeWebSearch({
      provider: 'duckduckgo',
      query: 'test',
      apiKey: 'test-key', // Should be ignored
    })

    expect(result.provider).toBe('duckduckgo')
  })

  it('rejects empty query', async () => {
    const result = await executeWebSearch({
      provider: 'duckduckgo',
      query: '',
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('EMPTY_QUERY')
  })

  it('rejects whitespace-only query', async () => {
    const result = await executeWebSearch({
      provider: 'duckduckgo',
      query: '   ',
    })

    expect(result.success).toBe(false)
    expect(result.errorCode).toBe('EMPTY_QUERY')
  })

  it('truncates very long queries', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ RelatedTopics: [] }), { status: 200 }))

    const longQuery = 'a'.repeat(1000)
    await executeWebSearch({
      provider: 'duckduckgo',
      query: longQuery,
    })

    // Query should be truncated to 500 chars
    expect(fetchSpy).toHaveBeenCalled()
    const url = fetchSpy.mock.calls[0][0] as string
    const urlObj = new URL(url)
    const queryParam = urlObj.searchParams.get('q')
    expect(queryParam?.length).toBeLessThanOrEqual(500)
  })

  it('maps google provider to serper with apiKey', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ organic: [] }), { status: 200 })
    )

    const result = await executeWebSearch({
      provider: 'google',
      query: 'test',
      apiKey: 'test-key',
    })

    expect(result.provider).toBe('serper')
  })

  it('maps bing provider to serper with apiKey', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ organic: [] }), { status: 200 })
    )

    const result = await executeWebSearch({
      provider: 'bing',
      query: 'test',
      apiKey: 'test-key',
    })

    expect(result.provider).toBe('serper')
  })

  it('uses default timeout when not specified', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ RelatedTopics: [] }), { status: 200 })
    )

    const result = await executeWebSearch({
      provider: 'duckduckgo',
      query: 'test',
    })

    expect(result.success).toBe(true)
  })

  it('uses default numResults when not specified', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          organic: Array.from({ length: 10 }, (_, i) => ({
            title: `Result ${i}`,
            link: `https://example.com/${i}`,
            snippet: `Snippet ${i}`,
            position: i,
          })),
        }),
        { status: 200 }
      )
    )

    const result = await executeWebSearch({
      provider: 'serper',
      query: 'test',
      apiKey: 'test-key',
    })

    // Default is 5
    expect(result.results.length).toBeLessThanOrEqual(5)
  })
})

// ============================================
// RESULT FORMAT TESTS
// ============================================

describe('WebSearchResult format', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has correct structure', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          organic: [
            {
              title: 'Test Title',
              link: 'https://example.com/test',
              snippet: 'Test snippet text',
              position: 1,
            },
          ],
        }),
        { status: 200 }
      )
    )

    const result = await executeWebSearch({
      provider: 'serper',
      query: 'test',
      apiKey: 'test-key',
    })

    expect(result.results[0]).toMatchObject({
      title: expect.any(String),
      link: expect.any(String),
      snippet: expect.any(String),
      position: expect.any(Number),
    })
  })

  it('handles missing fields gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          organic: [
            {
              // Missing title and snippet
              link: 'https://example.com/test',
              position: 1,
            },
          ],
        }),
        { status: 200 }
      )
    )

    const result = await executeWebSearch({
      provider: 'serper',
      query: 'test',
      apiKey: 'test-key',
    })

    expect(result.success).toBe(true)
    expect(result.results[0].title).toBe('')
    expect(result.results[0].snippet).toBe('')
  })
})
