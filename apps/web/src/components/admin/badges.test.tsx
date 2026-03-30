import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  PlanBadge,
  SeverityBadge,
  AlertStatusBadge,
  EntityStatusBadge,
  RiskLevelBadge,
  AdminRoleBadge,
  HealthStatusBadge,
  TrendIndicator,
} from './badges'

describe('PlanBadge', () => {
  it('renders free plan correctly', () => {
    render(<PlanBadge plan="free" />)
    expect(screen.getByText('free')).toBeInTheDocument()
  })

  it('renders starter plan correctly', () => {
    render(<PlanBadge plan="starter" />)
    expect(screen.getByText('starter')).toBeInTheDocument()
  })

  it('renders pro plan correctly', () => {
    render(<PlanBadge plan="pro" />)
    expect(screen.getByText('pro')).toBeInTheDocument()
  })

  it('handles unknown plan gracefully', () => {
    render(<PlanBadge plan="enterprise" />)
    expect(screen.getByText('enterprise')).toBeInTheDocument()
  })
})

describe('SeverityBadge', () => {
  it('renders info severity', () => {
    render(<SeverityBadge severity="info" />)
    expect(screen.getByText('info')).toBeInTheDocument()
  })

  it('renders warning severity', () => {
    render(<SeverityBadge severity="warning" />)
    expect(screen.getByText('warning')).toBeInTheDocument()
  })

  it('renders critical severity', () => {
    render(<SeverityBadge severity="critical" />)
    expect(screen.getByText('critical')).toBeInTheDocument()
  })

  it('hides icon when showIcon is false', () => {
    const { container } = render(<SeverityBadge severity="critical" showIcon={false} />)
    // Badge should not have gap-1 class when no icon
    expect(container.querySelector('.gap-1')).not.toBeInTheDocument()
  })
})

describe('AlertStatusBadge', () => {
  it('renders active status', () => {
    render(<AlertStatusBadge status="active" />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })

  it('renders acknowledged status', () => {
    render(<AlertStatusBadge status="acknowledged" />)
    expect(screen.getByText('acknowledged')).toBeInTheDocument()
  })

  it('renders resolved status', () => {
    render(<AlertStatusBadge status="resolved" />)
    expect(screen.getByText('resolved')).toBeInTheDocument()
  })
})

describe('EntityStatusBadge', () => {
  it('renders deployed status', () => {
    render(<EntityStatusBadge status="deployed" />)
    expect(screen.getByText('Deployed')).toBeInTheDocument()
  })

  it('renders draft status', () => {
    render(<EntityStatusBadge status="draft" />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('renders archived status', () => {
    render(<EntityStatusBadge status="archived" />)
    expect(screen.getByText('Archived')).toBeInTheDocument()
  })

  it('handles unknown status gracefully', () => {
    render(<EntityStatusBadge status="custom" />)
    expect(screen.getByText('custom')).toBeInTheDocument()
  })
})

describe('RiskLevelBadge', () => {
  it('renders low risk', () => {
    render(<RiskLevelBadge level="low" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders medium risk', () => {
    render(<RiskLevelBadge level="medium" />)
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('renders high risk', () => {
    render(<RiskLevelBadge level="high" />)
    expect(screen.getByText('High')).toBeInTheDocument()
  })

  it('renders critical risk', () => {
    render(<RiskLevelBadge level="critical" />)
    expect(screen.getByText('Critical')).toBeInTheDocument()
  })
})

describe('AdminRoleBadge', () => {
  it('renders super_admin role', () => {
    render(<AdminRoleBadge role="super_admin" />)
    expect(screen.getByText('Super Admin')).toBeInTheDocument()
  })

  it('renders admin role', () => {
    render(<AdminRoleBadge role="admin" />)
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('renders support role', () => {
    render(<AdminRoleBadge role="support" />)
    expect(screen.getByText('Support')).toBeInTheDocument()
  })

  it('renders viewer role', () => {
    render(<AdminRoleBadge role="viewer" />)
    expect(screen.getByText('Viewer')).toBeInTheDocument()
  })

  it('handles unknown role gracefully', () => {
    render(<AdminRoleBadge role="custom" />)
    expect(screen.getByText('custom')).toBeInTheDocument()
  })
})

describe('HealthStatusBadge', () => {
  it('renders healthy status', () => {
    render(<HealthStatusBadge status="healthy" />)
    expect(screen.getByText('Healthy')).toBeInTheDocument()
  })

  it('renders degraded status', () => {
    render(<HealthStatusBadge status="degraded" />)
    expect(screen.getByText('Degraded')).toBeInTheDocument()
  })

  it('renders down status', () => {
    render(<HealthStatusBadge status="down" />)
    expect(screen.getByText('Down')).toBeInTheDocument()
  })

  it('applies correct color for healthy', () => {
    const { container } = render(<HealthStatusBadge status="healthy" />)
    expect(container.querySelector('.text-green-500')).toBeInTheDocument()
  })

  it('applies correct color for degraded', () => {
    const { container } = render(<HealthStatusBadge status="degraded" />)
    expect(container.querySelector('.text-yellow-500')).toBeInTheDocument()
  })

  it('applies correct color for down', () => {
    const { container } = render(<HealthStatusBadge status="down" />)
    expect(container.querySelector('.text-red-500')).toBeInTheDocument()
  })
})

describe('TrendIndicator', () => {
  it('renders improving trend', () => {
    render(<TrendIndicator trend="improving" />)
    expect(screen.getByText('Improving')).toBeInTheDocument()
  })

  it('renders stable trend', () => {
    render(<TrendIndicator trend="stable" />)
    expect(screen.getByText('Stable')).toBeInTheDocument()
  })

  it('renders degrading trend', () => {
    render(<TrendIndicator trend="degrading" />)
    expect(screen.getByText('Degrading')).toBeInTheDocument()
  })

  it('applies correct color for improving', () => {
    const { container } = render(<TrendIndicator trend="improving" />)
    expect(container.querySelector('.text-green-500')).toBeInTheDocument()
  })

  it('applies correct color for degrading', () => {
    const { container } = render(<TrendIndicator trend="degrading" />)
    expect(container.querySelector('.text-red-500')).toBeInTheDocument()
  })

  it('returns null for unknown trend', () => {
    const { container } = render(<TrendIndicator trend="unknown" />)
    expect(container.firstChild).toBeNull()
  })
})
