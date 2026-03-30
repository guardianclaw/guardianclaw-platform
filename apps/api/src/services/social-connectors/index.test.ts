/**
 * Social Connectors Service Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAdapter,
  getSupportedPlatforms,
  toolTypeToPlatform,
  platformToToolType,
  testSocialCredential,
} from './index'

describe('Social Connectors Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAdapter', () => {
    it('returns twitter adapter', () => {
      const adapter = getAdapter('twitter')
      expect(adapter).toBeDefined()
      expect(adapter?.platform).toBe('twitter')
    })

    it('returns discord adapter', () => {
      const adapter = getAdapter('discord')
      expect(adapter).toBeDefined()
      expect(adapter?.platform).toBe('discord')
    })

    it('returns telegram adapter', () => {
      const adapter = getAdapter('telegram')
      expect(adapter).toBeDefined()
      expect(adapter?.platform).toBe('telegram')
    })

    it('returns undefined for unknown platform', () => {
      // @ts-expect-error Testing invalid input
      const adapter = getAdapter('unknown')
      expect(adapter).toBeUndefined()
    })
  })

  describe('getSupportedPlatforms', () => {
    it('returns all supported platforms', () => {
      const platforms = getSupportedPlatforms()
      expect(platforms).toContain('twitter')
      expect(platforms).toContain('discord')
      expect(platforms).toContain('telegram')
      expect(platforms.length).toBe(3)
    })
  })

  describe('toolTypeToPlatform', () => {
    it('maps twitter_api to twitter', () => {
      expect(toolTypeToPlatform('twitter_api')).toBe('twitter')
    })

    it('maps discord_bot to discord', () => {
      expect(toolTypeToPlatform('discord_bot')).toBe('discord')
    })

    it('maps telegram_bot to telegram', () => {
      expect(toolTypeToPlatform('telegram_bot')).toBe('telegram')
    })

    it('returns null for unknown tool type', () => {
      expect(toolTypeToPlatform('unknown')).toBeNull()
    })

    it('returns null for non-social tool types', () => {
      expect(toolTypeToPlatform('serper')).toBeNull()
      expect(toolTypeToPlatform('openai')).toBeNull()
    })
  })

  describe('platformToToolType', () => {
    it('maps twitter to twitter_api', () => {
      expect(platformToToolType('twitter')).toBe('twitter_api')
    })

    it('maps discord to discord_bot', () => {
      expect(platformToToolType('discord')).toBe('discord_bot')
    })

    it('maps telegram to telegram_bot', () => {
      expect(platformToToolType('telegram')).toBe('telegram_bot')
    })
  })

  describe('testSocialCredential', () => {
    it('returns error for unsupported platform', async () => {
      // @ts-expect-error Testing invalid input
      const result = await testSocialCredential('unknown', 'token123')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('Unsupported platform')
    })
  })
})

describe('Twitter Adapter', () => {
  const adapter = getAdapter('twitter')!

  it('has correct platform', () => {
    expect(adapter.platform).toBe('twitter')
  })

  it('has deliver method', () => {
    expect(typeof adapter.deliver).toBe('function')
  })

  it('has testCredential method', () => {
    expect(typeof adapter.testCredential).toBe('function')
  })
})

describe('Discord Adapter', () => {
  const adapter = getAdapter('discord')!

  it('has correct platform', () => {
    expect(adapter.platform).toBe('discord')
  })

  it('has deliver method', () => {
    expect(typeof adapter.deliver).toBe('function')
  })

  it('has testCredential method', () => {
    expect(typeof adapter.testCredential).toBe('function')
  })
})

describe('Telegram Adapter', () => {
  const adapter = getAdapter('telegram')!

  it('has correct platform', () => {
    expect(adapter.platform).toBe('telegram')
  })

  it('has deliver method', () => {
    expect(typeof adapter.deliver).toBe('function')
  })

  it('has testCredential method', () => {
    expect(typeof adapter.testCredential).toBe('function')
  })
})
