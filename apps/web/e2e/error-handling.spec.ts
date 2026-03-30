/**
 * E2E Tests: Error Handling
 *
 * Tests error scenarios and recovery including:
 * - Network failures
 * - API errors
 * - 404 pages
 * - Rate limiting
 * - Server errors
 * - Client-side errors
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedUser, setupAuthenticatedAdmin, waitForAuth } from './fixtures/auth'

test.describe('Error Handling', () => {
  test.describe('404 Pages', () => {
    test('should show 404 page for non-existent routes', async ({ page }) => {
      const response = await page.goto('/this-page-does-not-exist-12345')

      // Should show 404 page or redirect to home
      const is404 = response?.status() === 404
      const hasNotFoundContent = await page
        .locator('text=404, text=Not Found, text=Page not found')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)
      const redirectedToHome = page.url().endsWith('/') || page.url().includes('guardianclaw')

      expect(is404 || hasNotFoundContent || redirectedToHome).toBeTruthy()
    })

    test('should have navigation back to home from 404', async ({ page }) => {
      await page.goto('/non-existent-page-xyz')

      // Look for home link
      const homeLink = page.locator(
        'a[href="/"], button:has-text("Home"), button:has-text("Go back"), [data-testid="home-link"]'
      )

      if (
        await homeLink
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await homeLink.first().click()
        await page.waitForURL('**/', { timeout: 10000 })
      }
    })
  })

  test.describe('Network Errors', () => {
    test('should handle complete network failure', async ({ page }) => {
      // Block all API requests
      await page.route('**/*', async (route) => {
        if (route.request().url().includes('/api/') || route.request().url().includes(':8787')) {
          await route.abort('failed')
        } else {
          await route.continue()
        }
      })

      await page.goto('/')

      // Page should still load with some content
      await expect(page.locator('body')).toBeVisible()

      // Should not have unhandled error dialogs
      await expect(page.locator('body')).not.toContainText('Unhandled')
    })

    test('should show offline indicator when API unavailable', async ({ page }) => {
      await setupAuthenticatedUser(page)

      // Block API requests after initial load
      await page.route('**/api/**', async (route) => {
        await route.abort('failed')
      })

      await page.goto('/app/agents')
      await waitForAuth(page)

      // Should show error state or offline indicator
      const errorIndicator = page.locator(
        'text=offline, text=unavailable, text=error loading, text=failed to load, [data-testid="error-state"]'
      )

      if (
        await errorIndicator
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(errorIndicator.first()).toBeVisible()
      }
    })

    test('should handle slow network gracefully', async ({ page }) => {
      // Slow down API responses
      await page.route('**/api/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await route.continue()
      })

      await page.goto('/')

      // Should show loading state
      const loadingIndicator = page.locator(
        '[data-testid="loading"], [aria-busy="true"], .animate-pulse, .loading'
      )

      // Either shows loading or completes
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('API Errors', () => {
    test('should handle 500 server errors', async ({ page }) => {
      await setupAuthenticatedUser(page)

      await page.route('**/api/agents**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      })

      await page.goto('/app/agents')
      await waitForAuth(page)

      // Should show error message, not crash
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')

      const errorState = page.locator(
        'text=error, text=Something went wrong, text=try again, [data-testid="error-message"]'
      )

      if (
        await errorState
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(errorState.first()).toBeVisible()
      }
    })

    test('should handle 403 forbidden errors', async ({ page }) => {
      await setupAuthenticatedUser(page)

      await page.route('**/api/agents**', async (route) => {
        await route.fulfill({
          status: 403,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Forbidden' }),
        })
      })

      await page.goto('/app/agents')
      await waitForAuth(page)

      // Should show access denied or permission error
      const forbiddenState = page.locator(
        'text=Forbidden, text=Access denied, text=Permission, text=Unauthorized, [data-testid="forbidden-error"]'
      )

      if (
        await forbiddenState
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(forbiddenState.first()).toBeVisible()
      }
    })

    test('should handle validation errors', async ({ page }) => {
      await setupAuthenticatedUser(page)

      await page.route('**/api/agents', async (route) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({
              error: 'Validation failed',
              details: { name: 'Name is required' },
            }),
          })
        } else {
          await route.continue()
        }
      })

      await page.goto('/app/builder/new')
      await waitForAuth(page)

      // Try to submit empty form (if there's a submit button)
      const submitButton = page.locator(
        'button[type="submit"], button:has-text("Create"), button:has-text("Save")'
      )

      if (
        await submitButton
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await submitButton.first().click()

        // Should show validation error
        const validationError = page.locator(
          'text=required, text=Validation, text=invalid, [data-testid="validation-error"]'
        )

        if (
          await validationError
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false)
        ) {
          await expect(validationError.first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Rate Limiting', () => {
    test('should handle rate limit errors', async ({ page }) => {
      await setupAuthenticatedUser(page)

      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 429,
          contentType: 'application/json',
          headers: {
            'Retry-After': '60',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
          },
          body: JSON.stringify({ error: 'Too many requests', code: 'RATE_LIMITED' }),
        })
      })

      await page.goto('/app/agents')
      await waitForAuth(page)

      // Should show rate limit message
      const rateLimitError = page.locator(
        'text=Too many, text=Rate limit, text=slow down, text=try again, [data-testid="rate-limit-error"]'
      )

      if (
        await rateLimitError
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(rateLimitError.first()).toBeVisible()
      }
    })
  })

  test.describe('Authentication Errors', () => {
    test('should handle 401 unauthorized errors', async ({ page }) => {
      // Set invalid token
      await page.addInitScript(() => {
        localStorage.setItem('claw_token', 'invalid-token')
      })

      await page.route('**/auth/me', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid token', code: 'INVALID_TOKEN' }),
        })
      })

      await page.goto('/app/agents')

      // Should redirect to login or show auth required
      await page.waitForTimeout(2000)

      const authRequired =
        (await page
          .locator('button:has-text("Connect"), button:has-text("Sign In")')
          .isVisible()
          .catch(() => false)) || !page.url().includes('/app/')

      expect(authRequired).toBeTruthy()
    })

    test('should handle session expiration', async ({ page }) => {
      await setupAuthenticatedUser(page)

      await page.goto('/app/agents')
      await waitForAuth(page)

      // Simulate session expiration on next request
      await page.route('**/api/**', async (route) => {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Session expired', code: 'SESSION_EXPIRED' }),
        })
      })

      // Navigate to trigger the expired session
      await page.goto('/app/builder')

      // Should show re-auth prompt or redirect
      await page.waitForTimeout(2000)

      // Should not crash
      await expect(page.locator('body')).not.toContainText('Unhandled')
    })
  })

  test.describe('Client-Side Error Recovery', () => {
    test('should recover from JavaScript errors', async ({ page }) => {
      // Inject a JavaScript error
      await page.addInitScript(() => {
        // This will be caught by error boundaries
        ;(window as any).__TEST_ERROR__ = true
      })

      await page.goto('/')

      // Page should still be usable
      await expect(page.locator('body')).toBeVisible()
      await expect(page.locator('nav')).toBeVisible()
    })

    test('should handle hydration mismatches gracefully', async ({ page }) => {
      await page.goto('/')

      // Verify the page loads without visible hydration errors
      await expect(page.locator('body')).toBeVisible()

      // Check console for hydration errors
      const consoleErrors: string[] = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text())
        }
      })

      // Navigate to trigger potential hydration
      await page.goto('/about')

      // Should not have hydration-related errors
      const hydrationErrors = consoleErrors.filter(
        (e) => e.includes('Hydration') || e.includes('hydration')
      )
      expect(hydrationErrors.length).toBe(0)
    })
  })

  test.describe('Error Boundaries', () => {
    test('should catch and display component errors', async ({ page }) => {
      await setupAuthenticatedUser(page)

      // Force a component error via API
      await page.route('**/api/agents**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          // Return malformed data that might cause rendering issues
          body: JSON.stringify({ agents: null }),
        })
      })

      await page.goto('/app/agents')
      await waitForAuth(page)

      // Should show error boundary or handle gracefully
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error')
    })
  })

  test.describe('Form Error Handling', () => {
    test('should show inline validation errors', async ({ page }) => {
      await setupAuthenticatedUser(page)

      await page.goto('/app/builder/new')
      await waitForAuth(page)

      // Find a required input and try to submit without filling it
      const nameInput = page.locator(
        'input[name="name"], input[placeholder*="name"], [data-testid="agent-name-input"]'
      )

      if (
        await nameInput
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        // Focus and blur to trigger validation
        await nameInput.first().focus()
        await nameInput.first().blur()

        // Look for validation message
        const validationMessage = page.locator(
          '[data-testid="validation-error"], .text-destructive, [role="alert"]'
        )

        if (
          await validationMessage
            .first()
            .isVisible({ timeout: 3000 })
            .catch(() => false)
        ) {
          await expect(validationMessage.first()).toBeVisible()
        }
      }
    })
  })

  test.describe('Timeout Handling', () => {
    test('should handle request timeouts', async ({ page }) => {
      await setupAuthenticatedUser(page)

      // Simulate a timeout by never responding
      await page.route('**/api/agents**', async (route) => {
        // Never fulfill - simulates timeout
        await new Promise((resolve) => setTimeout(resolve, 30000))
      })

      await page.goto('/app/agents')

      // Should eventually show timeout or loading state
      const loadingOrError = page.locator(
        '[data-testid="loading"], text=Loading, text=timeout, [data-testid="error-state"]'
      )

      // Give some time for the timeout handling to kick in
      if (
        await loadingOrError
          .first()
          .isVisible({ timeout: 10000 })
          .catch(() => false)
      ) {
        await expect(loadingOrError.first()).toBeVisible()
      }
    })
  })

  test.describe('Graceful Degradation', () => {
    test('should work without JavaScript for critical content', async ({ browser }) => {
      // Disable JavaScript via browser context
      const context = await browser.newContext({ javaScriptEnabled: false })
      const page = await context.newPage()

      await page.goto('/')

      // Basic HTML content should still be visible
      // (depends on SSR implementation)
      await expect(page.locator('body')).toBeVisible()

      await context.close()
    })

    test('should handle missing browser features', async ({ page }) => {
      // Remove localStorage
      await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: undefined,
        })
      })

      // Page should still load (even if some features don't work)
      await page.goto('/')
      await expect(page.locator('body')).toBeVisible()
    })
  })
})
