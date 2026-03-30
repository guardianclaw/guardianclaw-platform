import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToolsSection } from './tools-section'

const mockTools = [
  { tool_type: 'web_search', total_calls: 100, success_count: 95, avg_latency_ms: 250 },
  { tool_type: 'api_request', total_calls: 50, success_count: 48, avg_latency_ms: 150 },
  { tool_type: 'code_execution', total_calls: 25, success_count: 20, avg_latency_ms: 500 },
]

describe('ToolsSection', () => {
  it('renders title and description', () => {
    render(<ToolsSection tools={mockTools} />)

    expect(screen.getByText('Tool Usage')).toBeInTheDocument()
    expect(screen.getByText('Agent tool execution metrics')).toBeInTheDocument()
  })

  it('displays summary statistics', () => {
    render(<ToolsSection tools={mockTools} />)

    expect(screen.getByText('Total Calls')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
    expect(screen.getByText('Avg Latency')).toBeInTheDocument()
  })

  it('calculates total calls correctly', () => {
    const { container } = render(<ToolsSection tools={mockTools} />)
    // Total: 100 + 50 + 25 = 175
    expect(container.textContent).toContain('175')
  })

  it('calculates success rate correctly', () => {
    const { container } = render(<ToolsSection tools={mockTools} />)
    // Success: 95 + 48 + 20 = 163, Total: 175, Rate: 93.1%
    expect(container.textContent).toContain('93.1')
  })

  it('renders tool names from config', () => {
    render(<ToolsSection tools={mockTools} />)

    expect(screen.getByText('Web Search')).toBeInTheDocument()
    expect(screen.getByText('API Request')).toBeInTheDocument()
    expect(screen.getByText('Code Execution')).toBeInTheDocument()
  })

  it('displays calls count for each tool', () => {
    render(<ToolsSection tools={mockTools} />)

    expect(screen.getByText('100 calls')).toBeInTheDocument()
    expect(screen.getByText('50 calls')).toBeInTheDocument()
    expect(screen.getByText('25 calls')).toBeInTheDocument()
  })

  it('displays success rate per tool', () => {
    render(<ToolsSection tools={mockTools} />)

    // 95/100 = 95%, 48/50 = 96%, 20/25 = 80%
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('96%')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('formats latency correctly - milliseconds', () => {
    render(<ToolsSection tools={mockTools} />)

    expect(screen.getByText('250ms')).toBeInTheDocument()
    expect(screen.getByText('150ms')).toBeInTheDocument()
    expect(screen.getByText('500ms')).toBeInTheDocument()
  })

  it('formats latency correctly - seconds', () => {
    const slowTools = [
      { tool_type: 'web_search', total_calls: 10, success_count: 10, avg_latency_ms: 2500 },
    ]
    render(<ToolsSection tools={slowTools} />)

    // 2.5s appears in both summary (Avg Latency) and per-tool row
    expect(screen.getAllByText('2.5s')).toHaveLength(2)
  })

  it('shows loading skeleton when loading is true', () => {
    render(<ToolsSection tools={mockTools} loading={true} />)

    // Content should not be visible when loading
    expect(screen.queryByText('Tool Usage')).not.toBeInTheDocument()
    expect(screen.queryByText('Web Search')).not.toBeInTheDocument()
  })

  it('shows empty state when no tools', () => {
    render(<ToolsSection tools={[]} />)

    expect(screen.getByText('No tool calls in this period')).toBeInTheDocument()
    expect(
      screen.getByText('Tool usage metrics will appear when your agent uses tools')
    ).toBeInTheDocument()
  })

  it('handles unknown tool type gracefully', () => {
    const unknownTools = [
      { tool_type: 'custom_tool', total_calls: 30, success_count: 28, avg_latency_ms: 100 },
    ]
    render(<ToolsSection tools={unknownTools} />)

    expect(screen.getByText('custom_tool')).toBeInTheDocument()
    expect(screen.getByText('30 calls')).toBeInTheDocument()
  })

  it('handles zero calls correctly', () => {
    const zeroTools = [
      { tool_type: 'web_search', total_calls: 0, success_count: 0, avg_latency_ms: 0 },
    ]
    render(<ToolsSection tools={zeroTools} />)

    // 0% appears in both summary (Success Rate) and per-tool row
    expect(screen.getAllByText('0%')).toHaveLength(2)
    // 0ms appears in both summary (Avg Latency) and per-tool row
    expect(screen.getAllByText('0ms')).toHaveLength(2)
  })
})
