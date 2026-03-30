/**
 * Authentication Helpers for E2E Tests
 *
 * Provides utilities for testing authenticated flows.
 * Uses API route interception to simulate authenticated state.
 */

import { Page, BrowserContext, expect } from '@playwright/test'

// Test user configuration
export const TEST_USER = {
  wallet: 'E2ETestWa11etAddress1111111111111111111111111',
  displayName: 'E2E Test User',
  plan: 'pro' as const,
  token: 'e2e-test-jwt-token-' + Date.now(),
}

// Admin test user
export const TEST_ADMIN = {
  wallet: 'E2EAdminWa11etAddress11111111111111111111111',
  displayName: 'E2E Admin User',
  role: 'super_admin' as const,
  token: 'e2e-admin-jwt-token-' + Date.now(),
}

/**
 * Profile response for API mocking
 */
function createProfileResponse(user: typeof TEST_USER | typeof TEST_ADMIN) {
  return {
    profile: {
      wallet_address: user.wallet,
      display_name: user.displayName,
      avatar_url: null,
      plan: 'plan' in user ? user.plan : 'pro',
      plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    },
  }
}

/**
 * Setup authenticated state for a regular user
 * Uses localStorage and API mocking
 */
export async function setupAuthenticatedUser(page: Page): Promise<void> {
  // Set token in localStorage before navigation
  await page.addInitScript((token) => {
    localStorage.setItem('claw_token', token)
  }, TEST_USER.token)

  // Mock the /auth/me endpoint to return test user profile
  await page.route('**/auth/me', async (route) => {
    const headers = route.request().headers()
    const authHeader = headers['authorization']

    // Check if request has our test token
    if (authHeader?.includes(TEST_USER.token) || authHeader?.includes(TEST_ADMIN.token)) {
      const user = authHeader.includes(TEST_ADMIN.token) ? TEST_ADMIN : TEST_USER
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createProfileResponse(user)),
      })
    } else {
      // Let unauthenticated requests through normally
      await route.continue()
    }
  })
}

/**
 * Setup authenticated state for an admin user
 */
export async function setupAuthenticatedAdmin(page: Page): Promise<void> {
  // Set admin token in localStorage
  await page.addInitScript((token) => {
    localStorage.setItem('claw_token', token)
  }, TEST_ADMIN.token)

  // Mock /auth/me for admin
  await page.route('**/auth/me', async (route) => {
    const headers = route.request().headers()
    const authHeader = headers['authorization']

    if (authHeader?.includes(TEST_ADMIN.token)) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createProfileResponse(TEST_ADMIN)),
      })
    } else {
      await route.continue()
    }
  })

  // Mock admin role check endpoint
  await page.route('**/admin/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        is_admin: true,
        role: TEST_ADMIN.role,
        permissions: {
          dashboards: ['operations', 'business', 'financial', 'security', 'analytics', 'system'],
          actions: [
            'view_users',
            'modify_users',
            'view_agents',
            'modify_agents',
            'view_alerts',
            'manage_alerts',
            'view_config',
            'modify_config',
            'view_governance',
            'manage_governance',
            'view_financial',
            'manage_financial',
          ],
        },
      }),
    })
  })
}

/**
 * Clear authenticated state
 */
export async function clearAuth(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('claw_token')
  })
}

/**
 * Check if user is authenticated by verifying UI state
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  try {
    // Look for authenticated UI indicators
    const profileButton = page.locator('[data-testid="user-menu"], [data-testid="profile-button"]')
    const connectButton = page.locator('button:has-text("Connect"), button:has-text("Login")')

    // If profile button is visible, user is authenticated
    if (await profileButton.isVisible({ timeout: 1000 })) {
      return true
    }

    // If connect button is visible, user is not authenticated
    if (await connectButton.isVisible({ timeout: 1000 })) {
      return false
    }

    return false
  } catch {
    return false
  }
}

/**
 * Wait for authentication to complete
 */
export async function waitForAuth(page: Page, options?: { timeout?: number }): Promise<void> {
  const timeout = options?.timeout ?? 10000

  // Wait for loading state to finish
  await page.waitForFunction(
    () => {
      // Check if auth provider has finished loading
      const loading = document.querySelector('[data-auth-loading="true"]')
      return !loading
    },
    { timeout }
  )
}

/**
 * Navigate to page with authentication
 */
export async function navigateAuthenticated(page: Page, path: string): Promise<void> {
  await setupAuthenticatedUser(page)
  await page.goto(path)
  await waitForAuth(page)
}

/**
 * Navigate to admin page with admin authentication
 */
export async function navigateAsAdmin(page: Page, path: string): Promise<void> {
  await setupAuthenticatedAdmin(page)
  await page.goto(path)
  await waitForAuth(page)
}
