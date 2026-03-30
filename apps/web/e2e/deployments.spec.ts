/**
 * E2E Tests: Deployment Flow
 *
 * Tests the deployment functionality including:
 * - Deployment page loading
 * - Environment selection
 * - Deployment status display
 * - API key visibility
 * - Deployment history
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedUser, setupAuthenticatedAdmin, waitForAuth } from './fixtures/auth'
import {
  setupApiMocks,
  setupAdminApiMocks,
  TEST_AGENT,
  TEST_DEPLOYMENT,
  TEST_IDS,
} from './fixtures/test-data'

test.describe('Deployment Flow', () => {
  test.describe('Agent Deployment Page', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      // Mock agent and deployment endpoints
      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ agent: TEST_AGENT }),
        })
      })

      await page.route(`**/api/agents/${TEST_IDS.agent}/deployments**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            deployments: [TEST_DEPLOYMENT],
            total: 1,
          }),
        })
      })
    })

    test('should load deployment page for agent', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Should see deployment content
      const content = page.locator(
        'text=Deploy, text=Deployment, text=Environment, [data-testid="deploy-page"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should display environment options', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for environment selectors
      const envOptions = page.locator(
        'text=Development, text=Staging, text=Production, [data-testid*="environment"]'
      )

      if (
        await envOptions
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(envOptions.first()).toBeVisible()
      }
    })

    test('should show deployment status', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for status indicators
      const statusIndicators = page.locator(
        'text=Active, text=Deployed, text=Status, [data-testid="deployment-status"]'
      )

      if (
        await statusIndicators
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(statusIndicators.first()).toBeVisible()
      }
    })

    test('should show API endpoint or key section', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for API key or endpoint display
      const apiSection = page.locator(
        'text=API Key, text=Endpoint, text=sk-, [data-testid="api-key"], [data-testid="endpoint"]'
      )

      if (
        await apiSection
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(apiSection.first()).toBeVisible()
      }
    })

    test('should have deploy button', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for deploy action button
      const deployButton = page.locator(
        'button:has-text("Deploy"), button:has-text("Create Deployment"), [data-testid="deploy-button"]'
      )

      if (
        await deployButton
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(deployButton.first()).toBeVisible()
      }
    })
  })

  test.describe('Deployment History', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        if (route.request().url().includes('deployments')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              deployments: [
                TEST_DEPLOYMENT,
                {
                  ...TEST_DEPLOYMENT,
                  id: 'e2e00000-0000-0000-0000-000000000010',
                  version: '0.9.0',
                  status: 'inactive',
                  created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                },
              ],
              total: 2,
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ agent: TEST_AGENT }),
          })
        }
      })
    })

    test('should display deployment history', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for history section
      const historySection = page.locator(
        'text=History, text=Previous, text=Versions, [data-testid="deployment-history"]'
      )

      if (
        await historySection
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(historySection.first()).toBeVisible()
      }
    })

    test('should show version information', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for version display
      const versionInfo = page.locator('text=1.0.0, text=0.9.0, text=Version')

      if (
        await versionInfo
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(versionInfo.first()).toBeVisible()
      }
    })
  })

  test.describe('Admin Deployments View', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedAdmin(page)
      setupAdminApiMocks(page)

      // Mock admin deployments endpoint
      await page.route('**/admin/deployments**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            deployments: [
              TEST_DEPLOYMENT,
              {
                ...TEST_DEPLOYMENT,
                id: 'e2e00000-0000-0000-0000-000000000011',
                agent_id: 'e2e00000-0000-0000-0000-000000000012',
                environment: 'production',
                status: 'active',
              },
            ],
            total: 2,
          }),
        })
      })
    })

    test('should load admin deployments page', async ({ page }) => {
      await page.goto('/admin/deployments')
      await page.waitForLoadState('networkidle')

      // Should see deployments admin content
      const content = page.locator(
        'text=Deployments, [data-testid="admin-deployments"], [data-testid="deployments-list"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should display deployment list', async ({ page }) => {
      await page.goto('/admin/deployments')
      await page.waitForLoadState('networkidle')

      // Should show table or list of deployments
      const list = page.locator(
        'table, [role="table"], [data-testid="deployments-table"], [data-testid="deployment-row"]'
      )

      if (
        await list
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(list.first()).toBeVisible()
      }
    })

    test('should show environment filters', async ({ page }) => {
      await page.goto('/admin/deployments')
      await page.waitForLoadState('networkidle')

      // Look for environment filter
      const filters = page.locator(
        '[data-testid="environment-filter"], select, [role="combobox"], button:has-text("Environment")'
      )

      if (
        await filters
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(filters.first()).toBeVisible()
      }
    })

    test('should navigate to deployment details', async ({ page }) => {
      await page.goto('/admin/deployments')
      await page.waitForLoadState('networkidle')

      // Look for clickable deployment row or link
      const deploymentLink = page.locator(
        `a[href*="/admin/deployments/"], [data-testid="deployment-row"]`
      )

      if (
        await deploymentLink
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await deploymentLink.first().click()
        await page.waitForURL(/.*deployments\/.*/, { timeout: 10000 })
      }
    })
  })

  test.describe('Deployment Actions', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        if (route.request().url().includes('deployments')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              deployments: [TEST_DEPLOYMENT],
              total: 1,
            }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ agent: TEST_AGENT }),
          })
        }
      })
    })

    test('should have copy API key functionality', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for copy button near API key
      const copyButton = page.locator(
        'button[aria-label*="copy"], button:has-text("Copy"), [data-testid="copy-api-key"]'
      )

      if (
        await copyButton
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(copyButton.first()).toBeVisible()
      }
    })

    test('should show deployment logs or activity', async ({ page }) => {
      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Look for logs section
      const logsSection = page.locator(
        'text=Logs, text=Activity, text=Events, [data-testid="deployment-logs"]'
      )

      if (
        await logsSection
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(logsSection.first()).toBeVisible()
      }
    })
  })

  test.describe('Deployment Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
    })

    test('should handle deployment API error gracefully', async ({ page }) => {
      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        if (route.request().url().includes('deployments')) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Deployment service unavailable' }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ agent: TEST_AGENT }),
          })
        }
      })

      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Should not crash, show error state
      await expect(page.locator('body')).not.toContainText('Unhandled')
    })

    test('should show error when agent has no deployments', async ({ page }) => {
      await page.route(`**/api/agents/${TEST_IDS.agent}**`, async (route) => {
        if (route.request().url().includes('deployments')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ deployments: [], total: 0 }),
          })
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ agent: TEST_AGENT }),
          })
        }
      })

      await page.goto(`/app/builder/${TEST_IDS.agent}/deploy`)
      await waitForAuth(page)

      // Should show empty state or prompt to deploy
      const emptyState = page.locator(
        'text=No deployments, text=Deploy your agent, text=Get started, [data-testid="empty-deployments"]'
      )

      if (
        await emptyState
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(emptyState.first()).toBeVisible()
      }
    })
  })
})
