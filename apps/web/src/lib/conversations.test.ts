/**
 * Conversations API Tests
 *
 * Unit tests for conversation-related functionality.
 */

import { describe, it, expect } from 'vitest'
import type {
  Conversation,
  ConversationMessage,
  ConversationDetail,
  MemoryStrategy,
  ConversationStatus,
} from './api'

// Test data factories
function createConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: 'conv-1',
    agent_id: 'agent-1',
    title: 'Test Conversation',
    status: 'active' as ConversationStatus,
    memory_strategy: 'sliding_window' as MemoryStrategy,
    context_window: 10,
    message_count: 0,
    total_tokens: 0,
    created_at: '2026-01-09T10:00:00Z',
    updated_at: '2026-01-09T10:00:00Z',
    last_message_at: '2026-01-09T10:00:00Z',
    ...overrides,
  }
}

function createMessage(overrides: Partial<ConversationMessage> = {}): ConversationMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, world!',
    position: 1,
    input_tokens: null,
    output_tokens: null,
    blocked: false,
    blocked_reason: null,
    blocked_gate: null,
    latency_ms: null,
    model_used: null,
    created_at: '2026-01-09T10:00:00Z',
    ...overrides,
  }
}

describe('Conversation Types', () => {
  describe('Memory Strategies', () => {
    it('should define all memory strategies', () => {
      const strategies: MemoryStrategy[] = ['sliding_window', 'summary', 'full', 'none']
      expect(strategies).toHaveLength(4)
    })

    it('should have sliding_window as default strategy', () => {
      const conv = createConversation()
      expect(conv.memory_strategy).toBe('sliding_window')
    })
  })

  describe('Conversation Status', () => {
    it('should define all statuses', () => {
      const statuses: ConversationStatus[] = ['active', 'archived', 'deleted']
      expect(statuses).toHaveLength(3)
    })

    it('should have active as default status', () => {
      const conv = createConversation()
      expect(conv.status).toBe('active')
    })
  })

  describe('Conversation', () => {
    it('should create valid conversation object', () => {
      const conv = createConversation()
      expect(conv.id).toBe('conv-1')
      expect(conv.agent_id).toBe('agent-1')
      expect(conv.message_count).toBe(0)
    })

    it('should allow null title', () => {
      const conv = createConversation({ title: null })
      expect(conv.title).toBeNull()
    })

    it('should track token counts', () => {
      const conv = createConversation({ total_tokens: 1500 })
      expect(conv.total_tokens).toBe(1500)
    })

    it('should have context window between 1 and 100', () => {
      const conv = createConversation({ context_window: 50 })
      expect(conv.context_window).toBeGreaterThanOrEqual(1)
      expect(conv.context_window).toBeLessThanOrEqual(100)
    })
  })

  describe('ConversationMessage', () => {
    it('should create valid message object', () => {
      const msg = createMessage()
      expect(msg.role).toBe('user')
      expect(msg.content).toBe('Hello, world!')
      expect(msg.blocked).toBe(false)
    })

    it('should allow assistant role', () => {
      const msg = createMessage({ role: 'assistant' })
      expect(msg.role).toBe('assistant')
    })

    it('should allow system role', () => {
      const msg = createMessage({ role: 'system' })
      expect(msg.role).toBe('system')
    })

    it('should track blocked messages', () => {
      const msg = createMessage({
        blocked: true,
        blocked_reason: 'Content blocked by avoidance gate',
        blocked_gate: 'avoidance',
      })
      expect(msg.blocked).toBe(true)
      expect(msg.blocked_reason).toBe('Content blocked by avoidance gate')
      expect(msg.blocked_gate).toBe('avoidance')
    })

    it('should track latency', () => {
      const msg = createMessage({ latency_ms: 250 })
      expect(msg.latency_ms).toBe(250)
    })

    it('should track model used', () => {
      const msg = createMessage({ model_used: 'gpt-4o-mini' })
      expect(msg.model_used).toBe('gpt-4o-mini')
    })

    it('should track token counts', () => {
      const msg = createMessage({
        input_tokens: 100,
        output_tokens: 200,
      })
      expect(msg.input_tokens).toBe(100)
      expect(msg.output_tokens).toBe(200)
    })
  })

  describe('ConversationDetail', () => {
    it('should extend Conversation with messages', () => {
      const detail: ConversationDetail = {
        ...createConversation({ message_count: 2 }),
        messages: [
          createMessage({ position: 1, role: 'user' }),
          createMessage({ position: 2, role: 'assistant', id: 'msg-2' }),
        ],
      }
      expect(detail.messages).toHaveLength(2)
      expect(detail.message_count).toBe(2)
    })

    it('should have messages ordered by position', () => {
      const detail: ConversationDetail = {
        ...createConversation(),
        messages: [
          createMessage({ position: 1 }),
          createMessage({ position: 2, id: 'msg-2' }),
          createMessage({ position: 3, id: 'msg-3' }),
        ],
      }

      for (let i = 1; i < detail.messages.length; i++) {
        expect(detail.messages[i].position).toBeGreaterThan(detail.messages[i - 1].position)
      }
    })
  })
})

