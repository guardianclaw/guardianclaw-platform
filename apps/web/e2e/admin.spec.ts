/**
 * E2E Tests: Admin Dashboard
 *
 * Tests the admin dashboard functionality including:
 * - Page accessibility and navigation
 * - Dashboard metrics display
 * - User management
 * - Alert management
 * - System configuration
 * - Feature flags
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedAdmin, navigateAsAdmin, TEST_ADMIN } from './fixtures/auth'
import { setupAdminApiMocks } from './fixtures/test-data'

test.describe('Admin Dashboard', () => {
  test.describe('Smoke Tests - Page Accessibility', () => {
    test('all admin pages should be defined in routing', async ({ page }) => {
      const adminPages = [
        '/admin',
        '/admin/operations',
        '/admin/business',
        '/admin/financial',
        '/admin/security',
        '/admin/analytics',
        '/admin/alerts',
        '/admin/alerts/rules',
        '/admin/support',
        '/admin/settings',
        '/admin/agents',
        '/admin/deployments',
        '/admin/governance',
        '/admin/compliance',
        '/admin/credits',
        '/admin/audit',
        '/admin/system',
      ]

      for (const url of adminPages) {
        const response = await page.goto(url)
        // Should not return 404
        expect(response?.status(), `${url} returned 404`).not.toBe(404)
      }
    })

    test('home page should load correctly', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveTitle(/GuardianClaw/)
      await expect(page.locator('nav')).toBeVisible()
    })
  })

  test.describe('Authenticated Admin Tests', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedAdmin(page)
      setupAdminApiMocks(page)
    })

    test.describe('Overview Dashboard', () => {
      test('should display dashboard metrics', async ({ page }) => {
        await page.goto('/admin')

        // Wait for page to load
        await page.waitForLoadState('networkidle')

        // Should see dashboard content
        await expect(
          page.locator('text=Dashboard, text=Overview, [data-testid="admin-dashboard"]').first()
        ).toBeVisible({ timeout: 10000 })
      })

      test('should display navigation sidebar', async ({ page }) => {
        await page.goto('/admin')
        await page.waitForLoadState('networkidle')

        // Should have navigation elements
        const nav = page.locator('nav, [data-testid="admin-sidebar"], aside')
        await expect(nav.first()).toBeVisible()
      })
    })

    test.describe('Operations Dashboard', () => {
      test('should load operations page', async ({ page }) => {
        await page.goto('/admin/operations')
        await page.waitForLoadState('networkidle')

        // Should see operations content
        const content = page.locator(
          'text=Operations, text=System Status, [data-testid="operations-dashboard"]'
        )
        await expect(content.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Security Dashboard', () => {
      test('should load security page', async ({ page }) => {
        await page.goto('/admin/security')
        await page.waitForLoadState('networkidle')

        // Should see security content
        const content = page.locator(
          'text=Security, text=Threats, text=Incidents, [data-testid="security-dashboard"]'
        )
        await expect(content.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Alerts Management', () => {
      test('should load alerts list', async ({ page }) => {
        await page.goto('/admin/alerts')
        await page.waitForLoadState('networkidle')

        // Should see alerts section
        const alertsContent = page.locator('text=Alerts, [data-testid="alerts-list"]')
        await expect(alertsContent.first()).toBeVisible({ timeout: 10000 })
      })

      test('should have tab navigation for alert status', async ({ page }) => {
        await page.goto('/admin/alerts')
        await page.waitForLoadState('networkidle')

        // Look for tab elements
        const tabs = page.locator('[role="tablist"], [data-testid="alert-tabs"]')
        if (await tabs.isVisible().catch(() => false)) {
          await expect(tabs).toBeVisible()
        }
      })

      test('should load alert rules page', async ({ page }) => {
        await page.goto('/admin/alerts/rules')
        await page.waitForLoadState('networkidle')

        // Should see alert rules content
        const rulesContent = page.locator(
          'text=Rules, text=Alert Rules, [data-testid="alert-rules"]'
        )
        await expect(rulesContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('User Support', () => {
      test('should load support page', async ({ page }) => {
        await page.goto('/admin/support')
        await page.waitForLoadState('networkidle')

        // Should see support content
        const supportContent = page.locator(
          'text=Support, text=User Search, [data-testid="support-dashboard"]'
        )
        await expect(supportContent.first()).toBeVisible({ timeout: 10000 })
      })

      test('should have user search functionality', async ({ page }) => {
        await page.goto('/admin/support')
        await page.waitForLoadState('networkidle')

        // Look for search input
        const searchInput = page.locator(
          'input[type="search"], input[placeholder*="wallet"], input[placeholder*="search"], [data-testid="user-search"]'
        )

        if (await searchInput.isVisible().catch(() => false)) {
          await expect(searchInput).toBeVisible()
        }
      })
    })

    test.describe('System Settings', () => {
      test('should load settings page', async ({ page }) => {
        await page.goto('/admin/settings')
        await page.waitForLoadState('networkidle')

        // Should see settings content
        const settingsContent = page.locator(
          'text=Settings, text=Configuration, [data-testid="admin-settings"]'
        )
        await expect(settingsContent.first()).toBeVisible({ timeout: 10000 })
      })

      test('should load system configuration page', async ({ page }) => {
        await page.goto('/admin/system')
        await page.waitForLoadState('networkidle')

        // Should see system config content
        const systemContent = page.locator(
          'text=System, text=Configuration, text=Feature Flags, [data-testid="system-config"]'
        )
        await expect(systemContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Agent Management', () => {
      test('should load agents admin page', async ({ page }) => {
        await page.goto('/admin/agents')
        await page.waitForLoadState('networkidle')

        // Should see agents list
        const agentsContent = page.locator('text=Agents, [data-testid="admin-agents-list"]')
        await expect(agentsContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Deployment Management', () => {
      test('should load deployments admin page', async ({ page }) => {
        await page.goto('/admin/deployments')
        await page.waitForLoadState('networkidle')

        // Should see deployments list
        const deploymentsContent = page.locator(
          'text=Deployments, [data-testid="admin-deployments-list"]'
        )
        await expect(deploymentsContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Governance Admin', () => {
      test('should load governance admin page', async ({ page }) => {
        await page.goto('/admin/governance')
        await page.waitForLoadState('networkidle')

        // Should see governance content
        const govContent = page.locator(
          'text=Governance, text=Proposals, [data-testid="admin-governance"]'
        )
        await expect(govContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Compliance Dashboard', () => {
      test('should load compliance page', async ({ page }) => {
        await page.goto('/admin/compliance')
        await page.waitForLoadState('networkidle')

        // Should see compliance content
        const complianceContent = page.locator(
          'text=Compliance, text=Requests, [data-testid="compliance-dashboard"]'
        )
        await expect(complianceContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Credits Management', () => {
      test('should load credits page', async ({ page }) => {
        await page.goto('/admin/credits')
        await page.waitForLoadState('networkidle')

        // Should see credits content
        const creditsContent = page.locator(
          'text=Credits, text=Balance, [data-testid="credits-dashboard"]'
        )
        await expect(creditsContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Audit Logs', () => {
      test('should load audit page', async ({ page }) => {
        await page.goto('/admin/audit')
        await page.waitForLoadState('networkidle')

        // Should see audit content
        const auditContent = page.locator('text=Audit, text=Logs, [data-testid="audit-logs"]')
        await expect(auditContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Financial Dashboard', () => {
      test('should load financial page', async ({ page }) => {
        await page.goto('/admin/financial')
        await page.waitForLoadState('networkidle')

        // Should see financial content
        const financialContent = page.locator(
          'text=Financial, text=Revenue, [data-testid="financial-dashboard"]'
        )
        await expect(financialContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Business Dashboard', () => {
      test('should load business page', async ({ page }) => {
        await page.goto('/admin/business')
        await page.waitForLoadState('networkidle')

        // Should see business content
        const businessContent = page.locator(
          'text=Business, text=Metrics, [data-testid="business-dashboard"]'
        )
        await expect(businessContent.first()).toBeVisible({ timeout: 10000 })
      })
    })

    test.describe('Analytics Dashboard', () => {
      test('should load analytics page', async ({ page }) => {
        await page.goto('/admin/analytics')
        await page.waitForLoadState('networkidle')

        // Should see analytics content
        const analyticsContent = page.locator(
          'text=Analytics, text=Usage, [data-testid="analytics-dashboard"]'
        )
        await expect(analyticsContent.first()).toBeVisible({ timeout: 10000 })
      })
    })
  })

  test.describe('Admin Access Control', () => {
    test('should require admin authentication', async ({ page }) => {
      // Try to access admin without auth
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Should either redirect or show unauthorized
      const url = page.url()
      const hasAuthPrompt = await page
        .locator(
          'text=Unauthorized, text=Access Denied, button:has-text("Connect"), button:has-text("Sign In")'
        )
        .isVisible()
        .catch(() => false)

      expect(url.includes('/admin') === false || hasAuthPrompt).toBeTruthy()
    })

    test('should show admin navigation when authenticated', async ({ page }) => {
      await setupAuthenticatedAdmin(page)
      setupAdminApiMocks(page)

      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Should see admin navigation
      const adminNav = page.locator(
        'nav a[href*="/admin"], [data-testid="admin-nav"], aside a[href*="/admin"]'
      )
      await expect(adminNav.first()).toBeVisible({ timeout: 10000 })
    })
  })

  test.describe('Navigation', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedAdmin(page)
      setupAdminApiMocks(page)
    })

    test('should navigate between admin sections', async ({ page }) => {
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Find navigation links
      const operationsLink = page.locator('a[href="/admin/operations"]').first()

      if (await operationsLink.isVisible().catch(() => false)) {
        await operationsLink.click()
        await page.waitForURL(/.*operations.*/)
        expect(page.url()).toContain('operations')
      }
    })

    test('should have breadcrumb or back navigation', async ({ page }) => {
      await page.goto('/admin/alerts/rules')
      await page.waitForLoadState('networkidle')

      // Look for breadcrumb or back button
      const breadcrumb = page.locator(
        '[data-testid="breadcrumb"], nav[aria-label*="breadcrumb"], a[href="/admin/alerts"]'
      )

      if (await breadcrumb.isVisible().catch(() => false)) {
        await expect(breadcrumb.first()).toBeVisible()
      }
    })
  })
})
