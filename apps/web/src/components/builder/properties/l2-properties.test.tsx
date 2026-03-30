import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { L2Properties } from './l2-properties'

describe('L2Properties', () => {
  const mockOnChange = vi.fn()

  const defaultData = {
    label: 'Seed Injection',
    layerType: 'seed_injection' as const,
  }

  beforeEach(() => {
    mockOnChange.mockClear()
  })

  it('renders L2 info banner', () => {
    render(<L2Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('L2: Seed Injection')).toBeInTheDocument()
    expect(screen.getByText(/Injects alignment prompt/)).toBeInTheDocument()
  })

  it('renders seed level selector', () => {
    render(<L2Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Seed Level')).toBeInTheDocument()
  })

  it('renders append mode toggle', () => {
    render(<L2Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Append Mode')).toBeInTheDocument()
    expect(screen.getByText(/Append seed to existing system prompt/)).toBeInTheDocument()
  })

  it('renders custom seed textarea', () => {
    render(<L2Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Custom Additions (Optional)')).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText(/Add domain-specific safety instructions/)
    ).toBeInTheDocument()
  })

  it('shows estimated seed size', () => {
    render(<L2Properties data={defaultData} onChange={mockOnChange} />)

    expect(screen.getByText('Estimated seed size:')).toBeInTheDocument()
    expect(screen.getByText('~2KB')).toBeInTheDocument()
  })

  it('updates custom seed on input', () => {
    render(<L2Properties data={defaultData} onChange={mockOnChange} />)

    const textarea = screen.getByPlaceholderText(/Add domain-specific safety instructions/)
    fireEvent.change(textarea, { target: { value: 'Custom safety rule' } })

    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        l2Config: expect.objectContaining({
          customSeed: 'Custom safety rule',
        }),
      })
    )
  })

  it('uses provided l2Config when available', () => {
    const dataWithConfig = {
      ...defaultData,
      l2Config: {
        seedLevel: 'full' as const,
        customSeed: 'My custom seed',
        appendMode: false,
      },
    }

    render(<L2Properties data={dataWithConfig} onChange={mockOnChange} />)

    expect(screen.getByText('~5KB + 14 chars')).toBeInTheDocument()
  })

  it('shows seed level descriptions', () => {
    render(<L2Properties data={defaultData} onChange={mockOnChange} />)

    // Standard is default, should show its details
    expect(screen.getByText(/Full CLAW protocol/)).toBeInTheDocument()
  })
})
