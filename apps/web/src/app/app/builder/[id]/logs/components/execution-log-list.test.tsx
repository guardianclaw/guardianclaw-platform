/**
 * Execution Log List Component Tests
 *
 * Unit tests for the ExecutionLogList component.
 * Tests log rendering, status display, and interactions.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ExecutionLogList } from './execution-log-list'
import type { ExecutionLogEntry } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockLog(overrides: Partial<ExecutionLogEntry> = {}): ExecutionLogEntry {
  return {
    id: 'log-' + Math.random().toString(36).substr(2, 9),
    event_source: 'invoke',
    conversation_id: null,
    status: 'success',
    input_preview: 'Test input message',
    output_preview: 'Test output response',
    latency_ms: 150,
    input_tokens: 50,
    output_tokens: 100,
    blocked_by_layer: null,
    blocked_gate: null,
    blocked_reason: null,
    trace: [],
    tools_executed: 0,
    tools_succeeded: 0,
    social_deliveries: 0,
    social_succeeded: 0,
    model: 'gpt-4o-mini',
    request_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('ExecutionLogList', () => {
  const mockOnSelect = vi.fn()
  const mockOnCopyId = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders empty state when no logs', () => {
      const { container } = render(
        <ExecutionLogList logs={[]} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />
      )
      expect(container.firstChild).toBeEmptyDOMElement()
    })

    it('renders list of logs', () => {
      const logs = [createMockLog(), createMockLog(), createMockLog()]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      // Should render 3 log items
      expect(screen.getAllByText(/Input:/)).toHaveLength(3)
    })

    it('displays input preview', () => {
      const logs = [createMockLog({ input_preview: 'Custom input text' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Custom input text')).toBeInTheDocument()
    })

    it('displays output preview for successful executions', () => {
      const logs = [createMockLog({ output_preview: 'Custom output text' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Custom output text')).toBeInTheDocument()
    })

    it('displays blocked reason instead of output for blocked executions', () => {
      const logs = [
        createMockLog({
          status: 'blocked',
          output_preview: null,
          blocked_reason: 'Content flagged as harmful',
        }),
      ]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Content flagged as harmful')).toBeInTheDocument()
      expect(screen.queryByText(/Output:/)).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Status Display Tests
  // ==========================================

  describe('Status Display', () => {
    it('shows success status styling', () => {
      const logs = [createMockLog({ status: 'success' })]
      const { container } = render(
        <ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />
      )

      expect(container.querySelector('[class*="green"]')).toBeInTheDocument()
    })

    it('shows blocked status styling', () => {
      const logs = [createMockLog({ status: 'blocked' })]
      const { container } = render(
        <ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />
      )

      expect(container.querySelector('[class*="amber"]')).toBeInTheDocument()
    })

    it('shows error status styling', () => {
      const logs = [createMockLog({ status: 'error' })]
      const { container } = render(
        <ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />
      )

      expect(container.querySelector('[class*="red"]')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Event Source Badge Tests
  // ==========================================

  describe('Event Source Badges', () => {
    it('displays API badge for invoke source', () => {
      const logs = [createMockLog({ event_source: 'invoke' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('API')).toBeInTheDocument()
    })

    it('displays Chat badge for conversation source', () => {
      const logs = [createMockLog({ event_source: 'conversation' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Chat')).toBeInTheDocument()
    })

    it('displays Webhook badge for webhook source', () => {
      const logs = [createMockLog({ event_source: 'webhook' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Webhook')).toBeInTheDocument()
    })

    it('displays Test badge for test source', () => {
      const logs = [createMockLog({ event_source: 'test' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Test')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Blocked Layer Badge Tests
  // ==========================================

  describe('Blocked Layer Badges', () => {
    it('displays blocked layer badge when blocked', () => {
      const logs = [
        createMockLog({
          status: 'blocked',
          blocked_by_layer: 'L1',
          blocked_gate: 'avoidance',
        }),
      ]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('L1 - avoidance')).toBeInTheDocument()
    })

    it('does not display blocked badge for successful executions', () => {
      const logs = [createMockLog({ status: 'success' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.queryByText(/L1/)).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Metadata Display Tests
  // ==========================================

  describe('Metadata Display', () => {
    it('displays latency', () => {
      const logs = [createMockLog({ latency_ms: 250 })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('250ms')).toBeInTheDocument()
    })

    it('displays model name', () => {
      const logs = [createMockLog({ model: 'claude-3-sonnet' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Model: claude-3-sonnet')).toBeInTheDocument()
    })

    it('displays tool execution count', () => {
      const logs = [createMockLog({ tools_executed: 3, tools_succeeded: 2 })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('Tools: 2/3')).toBeInTheDocument()
    })

    it('hides tool count when no tools executed', () => {
      const logs = [createMockLog({ tools_executed: 0, tools_succeeded: 0 })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.queryByText(/Tools:/)).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Selection Tests
  // ==========================================

  describe('Selection', () => {
    it('calls onSelect when log is clicked', () => {
      const logs = [createMockLog()]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      const logItem = screen.getByText(/Input:/).closest('[class*="cursor-pointer"]')
      fireEvent.click(logItem!)

      expect(mockOnSelect).toHaveBeenCalledWith(logs[0])
    })

    it('applies selected styling when selectedId matches', () => {
      const logs = [createMockLog({ id: 'selected-log' })]
      const { container } = render(
        <ExecutionLogList
          logs={logs}
          selectedId="selected-log"
          onSelect={mockOnSelect}
          onCopyId={mockOnCopyId}
        />
      )

      expect(container.querySelector('[class*="border-primary"]')).toBeInTheDocument()
    })

    it('does not apply selected styling when selectedId does not match', () => {
      const logs = [createMockLog({ id: 'log-1' })]
      const { container } = render(
        <ExecutionLogList
          logs={logs}
          selectedId="different-log"
          onSelect={mockOnSelect}
          onCopyId={mockOnCopyId}
        />
      )

      expect(container.querySelector('[class*="border-primary"]')).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Copy ID Tests
  // ==========================================

  describe('Copy ID', () => {
    it('calls onCopyId when copy button is clicked', () => {
      const logs = [createMockLog({ id: 'test-log-id' })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      const copyButton = screen.getByTitle('Copy execution ID')
      fireEvent.click(copyButton)

      expect(mockOnCopyId).toHaveBeenCalledWith('test-log-id')
    })

    it('does not trigger onSelect when copy button is clicked', () => {
      const logs = [createMockLog()]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      const copyButton = screen.getByTitle('Copy execution ID')
      fireEvent.click(copyButton)

      expect(mockOnCopyId).toHaveBeenCalled()
      expect(mockOnSelect).not.toHaveBeenCalled()
    })
  })

  // ==========================================
  // Timestamp Display Tests
  // ==========================================

  describe('Timestamp Display', () => {
    it('displays "just now" for very recent timestamps', () => {
      const logs = [createMockLog({ created_at: new Date().toISOString() })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('just now')).toBeInTheDocument()
    })

    it('displays minutes ago for recent timestamps', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const logs = [createMockLog({ created_at: fiveMinutesAgo })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })

    it('displays hours ago for older timestamps', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      const logs = [createMockLog({ created_at: threeHoursAgo })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('3h ago')).toBeInTheDocument()
    })

    it('displays days ago for old timestamps', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      const logs = [createMockLog({ created_at: twoDaysAgo })]
      render(<ExecutionLogList logs={logs} onSelect={mockOnSelect} onCopyId={mockOnCopyId} />)

      expect(screen.getByText('2d ago')).toBeInTheDocument()
    })
  })
})
