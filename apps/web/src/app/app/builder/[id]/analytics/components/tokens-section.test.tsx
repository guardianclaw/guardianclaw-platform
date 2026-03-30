import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TokensSection } from './tokens-section'

const mockTokens = {
  input_tokens: 5000,
  output_tokens: 3000,
  total_tokens: 8000,
}

describe('TokensSection', () => {
  it('renders token values correctly', () => {
    render(<TokensSection tokens={mockTokens} />)

    expect(screen.getByText('Token Usage')).toBeInTheDocument()
    expect(screen.getByText('LLM token consumption')).toBeInTheDocument()
  })

  it('formats tokens with K suffix for thousands', () => {
    render(<TokensSection tokens={mockTokens} />)

    expect(screen.getByText('5.0K')).toBeInTheDocument()
    expect(screen.getByText('3.0K')).toBeInTheDocument()
    expect(screen.getByText('8.0K')).toBeInTheDocument()
  })

  it('formats tokens with M suffix for millions', () => {
    const millionTokens = {
      input_tokens: 1500000,
      output_tokens: 500000,
      total_tokens: 2000000,
    }
    render(<TokensSection tokens={millionTokens} />)

    expect(screen.getByText('1.50M')).toBeInTheDocument()
    expect(screen.getByText('500.0K')).toBeInTheDocument()
    expect(screen.getByText('2.00M')).toBeInTheDocument()
  })

  it('shows loading skeleton when loading is true', () => {
    render(<TokensSection tokens={mockTokens} loading={true} />)

    // Values should not be visible when loading
    expect(screen.queryByText('5.0K')).not.toBeInTheDocument()
    expect(screen.queryByText('Token Usage')).not.toBeInTheDocument()
  })

  it('calculates percentages correctly', () => {
    const { container } = render(<TokensSection tokens={mockTokens} />)

    // 5000/8000 = 62.5% -> rounds to 63%, 3000/8000 = 37.5% -> rounds to 38%
    expect(container.textContent).toContain('63')
    expect(container.textContent).toContain('38')
    expect(container.textContent).toContain('% of total')
  })

  it('handles zero tokens', () => {
    const zeroTokens = {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    }
    render(<TokensSection tokens={zeroTokens} />)

    expect(screen.getAllByText('0')).toHaveLength(3)
    // Percentages show 0% when total is 0
    expect(screen.getAllByText('0% of total')).toHaveLength(2)
  })

  it('displays labels for each token type', () => {
    render(<TokensSection tokens={mockTokens} />)

    expect(screen.getByText('Input')).toBeInTheDocument()
    expect(screen.getByText('Output')).toBeInTheDocument()
    expect(screen.getByText('Total')).toBeInTheDocument()
  })

  it('displays tokens used text for total', () => {
    render(<TokensSection tokens={mockTokens} />)
    expect(screen.getByText('tokens used')).toBeInTheDocument()
  })
})