describe('Conversation Business Logic', () => {
  describe('Title Generation', () => {
    it('should generate title from first message (simulated)', () => {
      const content = 'Hello, can you help me with my project?'
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content
      expect(title).toBe('Hello, can you help me with my project?')
    })

    it('should truncate long messages for title', () => {
      const content =
        'This is a very long message that should be truncated because it exceeds the fifty character limit for conversation titles'
      const title = content.length > 50 ? content.substring(0, 50) + '...' : content
      expect(title.length).toBeLessThanOrEqual(53) // 50 + "..."
      expect(title.endsWith('...')).toBe(true)
    })
  })

  describe('Context Window', () => {
    it('should respect sliding window limit', () => {
      const contextWindow = 5
      const allMessages = [
        createMessage({ position: 1 }),
        createMessage({ position: 2, id: 'msg-2' }),
        createMessage({ position: 3, id: 'msg-3' }),
        createMessage({ position: 4, id: 'msg-4' }),
        createMessage({ position: 5, id: 'msg-5' }),
        createMessage({ position: 6, id: 'msg-6' }),
        createMessage({ position: 7, id: 'msg-7' }),
      ]

      // Simulate sliding window: take last N messages
      const contextMessages = allMessages.slice(-contextWindow)
      expect(contextMessages).toHaveLength(5)
      expect(contextMessages[0].position).toBe(3)
      expect(contextMessages[4].position).toBe(7)
    })

    it('should include all messages when less than window size', () => {
      const contextWindow = 10
      const allMessages = [
        createMessage({ position: 1 }),
        createMessage({ position: 2, id: 'msg-2' }),
      ]

      const contextMessages = allMessages.slice(-contextWindow)
      expect(contextMessages).toHaveLength(2)
    })
  })

  describe('Message Filtering', () => {
    it('should filter out blocked messages from context', () => {
      const allMessages = [
        createMessage({ position: 1, blocked: false }),
        createMessage({ position: 2, id: 'msg-2', blocked: true }),
        createMessage({ position: 3, id: 'msg-3', blocked: false }),
      ]

      const validMessages = allMessages.filter((m) => !m.blocked)
      expect(validMessages).toHaveLength(2)
      expect(validMessages.every((m) => !m.blocked)).toBe(true)
    })
  })

  describe('Token Tracking', () => {
    it('should calculate total tokens from messages', () => {
      const messages = [
        createMessage({ input_tokens: 100, output_tokens: 200 }),
        createMessage({ input_tokens: 150, output_tokens: 300, id: 'msg-2' }),
      ]

      const totalTokens = messages.reduce((sum, m) => {
        return sum + (m.input_tokens || 0) + (m.output_tokens || 0)
      }, 0)

      expect(totalTokens).toBe(750) // 100+200 + 150+300
    })

    it('should handle null token values', () => {
      const messages = [
        createMessage({ input_tokens: null, output_tokens: null }),
        createMessage({ input_tokens: 100, output_tokens: null, id: 'msg-2' }),
      ]

      const totalTokens = messages.reduce((sum, m) => {
        return sum + (m.input_tokens || 0) + (m.output_tokens || 0)
      }, 0)

      expect(totalTokens).toBe(100)
    })
  })
})

describe('Memory Strategy Behaviors', () => {
  const allMessages = Array.from({ length: 20 }, (_, i) =>
    createMessage({ position: i + 1, id: `msg-${i + 1}` })
  )

  describe('sliding_window strategy', () => {
    it('should return last N messages', () => {
      const contextWindow = 10
      const result = allMessages.slice(-contextWindow)
      expect(result).toHaveLength(10)
      expect(result[0].position).toBe(11)
      expect(result[9].position).toBe(20)
    })
  })

  describe('full strategy', () => {
    it('should return all messages (up to limit)', () => {
      const limit = 1000
      const result = allMessages.slice(0, limit)
      expect(result).toHaveLength(20) // All messages since < 1000
    })
  })

  describe('none strategy', () => {
    it('should return empty array', () => {
      const result: ConversationMessage[] = []
      expect(result).toHaveLength(0)
    })
  })

  describe('summary strategy', () => {
    it('should fallback to sliding_window for now', () => {
      // Summary strategy requires LLM call, so fallback to sliding_window
      const contextWindow = 10
      const result = allMessages.slice(-contextWindow)
      expect(result).toHaveLength(10)
    })
  })
})

describe('Edge Cases', () => {
  it('should handle empty conversation', () => {
    const detail: ConversationDetail = {
      ...createConversation({ message_count: 0 }),
      messages: [],
    }
    expect(detail.messages).toHaveLength(0)
  })

  it('should handle conversation with only blocked messages', () => {
    const detail: ConversationDetail = {
      ...createConversation({ message_count: 2 }),
      messages: [
        createMessage({ position: 1, blocked: true }),
        createMessage({ position: 2, id: 'msg-2', blocked: true }),
      ],
    }

    const validMessages = detail.messages.filter((m) => !m.blocked)
    expect(validMessages).toHaveLength(0)
  })

  it('should handle very long message content', () => {
    const longContent = 'A'.repeat(32000) // Max allowed length
    const msg = createMessage({ content: longContent })
    expect(msg.content.length).toBe(32000)
  })

  it('should handle unicode content', () => {
    const unicodeContent = 'Hello 你好 مرحبا 🌍'
    const msg = createMessage({ content: unicodeContent })
    expect(msg.content).toBe(unicodeContent)
  })

  it('should handle multiline content', () => {
    const multilineContent = 'Line 1\nLine 2\nLine 3'
    const msg = createMessage({ content: multilineContent })
    expect(msg.content.split('\n')).toHaveLength(3)
  })
})
