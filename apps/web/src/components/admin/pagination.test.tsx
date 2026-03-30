import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination } from './pagination'

describe('Pagination', () => {
  const defaultProps = {
    page: 1,
    limit: 20,
    total: 100,
    onPageChange: vi.fn(),
    onLimitChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page info correctly', () => {
    render(<Pagination {...defaultProps} />)

    expect(screen.getByText('Showing 1-20 of 100')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 5')).toBeInTheDocument()
  })

  it('calculates correct range for middle page', () => {
    render(<Pagination {...defaultProps} page={3} />)

    expect(screen.getByText('Showing 41-60 of 100')).toBeInTheDocument()
    expect(screen.getByText('Page 3 of 5')).toBeInTheDocument()
  })

  it('calculates correct range for last page', () => {
    render(<Pagination {...defaultProps} page={5} />)

    expect(screen.getByText('Showing 81-100 of 100')).toBeInTheDocument()
    expect(screen.getByText('Page 5 of 5')).toBeInTheDocument()
  })

  it('handles partial last page', () => {
    render(<Pagination {...defaultProps} total={95} page={5} />)

    expect(screen.getByText('Showing 81-95 of 95')).toBeInTheDocument()
  })

  it('disables previous buttons on first page', () => {
    render(<Pagination {...defaultProps} page={1} />)

    const buttons = screen.getAllByRole('button')
    // First two buttons should be disabled (first page, previous page)
    expect(buttons[0]).toBeDisabled()
    expect(buttons[1]).toBeDisabled()
    // Last two buttons should be enabled
    expect(buttons[2]).not.toBeDisabled()
    expect(buttons[3]).not.toBeDisabled()
  })

  it('disables next buttons on last page', () => {
    render(<Pagination {...defaultProps} page={5} />)

    const buttons = screen.getAllByRole('button')
    // First two buttons should be enabled
    expect(buttons[0]).not.toBeDisabled()
    expect(buttons[1]).not.toBeDisabled()
    // Last two buttons should be disabled
    expect(buttons[2]).toBeDisabled()
    expect(buttons[3]).toBeDisabled()
  })

  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} onPageChange={onPageChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2]) // Next page button

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange when clicking previous', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} onPageChange={onPageChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[1]) // Previous page button

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange when clicking first page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={3} onPageChange={onPageChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0]) // First page button

    expect(onPageChange).toHaveBeenCalledWith(1)
  })

  it('calls onPageChange when clicking last page', () => {
    const onPageChange = vi.fn()
    render(<Pagination {...defaultProps} page={2} onPageChange={onPageChange} />)

    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[3]) // Last page button

    expect(onPageChange).toHaveBeenCalledWith(5)
  })

  it('hides limit selector when showLimitSelector is false', () => {
    render(<Pagination {...defaultProps} showLimitSelector={false} />)

    // Select trigger should not be present
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('shows limit selector by default', () => {
    render(<Pagination {...defaultProps} />)

    // Select trigger should be present
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('handles single page correctly', () => {
    render(<Pagination {...defaultProps} total={10} />)

    expect(screen.getByText('Showing 1-10 of 10')).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()

    // All navigation buttons should be disabled
    const buttons = screen.getAllByRole('button')
    buttons.forEach((button) => {
      expect(button).toBeDisabled()
    })
  })

  it('formats total with locale string', () => {
    render(<Pagination {...defaultProps} total={1000000} />)

    // Match the number regardless of locale formatting (1,000,000 or 1.000.000)
    expect(screen.getByText(/1[.,]000[.,]000/)).toBeInTheDocument()
  })
})
