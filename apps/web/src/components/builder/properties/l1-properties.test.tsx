import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { L1Properties } from './l1-properties'

// Mock ResizeObserver for components that use it (Slider, Select)
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

describe('L1Properties', () => {
  const mockOnChange = vi.fn()

  const defaultData = {
    label: 'Input Validator',
    layerType: 'input_validator' as const,
  }

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders L1 info banner', () => {
    render(<L1Properties data={defaultData} onChange={mockOnChange} />)

    // The banner shows "L1: Input Validator" in the paragraph
    expect(screen.getByText(/Input Validator/)).toBeInTheDocument()
    expect(screen.getByText(/Pre-AI detection/)).toBeInTheDocument()
  })

  it('renders all 8 detectors', () => {
    render(<L1Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Pattern Detector')).toBeInTheDocument()
    expect(screen.getByText('Escalation Detector')).toBeInTheDocument()
    expect(screen.getByText('Framing Detector')).toBeInTheDocument()
    expect(screen.getByText('Harmful Request')).toBeInTheDocument()
    expect(screen.getByText('Intent Signal')).toBeInTheDocument()
    expect(screen.getByText('Safe Agent')).toBeInTheDocument()
    expect(screen.getByText('Embedding Detector')).toBeInTheDocument()
    expect(screen.getByText('Benign Context')).toBeInTheDocument()
  })

  it('shows default detector count', () => {
    render(<L1Properties data={defaultData} onChange={mockOnChange} />)

    // Default: pattern, escalation, framing, harmful_request, benign_context = 5 active
    expect(screen.getByText('5/8 active')).toBeInTheDocument()
  })

  it('toggles detector on click', () => {
    render(<L1Properties data={defaultData} onChange={mockOnChange} />)

    const intentSignalButton = screen.getByText('Intent Signal').closest('button')
    fireEvent.click(intentSignalButton!)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        l1Config: expect.objectContaining({
          enabledDetectors: expect.objectContaining({
            intent_signal: true,
          }),
        }),
      })
    )
  })

  it('renders mode selector with moderate as default', () => {
    render(<L1Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Detection Mode')).toBeInTheDocument()
  })

  it('renders threshold slider', () => {
    render(<L1Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Detection Threshold')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('uses provided l1Config when available', () => {
    const dataWithConfig = {
      ...defaultData,
      l1Config: {
        mode: 'strict' as const,
        enabledDetectors: {
          pattern: true,
          escalation: false,
          framing: false,
          harmful_request: false,
          intent_signal: false,
          safe_agent: false,
          embedding: false,
          benign_context: false,
        },
        threshold: 90,
      },
    }

    render(<L1Properties data={dataWithConfig} onChange={mockOnChange} />)

    expect(screen.getByText('1/8 active')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
  })

  it('shows correct descriptions for detectors', () => {
    render(<L1Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('700+ attack patterns')).toBeInTheDocument()
    expect(screen.getByText('Multi-turn attacks (Crescendo, MHJ)')).toBeInTheDocument()
    expect(screen.getByText('Roleplay/fiction bypass attempts')).toBeInTheDocument()
    expect(screen.getByText('False positive reduction for legitimate contexts')).toBeInTheDocument()
  })
})
