/**
 * Unit tests for ClawPay formatting helpers.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  formatUsd,
  formatDateTime,
  formatDateShort,
  formatRelative,
  truncateMiddle,
} from './format'

describe('formatUsd', () => {
  it('renders standard USD with two decimals', () => {
    expect(formatUsd(1234.5)).toBe('$1,234.50')
  })

  it('renders zero as $0.00', () => {
    expect(formatUsd(0)).toBe('$0.00')
  })

  it('uses high-precision formatting for sub-dollar amounts', () => {
    expect(formatUsd(0.000022)).toMatch(/0\.000022/)
  })

  it('renders em-dash for null/undefined/NaN', () => {
    expect(formatUsd(null)).toBe('—')
    expect(formatUsd(undefined)).toBe('—')
    expect(formatUsd(NaN)).toBe('—')
  })

  it('formats negative amounts', () => {
    expect(formatUsd(-100.25)).toMatch(/-\$100\.25/)
  })
})

describe('formatDateTime', () => {
  it('formats a valid ISO date', () => {
    const out = formatDateTime('2026-05-21T12:00:00Z')
    expect(out).toMatch(/2026/)
    expect(out).toMatch(/May/)
  })

  it('returns em-dash for null/undefined', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })

  it('returns the raw value for unparseable input', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('formatDateShort', () => {
  it('renders month + day only', () => {
    const out = formatDateShort('2026-05-21T00:00:00Z')
    expect(out).toMatch(/May/)
    expect(out).not.toMatch(/2026/)
  })
})

describe('truncateMiddle', () => {
  it('returns the raw value when shorter than head+tail+1', () => {
    expect(truncateMiddle('0xabcd', 6, 4)).toBe('0xabcd')
  })

  it('truncates with an ellipsis in the middle', () => {
    expect(truncateMiddle('0x1234567890abcdef', 6, 4)).toBe('0x1234…cdef')
  })

  it('returns em-dash for null/empty', () => {
    expect(truncateMiddle(null)).toBe('—')
    expect(truncateMiddle('')).toBe('—')
  })

  it('honors custom head/tail lengths', () => {
    expect(truncateMiddle('abcdefghij', 2, 2)).toBe('ab…ij')
  })
})

describe('formatRelative', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Xs ago" for recent timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:00:30Z'))
    expect(formatRelative('2026-05-21T12:00:00Z')).toBe('30s ago')
  })

  it('returns "Xm ago" within an hour', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T12:05:00Z'))
    expect(formatRelative('2026-05-21T12:00:00Z')).toBe('5m ago')
  })

  it('returns "Xh ago" within a day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-21T18:00:00Z'))
    expect(formatRelative('2026-05-21T12:00:00Z')).toBe('6h ago')
  })

  it('returns "Xd ago" within a month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-25T12:00:00Z'))
    expect(formatRelative('2026-05-21T12:00:00Z')).toBe('4d ago')
  })

  it('falls back to short date for older values', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const out = formatRelative('2026-05-21T00:00:00Z')
    expect(out).toMatch(/May/)
  })

  it('returns em-dash for null', () => {
    expect(formatRelative(null)).toBe('—')
  })
})
