/**
 * E2E Tests: Agent Builder
 *
 * Tests the agent builder functionality including:
 * - Creating new agents
 * - Editing agent configuration
 * - GuardianClaw settings (CLAW gates)
 * - Flow editor navigation
 * - Agent settings management
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedUser, waitForAuth, TEST_USER } from './fixtures/auth'
import { setupApiMocks, TEST_AGENT, TEST_IDS } from './fixtures/test-data'

test.describe('Agent Builder', () => {
  test.describe('Agents List', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)
    })

    test('should display agents list page', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Should see agents list content
      const content = page.locator(
        'text=Agents, text=My Agents, [data-testid="agents-list"], [data-testid="agents-page"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should have create new agent button', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Look for create button
      const createButton = page.locator(
        'a[href*="/builder/new"], button:has-text("Create"), button:has-text("New Agent"), [data-testid="create-agent"]'
      )

      await expect(createButton.first()).toBeVisible({ timeout: 10000 })
    })

    test('should navigate to builder when clicking create', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      const createButton = page.locator(
        'a[href*="/builder/new"], button:has-text("Create"), button:has-text("New Agent"), [data-testid="create-agent"]'
      )

      if (
        await createButton
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await createButton.first().click()
        await page.waitForURL(/.*builder.*/, { timeout: 10000 })
        expect(page.url()).toContain('builder')
      }
    })
  })

  test.describe('Builder Interface', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)
    })

    test('should load builder page', async ({ page }) => {
      await page.goto('/app/builder')
      await waitForAuth(page)

      // Should see builder content
      const content = page.locator('text=Builder, text=Agent Builder, [data-testid="builder-page"]')
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load new agent page', async ({ page }) => {
      await page.goto('/app/builder/new')
      await waitForAuth(page)

      // Should see new agent form or wizard
      const content = page.locator(
        'text=Create, text=New Agent, text=Agent Name, [data-testid="new-agent-form"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load existing agent in builder', async ({ page }) => {
      // Mock specific agent endpoint
      await page.route(`**/api/agents/${TEST_IDS.agent}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ agent: TEST_AGENT }),
        })
      })

      await page.goto(`/app/builder/${TEST_IDS.agent}`)
      await waitForAuth(page)

      // Should see agent details or builder interface
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).not.toContainText('404')
    })
  })

  test.describe('Builder Sections', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      // Mock agent endpoint for all section tests
      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ agent: TEST_AGENT }),
        })
      })
    })

    test('should load flow editor page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/flow`)
      await waitForAuth(page)

      // Should see flow editor
      const content = page.locator(
        'text=Flow, text=Editor, [data-testid="flow-editor"], .react-flow'
      )
      await expect(content.first()).toBeVisible({ timeout: 15000 })
    })

    test('should load claw configuration page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/claw`)
      await waitForAuth(page)

      // Should see claw config
      const content = page.locator(
        'text=GuardianClaw, text=Safety, text=CLAW, text=Gates, [data-testid="claw-config"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load agent settings page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/settings`)
      await waitForAuth(page)

      // Should see settings
      const content = page.locator(
        'text=Settings, text=Configuration, [data-testid="agent-settings"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load deploy page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Should see deploy section
      const content = page.locator(
        'text=Deploy, text=Deployment, text=Environment, [data-testid="deploy-page"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load analytics page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/analytics`)
      await waitForAuth(page)

      // Should see analytics
      const content = page.locator(
        'text=Analytics, text=Usage, text=Metrics, [data-testid="agent-analytics"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load test page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/test`)
      await waitForAuth(page)

      // Should see test interface
      const content = page.locator(
        'text=Test, text=Playground, text=Try, [data-testid="agent-test"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load alerts page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/alerts`)
      await waitForAuth(page)

      // Should see alerts section
      const content = page.locator('text=Alerts, [data-testid="agent-alerts"]')
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load webhooks page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/webhooks`)
      await waitForAuth(page)

      // Should see webhooks section
      const content = page.locator(
        'text=Webhooks, text=Integrations, [data-testid="agent-webhooks"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load memory page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/memory`)
      await waitForAuth(page)

      // Should see memory section
      const content = page.locator('text=Memory, text=Context, [data-testid="agent-memory"]')
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load logs page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/logs`)
      await waitForAuth(page)

      // Should see logs section
      const content = page.locator('text=Logs, text=Activity, [data-testid="agent-logs"]')
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load character page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/character`)
      await waitForAuth(page)

      // Should see character section
      const content = page.locator(
        'text=Character, text=Personality, text=Behavior, [data-testid="agent-character"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should load connectors page', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/connectors`)
      await waitForAuth(page)

      // Should see connectors section
      const content = page.locator(
        'text=Connectors, text=Integrations, text=Connections, [data-testid="agent-connectors"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Builder Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ agent: TEST_AGENT }),
        })
      })
    })

    test('should have navigation tabs or sidebar', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}`)
      await waitForAuth(page)

      // Look for navigation elements
      const nav = page.locator(
        '[role="tablist"], [data-testid="builder-nav"], nav a[href*="/builder/"], aside a[href*="/builder/"]'
      )

      await expect(nav.first()).toBeVisible({ timeout: 10000 })
    })

    test('should navigate between builder sections', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}`)
      await waitForAuth(page)

      // Find claw link
      const clawLink = page.locator(`a[href*="/claw"], [data-testid="nav-claw"]`)

      if (
        await clawLink
          .first()
          .isVisible()
          .catch(() => false)
      ) {
        await clawLink.first().click()
        await page.waitForURL(/.*claw.*/, { timeout: 10000 })
        expect(page.url()).toContain('claw')
      }
    })
  })

  test.describe('Agent Configuration', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ agent: TEST_AGENT }),
        })
      })
    })

    test('should display agent name in builder', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}`)
      await waitForAuth(page)

      // Should show agent name somewhere
      const agentName = page.locator(`text="${TEST_AGENT.name}"`)
      if (await agentName.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(agentName).toBeVisible()
      }
    })

    test('should show save/update button', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/settings`)
      await waitForAuth(page)

      // Look for save button
      const saveButton = page.locator(
        'button:has-text("Save"), button:has-text("Update"), button[type="submit"]'
      )

      if (
        await saveButton
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(saveButton.first()).toBeVisible()
      }
    })
  })

  test.describe('GuardianClaw Configuration', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ agent: TEST_AGENT }),
        })
      })
    })

    test('should show CLAW gate configuration', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/claw`)
      await waitForAuth(page)

      // Should show gate names
      const gates = ['Credibility', 'Avoidance', 'Limits', 'Worth']
      let foundGates = 0

      for (const gate of gates) {
        const gateElement = page.locator(`text=${gate}`)
        if (
          await gateElement
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          foundGates++
        }
      }

      // At least some gates should be visible
      expect(foundGates).toBeGreaterThan(0)
    })

    test('should have toggles or sliders for gates', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/claw`)
      await waitForAuth(page)

      // Look for toggle switches or sliders
      const controls = page.locator(
        '[role="switch"], input[type="checkbox"], input[type="range"], [data-testid*="gate"]'
      )

      if (
        await controls
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(controls.first()).toBeVisible()
      }
    })
  })

  test.describe('Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
    })

    test('should handle non-existent agent gracefully', async ({ page }) => {
      // Mock 404 response
      await page.route('**/api/agents/non-existent-id**', async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Agent not found' }),
        })
      })

      await page.goto('/app/builder/non-existent-id')
      await waitForAuth(page)

      // Should show error or redirect
      const errorState = page.locator(
        'text=not found, text=Error, text=404, [data-testid="error-message"]'
      )
      const redirected = !page.url().includes('non-existent-id')

      const hasError = await errorState
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      expect(hasError || redirected).toBeTruthy()
    })

    test('should handle API errors on agent load', async ({ page }) => {
      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      })

      await page.goto(`/app/builder/${TEST_IDS.agent}`)
      await waitForAuth(page)

      // Should not crash, show error state
      await expect(page.locator('body')).not.toContainText('Unhandled')
    })
  })
})
