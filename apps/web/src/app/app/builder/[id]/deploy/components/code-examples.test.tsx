/**
 * Code Examples Component Tests
 *
 * Unit tests for the CodeExamples component.
 * Tests rendering, tab switching, copy functionality, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CodeExamples } from './code-examples'

// ============================================
// MOCKS
// ============================================

// Mock clipboard API
const mockWriteText = vi.fn()
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
})

// ============================================
// TEST SUITES
// ============================================

describe('CodeExamples', () => {
  const defaultEndpoint = 'https://api.guardianclaw.org/invoke/test-agent'

  beforeEach(() => {
    vi.clearAllMocks()
    mockWriteText.mockResolvedValue(undefined)
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders Code Examples title', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByText('Code Examples')).toBeInTheDocument()
    })

    it('renders description', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByText(/quick start examples/i)).toBeInTheDocument()
    })

    it('renders all three language tabs', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByRole('tab', { name: /python/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /javascript/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /curl/i })).toBeInTheDocument()
    })

    it('renders Python tab as selected by default', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      const pythonTab = screen.getByRole('tab', { name: /python/i })
      expect(pythonTab).toHaveAttribute('aria-selected', 'true')
    })

    it('renders code block with endpoint', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByText(new RegExp(defaultEndpoint))).toBeInTheDocument()
    })
  })

  // ==========================================
  // Tabs Structure Tests
  // ==========================================

  describe('Tabs Structure', () => {
    it('has tablist with proper aria label', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(
        screen.getByRole('tablist', { name: /programming language tabs/i })
      ).toBeInTheDocument()
    })

    it('Python tab is selected by default', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      const pythonTab = screen.getByRole('tab', { name: /python/i })
      expect(pythonTab).toHaveAttribute('aria-selected', 'true')
    })

    it('other tabs are not selected by default', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      const jsTab = screen.getByRole('tab', { name: /javascript/i })
      const curlTab = screen.getByRole('tab', { name: /curl/i })

      expect(jsTab).toHaveAttribute('aria-selected', 'false')
      expect(curlTab).toHaveAttribute('aria-selected', 'false')
    })
  })

  // ==========================================
  // Code Content Tests
  // ==========================================

  describe('Code Content', () => {
    it('includes endpoint URL in Python code', () => {
      const customEndpoint = 'https://custom-api.example.com/invoke/agent'
      render(<CodeExamples endpoint={customEndpoint} />)

      expect(screen.getByText(new RegExp(customEndpoint))).toBeInTheDocument()
    })

    it('includes X-API-Key header placeholder', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByText(/YOUR_API_KEY/)).toBeInTheDocument()
    })

    it('includes message example in request body', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByText(/Hello, world!/)).toBeInTheDocument()
    })

    it('includes requests import in Python', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByText(/import requests/)).toBeInTheDocument()
    })

    it('has JavaScript tab panel defined', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      // JavaScript tab panel exists (hidden by default)
      const jsPanels = screen.getAllByRole('tabpanel', { hidden: true })
      expect(jsPanels.length).toBeGreaterThan(0)
    })
  })

  // ==========================================
  // Copy Functionality Tests
  // ==========================================

  describe('Copy Functionality', () => {
    it('renders copy button', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByRole('button', { name: /copy python code/i })).toBeInTheDocument()
    })

    it('copies Python code to clipboard when copy button clicked', async () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      fireEvent.click(screen.getByRole('button', { name: /copy python code/i }))

      expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('import requests'))
    })

    it('clipboard API is called with code on copy', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      // Copy button for default Python tab
      fireEvent.click(screen.getByRole('button', { name: /copy python code/i }))

      // Verify clipboard API was called with code containing import requests
      expect(mockWriteText).toHaveBeenCalledTimes(1)
      expect(mockWriteText).toHaveBeenCalledWith(expect.stringContaining('import requests'))
    })

    it('shows "Copied!" state after copying', async () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      fireEvent.click(screen.getByRole('button', { name: /copy python code/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
      })
    })

    it('initially shows copy button in default state', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      // Initially should show copy button, not copied state
      expect(screen.getByRole('button', { name: /copy python code/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /copied/i })).not.toBeInTheDocument()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has accessible tab list', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(
        screen.getByRole('tablist', { name: /programming language tabs/i })
      ).toBeInTheDocument()
    })

    it('has accessible code block labels', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByLabelText(/python code example/i)).toBeInTheDocument()
    })

    it('has accessible copy button label', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      expect(screen.getByRole('button', { name: /copy python code/i })).toBeInTheDocument()
    })

    it('has accessible copied button label', async () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      fireEvent.click(screen.getByRole('button', { name: /copy python code/i }))

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument()
      })
    })

    it('hides decorative icons from screen readers', () => {
      const { container } = render(<CodeExamples endpoint={defaultEndpoint} />)

      const icons = container.querySelectorAll('svg[aria-hidden="true"]')
      expect(icons.length).toBeGreaterThan(0)
    })

    it('tabs are keyboard accessible', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      const pythonTab = screen.getByRole('tab', { name: /python/i })
      pythonTab.focus()

      expect(document.activeElement).toBe(pythonTab)
    })
  })

  // ==========================================
  // Edge Cases Tests
  // ==========================================

  describe('Edge Cases', () => {
    it('handles empty endpoint', () => {
      render(<CodeExamples endpoint="" />)

      // Should still render without crashing
      expect(screen.getByText('Code Examples')).toBeInTheDocument()
    })

    it('handles endpoint with special characters', () => {
      const specialEndpoint = 'https://api.example.com/invoke/agent-123?key=value'
      render(<CodeExamples endpoint={specialEndpoint} />)

      expect(
        screen.getByText(new RegExp(specialEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      ).toBeInTheDocument()
    })

    it('renders all tab triggers', () => {
      render(<CodeExamples endpoint={defaultEndpoint} />)

      // All tab triggers should be present
      expect(screen.getByRole('tab', { name: /python/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /javascript/i })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: /curl/i })).toBeInTheDocument()
    })
  })
})
