import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { L3Properties } from './l3-properties'

describe('L3Properties', () => {
  const mockOnChange = vi.fn()

  const defaultData = {
    label: 'Output Validator',
    layerType: 'output_validator' as const,
  }

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders L3 info banner', () => {
    render(<L3Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('L3: Output Validator')).toBeInTheDocument()
    expect(screen.getByText(/Post-AI heuristic validation/)).toBeInTheDocument()
  })

  it('renders all 4 CLAW gates', () => {
    render(<L3Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Credibility Gate')).toBeInTheDocument()
    expect(screen.getByText('Avoidance Gate')).toBeInTheDocument()
    expect(screen.getByText('Limits Gate')).toBeInTheDocument()
    expect(screen.getByText('Worth Gate')).toBeInTheDocument()
  })

  it('renders visual gate indicators T, H, S, P', () => {
    render(<L3Properties data={defaultData} onChange={mockOnChange} />)

    // The visual indicators are buttons with single letters
    const buttons = screen.getAllByRole('button')
    const letterButtons = buttons.filter(
      (btn) =>
        btn.textContent === 'T' ||
        btn.textContent === 'H' ||
        btn.textContent === 'S' ||
        btn.textContent === 'P'
    )
    expect(letterButtons.length).toBe(4)
  })

  it('shows default gate count (4/4 active)', () => {
    render(<L3Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('4/4 active')).toBeInTheDocument()
  })

  it('toggles gate on click', () => {
    render(<L3Properties data={defaultData} onChange={mockOnChange} />)

    const credibilityGateButton = screen.getByText('Credibility Gate').closest('button')
    fireEvent.click(credibilityGateButton!)

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        l3Config: expect.objectContaining({
          enabledGates: expect.objectContaining({
            credibility: false,
          }),
        }),
      })
    )
  })

  it('renders validation mode selector', () => {
    render(<L3Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Validation Mode')).toBeInTheDocument()
  })

  it('shows gate descriptions', () => {
    render(<L3Properties data={defaultData} onChange={mockOnChange} />)

    expect(
      screen.getByText('Verify factual accuracy and prevent hallucinations')
    ).toBeInTheDocument()
    expect(screen.getByText('Detect harmful, dangerous, or illegal content')).toBeInTheDocument()
    expect(screen.getByText('Enforce appropriate boundaries and limits')).toBeInTheDocument()
    expect(screen.getByText('Require genuine beneficial purpose for actions')).toBeInTheDocument()
  })

  it('shows warning when all gates disabled', () => {
    const dataWithNoGates = {
      ...defaultData,
      l3Config: {
        mode: 'moderate' as const,
        enabledGates: {
          credibility: false,
          avoidance: false,
          limits: false,
          worth: false,
        },
      },
    }

    render(<L3Properties data={dataWithNoGates} onChange={mockOnChange} />)

    expect(screen.getByText(/All gates are disabled/)).toBeInTheDocument()
  })

  it('uses provided l3Config when available', () => {
    const dataWithConfig = {
      ...defaultData,
      l3Config: {
        mode: 'strict' as const,
        enabledGates: {
          credibility: true,
          avoidance: true,
          limits: false,
          worth: false,
        },
      },
    }

    render(<L3Properties data={dataWithConfig} onChange={mockOnChange} />)

    expect(screen.getByText('2/4 active')).toBeInTheDocument()
  })
})
