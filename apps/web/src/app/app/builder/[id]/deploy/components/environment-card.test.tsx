/**
 * Environment Card Component Tests
 *
 * Unit tests for the EnvironmentCard component.
 * Tests rendering states, status display, actions, and accessibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EnvironmentCard, ENV_CONFIG } from './environment-card'
import type { EnvironmentDeployment, Environment } from '@/lib/api'

// ============================================
// TEST FIXTURES
// ============================================

function createMockDeployment(
  overrides: Partial<EnvironmentDeployment> = {}
): EnvironmentDeployment {
  return {
    id: 'deploy-' + Math.random().toString(36).substring(2, 9),
    version: 1,
    status: 'running',
    environment: 'dev',
    endpoint_url: 'https://api.guardianclaw.org/invoke/test-agent',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

// ============================================
// TEST SUITES
// ============================================

describe('EnvironmentCard', () => {
  const mockOnDeploy = vi.fn()
  const mockOnStop = vi.fn()
  const mockOnPromote = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ==========================================
  // Rendering Tests
  // ==========================================

  describe('Rendering', () => {
    it('renders development environment card', () => {
      render(
        <EnvironmentCard env="dev" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(screen.getByText('Development')).toBeInTheDocument()
    })

    it('renders staging environment card', () => {
      render(
        <EnvironmentCard
          env="staging"
          deployment={null}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(screen.getByText('Staging')).toBeInTheDocument()
    })

    it('renders production environment card', () => {
      render(
        <EnvironmentCard env="prod" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(screen.getByText('Production')).toBeInTheDocument()
    })

    it('shows "Not Deployed" when deployment is null', () => {
      render(
        <EnvironmentCard env="dev" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(screen.getByText('Not Deployed')).toBeInTheDocument()
    })

    it('shows "Running" when deployment is active', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it('displays version number when deployed', () => {
      const deployment = createMockDeployment({ version: 5 })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(screen.getByText(/v5/)).toBeInTheDocument()
    })

    it('displays deployment date when deployed', () => {
      const deployment = createMockDeployment({
        created_at: '2024-01-15T10:30:00Z',
      })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      // Should display formatted date (format varies by locale, just check it contains 2024)
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })

    it('applies custom className', () => {
      const { container } = render(
        <EnvironmentCard
          env="dev"
          deployment={null}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
          className="custom-class"
        />
      )

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  // ==========================================
  // Status Display Tests
  // ==========================================

  describe('Status Display', () => {
    it('shows green ring when running', () => {
      const deployment = createMockDeployment({ status: 'running' })
      const { container } = render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(container.firstChild).toHaveClass('ring-green-500/50')
    })

    it('does not show green ring when not running', () => {
      const deployment = createMockDeployment({ status: 'stopped' })
      const { container } = render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(container.firstChild).not.toHaveClass('ring-green-500/50')
    })

    it('shows blue color bar for dev environment', () => {
      const { container } = render(
        <EnvironmentCard env="dev" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(container.querySelector('.bg-blue-500')).toBeInTheDocument()
    })

    it('shows yellow color bar for staging environment', () => {
      const { container } = render(
        <EnvironmentCard
          env="staging"
          deployment={null}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(container.querySelector('.bg-yellow-500')).toBeInTheDocument()
    })

    it('shows green color bar for prod environment', () => {
      const { container } = render(
        <EnvironmentCard env="prod" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(container.querySelector('.bg-green-500')).toBeInTheDocument()
    })
  })

  // ==========================================
  // Action Button Tests
  // ==========================================

  describe('Action Buttons', () => {
    it('shows Deploy button when not running', () => {
      render(
        <EnvironmentCard env="dev" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(screen.getByRole('button', { name: /deploy to development/i })).toBeInTheDocument()
    })

    it('shows Stop button when running', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(screen.getByRole('button', { name: /stop development/i })).toBeInTheDocument()
    })

    it('shows Promote button when running and onPromote provided', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
          onPromote={mockOnPromote}
        />
      )

      expect(screen.getByRole('button', { name: /promote/i })).toBeInTheDocument()
    })

    it('does not show Promote button for prod environment', () => {
      const deployment = createMockDeployment({ status: 'running', environment: 'prod' })
      render(
        <EnvironmentCard
          env="prod"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
          onPromote={mockOnPromote}
        />
      )

      expect(screen.queryByRole('button', { name: /promote/i })).not.toBeInTheDocument()
    })

    it('does not show Promote button when onPromote not provided', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(screen.queryByRole('button', { name: /promote/i })).not.toBeInTheDocument()
    })

    it('calls onDeploy when Deploy button clicked', () => {
      render(
        <EnvironmentCard env="dev" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      fireEvent.click(screen.getByRole('button', { name: /deploy/i }))
      expect(mockOnDeploy).toHaveBeenCalledTimes(1)
    })

    it('calls onStop when Stop button clicked', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /stop/i }))
      expect(mockOnStop).toHaveBeenCalledTimes(1)
    })

    it('calls onPromote when Promote button clicked', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
          onPromote={mockOnPromote}
        />
      )

      fireEvent.click(screen.getByRole('button', { name: /promote/i }))
      expect(mockOnPromote).toHaveBeenCalledTimes(1)
    })
  })

  // ==========================================
  // Loading States Tests
  // ==========================================

  describe('Loading States', () => {
    it('disables Deploy button and shows loading when deploying', () => {
      render(
        <EnvironmentCard
          env="dev"
          deployment={null}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
          deploying={true}
        />
      )

      const button = screen.getByRole('button', { name: /deploying/i })
      expect(button).toBeDisabled()
      expect(screen.getByText('Deploying...')).toBeInTheDocument()
    })

    it('disables Stop button and shows loading when stopping', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
          stopping={true}
        />
      )

      const button = screen.getByRole('button', { name: /stopping/i })
      expect(button).toBeDisabled()
      expect(screen.getByText('Stopping...')).toBeInTheDocument()
    })

    it('does not call onDeploy when button is disabled', () => {
      render(
        <EnvironmentCard
          env="dev"
          deployment={null}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
          deploying={true}
        />
      )

      const button = screen.getByRole('button', { name: /deploying/i })
      fireEvent.click(button)
      expect(mockOnDeploy).not.toHaveBeenCalled()
    })
  })

  // ==========================================
  // Accessibility Tests
  // ==========================================

  describe('Accessibility', () => {
    it('has proper aria-label for the card region', () => {
      render(
        <EnvironmentCard env="dev" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(screen.getByRole('region', { name: /development environment/i })).toBeInTheDocument()
    })

    it('has proper aria-label for status badge', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(screen.getByLabelText(/status: running/i)).toBeInTheDocument()
    })

    it('has proper aria-label for Deploy button', () => {
      render(
        <EnvironmentCard
          env="staging"
          deployment={null}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(screen.getByRole('button', { name: /deploy to staging/i })).toBeInTheDocument()
    })

    it('has proper aria-label for Stop button', () => {
      const deployment = createMockDeployment({ status: 'running' })
      render(
        <EnvironmentCard
          env="prod"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      expect(
        screen.getByRole('button', { name: /stop production deployment/i })
      ).toBeInTheDocument()
    })

    it('has action buttons grouped with aria role', () => {
      render(
        <EnvironmentCard env="dev" deployment={null} onDeploy={mockOnDeploy} onStop={mockOnStop} />
      )

      expect(screen.getByRole('group', { name: /environment actions/i })).toBeInTheDocument()
    })

    it('hides decorative elements from screen readers', () => {
      const deployment = createMockDeployment({ status: 'running' })
      const { container } = render(
        <EnvironmentCard
          env="dev"
          deployment={deployment}
          onDeploy={mockOnDeploy}
          onStop={mockOnStop}
        />
      )

      // Color bar should have aria-hidden
      const colorBar = container.querySelector('.bg-blue-500')
      expect(colorBar).toHaveAttribute('aria-hidden', 'true')
    })
  })

  // ==========================================
  // ENV_CONFIG Tests
  // ==========================================

  describe('ENV_CONFIG', () => {
    it('has correct config for dev environment', () => {
      expect(ENV_CONFIG.dev.label).toBe('Development')
      expect(ENV_CONFIG.dev.color).toBe('bg-blue-500')
    })

    it('has correct config for staging environment', () => {
      expect(ENV_CONFIG.staging.label).toBe('Staging')
      expect(ENV_CONFIG.staging.color).toBe('bg-yellow-500')
    })

    it('has correct config for prod environment', () => {
      expect(ENV_CONFIG.prod.label).toBe('Production')
      expect(ENV_CONFIG.prod.color).toBe('bg-green-500')
    })

    it('each environment has all required config properties', () => {
      const environments: Environment[] = ['dev', 'staging', 'prod']

      environments.forEach((env) => {
        expect(ENV_CONFIG[env]).toHaveProperty('label')
        expect(ENV_CONFIG[env]).toHaveProperty('color')
        expect(ENV_CONFIG[env]).toHaveProperty('icon')
        expect(ENV_CONFIG[env]).toHaveProperty('description')
      })
    })
  })
})
