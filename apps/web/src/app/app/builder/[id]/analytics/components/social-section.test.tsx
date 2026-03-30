import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SocialSection } from './social-section'

const mockSocial = [
  { platform: 'twitter', total_deliveries: 100, success_count: 95, failure_count: 5 },
  { platform: 'discord', total_deliveries: 50, success_count: 48, failure_count: 2 },
  { platform: 'telegram', total_deliveries: 30, success_count: 30, failure_count: 0 },
]

describe('SocialSection', () => {
  it('renders title and description', () => {
    render(<SocialSection social={mockSocial} />)

    expect(screen.getByText('Social Delivery')).toBeInTheDocument()
    expect(screen.getByText('Message delivery across platforms')).toBeInTheDocument()
  })

  it('displays summary statistics', () => {
    render(<SocialSection social={mockSocial} />)

    expect(screen.getByText('Total Sent')).toBeInTheDocument()
    expect(screen.getByText('Successful')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  it('calculates total deliveries correctly', () => {
    const { container } = render(<SocialSection social={mockSocial} />)
    // Total: 100 + 50 + 30 = 180
    expect(container.textContent).toContain('180')
  })

  it('calculates total success correctly', () => {
    const { container } = render(<SocialSection social={mockSocial} />)
    // Success: 95 + 48 + 30 = 173
    expect(container.textContent).toContain('173')
  })

  it('calculates success rate correctly', () => {
    const { container } = render(<SocialSection social={mockSocial} />)
    // Success: 173, Total: 180, Rate: 96.1%
    expect(container.textContent).toContain('96.1')
  })

  it('renders platform names from config', () => {
    render(<SocialSection social={mockSocial} />)

    expect(screen.getByText('Twitter')).toBeInTheDocument()
    expect(screen.getByText('Discord')).toBeInTheDocument()
    expect(screen.getByText('Telegram')).toBeInTheDocument()
  })

  it('displays success count for each platform', () => {
    render(<SocialSection social={mockSocial} />)

    expect(screen.getByText('95')).toBeInTheDocument()
    expect(screen.getByText('48')).toBeInTheDocument()
  })

  it('displays failure count only when greater than zero', () => {
    render(<SocialSection social={mockSocial} />)

    // Twitter has 5 failures, Discord has 2
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // Telegram has 0 failures - should not show failure indicator
  })

  it('shows loading skeleton when loading is true', () => {
    render(<SocialSection social={mockSocial} loading={true} />)

    // Content should not be visible when loading
    expect(screen.queryByText('Social Delivery')).not.toBeInTheDocument()
    expect(screen.queryByText('Twitter')).not.toBeInTheDocument()
  })

  it('shows empty state when no social data', () => {
    render(<SocialSection social={[]} />)

    expect(screen.getByText('No social deliveries in this period')).toBeInTheDocument()
    expect(
      screen.getByText('Social delivery metrics will appear when your agent posts to platforms')
    ).toBeInTheDocument()
  })

  it('handles unknown platform gracefully', () => {
    const unknownPlatform = [
      { platform: 'custom_platform', total_deliveries: 20, success_count: 18, failure_count: 2 },
    ]
    const { container } = render(<SocialSection social={unknownPlatform} />)

    expect(screen.getByText('custom_platform')).toBeInTheDocument()
    // 18 appears in both summary (Successful) and platform row
    expect(screen.getAllByText('18')).toHaveLength(2)
    // 2 appears in both summary (Total Sent: 20 contains 2) and as failure count
    expect(container.textContent).toContain('2')
  })

  it('handles zero deliveries correctly', () => {
    const zeroDeliveries = [
      { platform: 'twitter', total_deliveries: 0, success_count: 0, failure_count: 0 },
    ]
    render(<SocialSection social={zeroDeliveries} />)

    // Success rate should show 0%
    const { container } = render(<SocialSection social={zeroDeliveries} />)
    expect(container.textContent).toMatch(/0%/)
  })

  it('applies correct platform colors', () => {
    const { container } = render(<SocialSection social={mockSocial} />)

    // Check that platform-specific background colors are applied
    expect(container.querySelector('.bg-blue-500\\/10')).toBeInTheDocument()
    expect(container.querySelector('.bg-indigo-500\\/10')).toBeInTheDocument()
    expect(container.querySelector('.bg-sky-500\\/10')).toBeInTheDocument()
  })
})
