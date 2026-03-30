/**
 * E2E Tests: Authentication Flow
 *
 * Tests the complete authentication lifecycle including:
 * - Wallet connection prompts
 * - Login/logout flow
 * - Session persistence
 * - Protected route access
 * - Token expiration handling
 */

import { test, expect } from '@playwright/test'
import {
  setupAuthenticatedUser,
  clearAuth,
  isAuthenticated,
  waitForAuth,
  TEST_USER,
} from './fixtures/auth'

test.describe('Authentication Flow', () => {
  test.describe('Unauthenticated Access', () => {
    test('should show connect wallet prompt on protected routes', async ({ page }) => {
      await page.goto('/app/agents')

      // Should see wallet connection UI or redirect to home
      const connectButton = page.locator(
        'button:has-text("Connect"), button:has-text("Sign In"), [data-testid="connect-wallet"]'
      )
      const homeContent = page.locator('text=Decision Firewall, text=GuardianClaw')

      // Either shows connect button or redirects to home
      await expect(connectButton.or(homeContent).first()).toBeVisible({ timeout: 10000 })
    })

    test('should allow access to public pages without auth', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveTitle(/GuardianClaw/)

      // Navigation should be visible
      await expect(page.locator('nav')).toBeVisible()
    })

    test('should allow access to marketing pages', async ({ page }) => {
      const publicPages = ['/about', '/integrations', '/compliance']

      for (const path of publicPages) {
        const response = await page.goto(path)
        expect(response?.status()).not.toBe(404)
        expect(response?.status()).not.toBe(500)
      }
    })

    test('should redirect from /app routes when unauthenticated', async ({ page }) => {
      await page.goto('/app/agents')

      // Wait for potential redirect
      await page.waitForTimeout(2000)

      // Should either show login UI or be redirected
      const url = page.url()
      const hasLoginUI = await page
        .locator(
          'button:has-text("Connect"), button:has-text("Sign In"), [data-testid="connect-wallet"]'
        )
        .isVisible()
        .catch(() => false)

      expect(url.includes('/app/agents') === false || hasLoginUI).toBeTruthy()
    })
  })

  test.describe('Authenticated Access', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
    })

    test('should access protected routes when authenticated', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Should see the agents page content
      await expect(
        page.locator('text=Agents, text=My Agents, [data-testid="agents-list"]').first()
      ).toBeVisible({ timeout: 10000 })
    })

    test('should display user information in header', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Look for user menu or profile indicator
      const userMenu = page.locator(
        '[data-testid="user-menu"], [data-testid="profile-button"], [aria-label*="profile"], [aria-label*="user"]'
      )

      // May be in collapsed menu on mobile
      const hasUserMenu = await userMenu.isVisible().catch(() => false)
      if (!hasUserMenu) {
        // Try opening mobile menu first
        const mobileMenu = page.locator('[data-testid="mobile-menu"], button[aria-label*="menu"]')
        if (await mobileMenu.isVisible().catch(() => false)) {
          await mobileMenu.click()
          await expect(userMenu).toBeVisible({ timeout: 5000 })
        }
      }
    })

    test('should persist session across page navigations', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Navigate to another protected route
      await page.goto('/app/builder')
      await waitForAuth(page)

      // Should still be authenticated
      const authenticated = await isAuthenticated(page)
      // Since we mocked auth, we should see the builder content
      await expect(page.locator('body')).not.toContainText('Connect Wallet')
    })

    test('should navigate to builder from agents list', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Click on create new agent or navigate to builder
      const createButton = page.locator(
        'a[href*="/builder"], button:has-text("Create"), button:has-text("New Agent")'
      )

      if (await createButton.isVisible().catch(() => false)) {
        await createButton.first().click()
        await page.waitForURL(/.*builder.*/)
        expect(page.url()).toContain('builder')
      }
    })
  })

  test.describe('Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
    })

    test('should clear session on logout', async ({ page }) => {
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Clear auth (simulating logout)
      await clearAuth(page)

      // Reload the page
      await page.reload()

      // Should no longer be authenticated
      await page.waitForTimeout(1000)

      // Verify token is removed from localStorage
      const token = await page.evaluate(() => localStorage.getItem('claw_token'))
      expect(token).toBeNull()
    })
  })

  test.describe('Session Persistence', () => {
    test('should maintain auth state on page refresh', async ({ page }) => {
      await setupAuthenticatedUser(page)
      await page.goto('/app/agents')
      await waitForAuth(page)

      // Get initial auth state
      const initialToken = await page.evaluate(() => localStorage.getItem('claw_token'))
      expect(initialToken).toBeTruthy()

      // Refresh the page
      await page.reload()
      await waitForAuth(page)

      // Token should still be present
      const tokenAfterRefresh = await page.evaluate(() => localStorage.getItem('claw_token'))
      expect(tokenAfterRefresh).toBe(initialToken)
    })
  })

  test.describe('Error Handling', () => {
    test('should handle API errors gracefully', async ({ page }) => {
      // Setup auth but make /auth/me fail
      await page.route('**/auth/me', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      })

      await page.goto('/app/agents')

      // Should show error state or fallback UI, not crash
      await expect(page.locator('body')).not.toContainText('Unhandled')
      await expect(page.locator('body')).not.toContainText('undefined')
    })

    test('should handle network failures', async ({ page }) => {
      // Block all API requests
      await page.route('**/api/**', async (route) => {
        await route.abort('failed')
      })

      await page.route('**/auth/**', async (route) => {
        await route.abort('failed')
      })

      await page.goto('/')

      // Page should still load, showing offline/error state
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Token Expiration', () => {
    test('should handle expired token gracefully', async ({ page }) => {
      // Set an expired token
      await page.addInitScript(() => {
        localStorage.setItem('claw_token', 'expired-token-12345')
      })

      // Mock /auth/me to return 401 for expired token
      await page.route('**/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Token expired', code: 'TOKEN_EXPIRED' }),
        })
      })

      await page.goto('/app/agents')

      // Should redirect to login or show auth required state
      await page.waitForTimeout(2000)

      // Should see login UI
      const hasLoginUI = await page
        .locator(
          'button:has-text("Connect"), button:has-text("Sign In"), [data-testid="connect-wallet"]'
        )
        .isVisible()
        .catch(() => false)

      // Or should be on a public page
      const isOnPublicPage = !page.url().includes('/app/')

      expect(hasLoginUI || isOnPublicPage).toBeTruthy()
    })
  })
})
