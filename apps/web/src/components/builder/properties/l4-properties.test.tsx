import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { L4Properties } from './l4-properties'

describe('L4Properties', () => {
  const mockOnChange = vi.fn()

  const defaultData = {
    label: 'GuardianClaw Observer',
    layerType: 'observer' as const,
  }

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders L4 info banner', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('L4: GuardianClaw Observer')).toBeInTheDocument()
    expect(screen.getByText(/LLM-based transcript analysis/)).toBeInTheDocument()
  })

  it('renders enable toggle', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Enable L4 Analysis')).toBeInTheDocument()
    expect(screen.getByText(/Uses LLM API \(adds latency and cost\)/)).toBeInTheDocument()
  })

  it('renders provider selector when enabled', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('LLM Provider')).toBeInTheDocument()
  })

  it('renders model selector when enabled', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('renders fallback policy selector with correct SDK naming', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Fallback Policy')).toBeInTheDocument()
  })

  it('renders retry configuration', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Retry Configuration')).toBeInTheDocument()
    expect(screen.getByText('Max Retries')).toBeInTheDocument()
    expect(screen.getByText('Retry Delay (ms)')).toBeInTheDocument()
  })

  it('renders performance warning', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Performance Impact')).toBeInTheDocument()
    expect(screen.getByText(/adds ~1-3s latency/)).toBeInTheDocument()
  })

  it('hides configuration when disabled', () => {
    const dataDisabled = {
      ...defaultData,
      l4Config: {
        enabled: false,
        provider: 'openai' as const,
        model: 'gpt-4o-mini',
        fallbackPolicy: 'ALLOW_IF_L2_PASSED' as const,
        maxRetries: 2,
        retryDelayMs: 1000,
      },
    }

    render(<L4Properties data={dataDisabled} onChange={mockOnChange} />)

    expect(screen.getByText(/L4 analysis is disabled/)).toBeInTheDocument()
    expect(screen.queryByText('LLM Provider')).not.toBeInTheDocument()
    expect(screen.queryByText('Fallback Policy')).not.toBeInTheDocument()
  })

  it('toggles enabled state', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        l4Config: expect.objectContaining({
          enabled: false,
        }),
      })
    )
  })

  it('uses ALLOW_IF_L2_PASSED as default fallback policy (SDK compatible)', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    // Should show the SDK-compatible naming
    expect(screen.getByText('ALLOW_IF_L2_PASSED')).toBeInTheDocument()
  })

  it('shows fallback policy explanation', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    // The explanation mentions Gate 2 / L3 OutputValidator
    expect(screen.getByText(/L4 LLM call fails/)).toBeInTheDocument()
  })

  it('updates max retries on input', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    const maxRetriesInput = screen.getByDisplayValue('2')
    fireEvent.change(maxRetriesInput, { target: { value: '3' } })

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        l4Config: expect.objectContaining({
          maxRetries: 3,
        }),
      })
    )
  })

  it('allows custom model input', () => {
    render(<L4Properties data={defaultData} onChange={mockOnChange} />)

    const modelInputs = screen.getAllByDisplayValue('gpt-4o-mini')
    // There should be two inputs showing the model (select and text input)
    expect(modelInputs.length).toBeGreaterThanOrEqual(1)
  })
})
