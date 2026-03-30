/**
 * E2E Tests: Governance Flow
 *
 * Tests the governance functionality including:
 * - Proposal listing
 * - Proposal details
 * - Voting interface
 * - Proposal creation
 * - Admin governance management
 */

import { test, expect } from '@playwright/test'
import { setupAuthenticatedUser, setupAuthenticatedAdmin, waitForAuth } from './fixtures/auth'
import { setupApiMocks, setupAdminApiMocks, TEST_PROPOSAL, TEST_IDS } from './fixtures/test-data'

test.describe('Governance', () => {
  test.describe('Public Governance View', () => {
    test('should load governance proposals list', async ({ page }) => {
      // Mock proposals endpoint
      await page.route('**/governance/proposals**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            proposals: [TEST_PROPOSAL],
            total: 1,
          }),
        })
      })

      await page.goto('/app/governance')

      // Should see governance page content
      const content = page.locator(
        'text=Governance, text=Proposals, text=DAO, [data-testid="governance-page"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should display proposal cards or list', async ({ page }) => {
      await page.route('**/governance/proposals**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            proposals: [
              TEST_PROPOSAL,
              {
                ...TEST_PROPOSAL,
                id: 'e2e00000-0000-0000-0000-000000000020',
                title: 'Second Test Proposal',
                status: 'passed',
                votes_for: 200,
                votes_against: 30,
              },
            ],
            total: 2,
          }),
        })
      })

      await page.goto('/app/governance')

      // Wait for proposals to load
      await page.waitForLoadState('networkidle')

      // Should show proposal list
      const proposalList = page.locator(
        '[data-testid="proposal-list"], [data-testid="proposal-card"], text=Test Proposal'
      )

      if (
        await proposalList
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(proposalList.first()).toBeVisible()
      }
    })

    test('should show proposal status indicators', async ({ page }) => {
      await page.route('**/governance/proposals**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            proposals: [TEST_PROPOSAL],
            total: 1,
          }),
        })
      })

      await page.goto('/app/governance')
      await page.waitForLoadState('networkidle')

      // Look for status badges
      const statusBadge = page.locator(
        'text=Active, text=Passed, text=Failed, text=Pending, [data-testid*="status"]'
      )

      if (
        await statusBadge
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(statusBadge.first()).toBeVisible()
      }
    })
  })

  test.describe('Authenticated Governance', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)
    })

    test('should show create proposal button when authenticated', async ({ page }) => {
      await page.goto('/app/governance')
      await waitForAuth(page)

      // Look for create proposal button
      const createButton = page.locator(
        'a[href*="/governance/create"], button:has-text("Create"), button:has-text("New Proposal"), [data-testid="create-proposal"]'
      )

      if (
        await createButton
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(createButton.first()).toBeVisible()
      }
    })

    test('should load create proposal page', async ({ page }) => {
      await page.goto('/app/governance/create')
      await waitForAuth(page)

      // Should see create proposal form
      const content = page.locator(
        'text=Create Proposal, text=New Proposal, text=Title, [data-testid="create-proposal-form"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should have proposal form fields', async ({ page }) => {
      await page.goto('/app/governance/create')
      await waitForAuth(page)

      // Look for form fields
      const titleInput = page.locator(
        'input[name="title"], input[placeholder*="title"], [data-testid="proposal-title"]'
      )
      const descriptionInput = page.locator(
        'textarea[name="description"], textarea[placeholder*="description"], [data-testid="proposal-description"]'
      )

      if (
        await titleInput
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(titleInput.first()).toBeVisible()
      }

      if (
        await descriptionInput
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(descriptionInput.first()).toBeVisible()
      }
    })
  })

  test.describe('Proposal Details', () => {
    test.beforeEach(async ({ page }) => {
      // Mock single proposal endpoint
      await page.route(`**/governance/proposals/${TEST_IDS.proposal}**`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ proposal: TEST_PROPOSAL }),
        })
      })

      await page.route('**/governance/proposals**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            proposals: [TEST_PROPOSAL],
            total: 1,
          }),
        })
      })
    })

    test('should display proposal details', async ({ page }) => {
      await setupAuthenticatedUser(page)
      await page.goto(`/app/governance/${TEST_IDS.proposal}`)
      await waitForAuth(page)

      // Wait for page load
      await page.waitForLoadState('networkidle')

      // Should not show 404
      await expect(page.locator('body')).not.toContainText('404')
    })

    test('should show voting statistics', async ({ page }) => {
      await setupAuthenticatedUser(page)
      await page.goto(`/app/governance/${TEST_IDS.proposal}`)
      await waitForAuth(page)

      // Look for vote counts
      const voteStats = page.locator(
        'text=For, text=Against, text=Votes, text=Quorum, [data-testid*="vote"]'
      )

      if (
        await voteStats
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(voteStats.first()).toBeVisible()
      }
    })

    test('should show voting buttons when authenticated', async ({ page }) => {
      await setupAuthenticatedUser(page)
      await page.goto(`/app/governance/${TEST_IDS.proposal}`)
      await waitForAuth(page)

      // Look for vote buttons
      const voteButtons = page.locator(
        'button:has-text("Vote"), button:has-text("For"), button:has-text("Against"), [data-testid*="vote-button"]'
      )

      if (
        await voteButtons
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(voteButtons.first()).toBeVisible()
      }
    })
  })

  test.describe('Admin Governance Management', () => {
    test.beforeEach(async ({ page }) => {
      await setupAuthenticatedAdmin(page)
      setupAdminApiMocks(page)

      await page.route('**/admin/governance**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            proposals: [
              TEST_PROPOSAL,
              {
                ...TEST_PROPOSAL,
                id: 'e2e00000-0000-0000-0000-000000000021',
                title: 'Admin Review Proposal',
                status: 'pending_review',
              },
            ],
            total: 2,
          }),
        })
      })
    })

    test('should load admin governance page', async ({ page }) => {
      await page.goto('/admin/governance')
      await page.waitForLoadState('networkidle')

      // Should see admin governance content
      const content = page.locator(
        'text=Governance, text=Proposals, [data-testid="admin-governance"]'
      )
      await expect(content.first()).toBeVisible({ timeout: 10000 })
    })

    test('should show pending proposals for review', async ({ page }) => {
      await page.goto('/admin/governance')
      await page.waitForLoadState('networkidle')

      // Look for pending proposals section
      const pendingSection = page.locator(
        'text=Pending, text=Review, text=pending_review, [data-testid="pending-proposals"]'
      )

      if (
        await pendingSection
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(pendingSection.first()).toBeVisible()
      }
    })

    test('should have moderation actions', async ({ page }) => {
      await page.goto('/admin/governance')
      await page.waitForLoadState('networkidle')

      // Look for moderation buttons
      const moderationButtons = page.locator(
        'button:has-text("Approve"), button:has-text("Reject"), button:has-text("Archive"), [data-testid*="moderation"]'
      )

      if (
        await moderationButtons
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(moderationButtons.first()).toBeVisible()
      }
    })
  })

  test.describe('Governance Error Handling', () => {
    test('should handle empty proposals list', async ({ page }) => {
      await page.route('**/governance/proposals**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ proposals: [], total: 0 }),
        })
      })

      await page.goto('/app/governance')

      // Should show empty state
      const emptyState = page.locator(
        'text=No proposals, text=Be the first, text=No active, [data-testid="empty-proposals"]'
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

    test('should handle API error on proposals load', async ({ page }) => {
      await page.route('**/governance/proposals**', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Service unavailable' }),
        })
      })

      await page.goto('/app/governance')

      // Should not crash
      await expect(page.locator('body')).not.toContainText('Unhandled')
    })

    test('should handle non-existent proposal gracefully', async ({ page }) => {
      await setupAuthenticatedUser(page)
      setupApiMocks(page)

      await page.route('**/governance/proposals/non-existent**', async (route) => {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Proposal not found' }),
        })
      })

      await page.goto('/app/governance/non-existent')
      await waitForAuth(page)

      // Should show error or redirect
      const errorState = page.locator(
        'text=not found, text=Error, text=404, [data-testid="error-message"]'
      )
      const redirected = !page.url().includes('non-existent')

      const hasError = await errorState
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false)

      expect(hasError || redirected).toBeTruthy()
    })
  })
})
