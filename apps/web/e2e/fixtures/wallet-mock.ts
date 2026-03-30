/**
 * Solana Wallet Mock for E2E Tests
 *
 * Provides a mock implementation of Solana wallet adapter for Playwright tests.
 * This allows testing authenticated flows without requiring a real wallet.
 *
 * Note: This mock doesn't use actual cryptographic signing.
 * For E2E tests, we rely on API route interception to simulate authentication.
 */

import { Page } from '@playwright/test'

// Test wallet address (looks like a valid Solana address format)
export const TEST_WALLET_ADDRESS = 'E2ETestWa11etAddress1111111111111111111111111'

/**
 * Inject wallet mock into the page
 * This sets up a mock wallet state that can be checked by the app
 */
export async function injectWalletMock(page: Page): Promise<void> {
  await page.addInitScript((walletAddress) => {
    // Store mock state in window
    ;(window as any).__TEST_WALLET__ = {
      connected: false,
      publicKey: walletAddress,
    }

    // Override wallet adapter detection
    ;(window as any).__WALLET_STANDARD_WALLETS__ = [
      {
        name: 'E2E Test Wallet',
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">T</text></svg>',
        publicKey: walletAddress,
      },
    ]
  }, TEST_WALLET_ADDRESS)
}

/**
 * Connect the mock wallet
 * Simulates user clicking "Connect Wallet" and selecting a wallet
 */
export async function connectMockWallet(page: Page): Promise<void> {
  await page.evaluate((walletAddress) => {
    const testWallet = (window as any).__TEST_WALLET__
    if (testWallet) {
      testWallet.connected = true

      // Dispatch custom event to notify React of wallet connection
      window.dispatchEvent(
        new CustomEvent('wallet-connected', {
          detail: { publicKey: walletAddress },
        })
      )
    }
  }, TEST_WALLET_ADDRESS)
}

/**
 * Disconnect the mock wallet
 */
export async function disconnectMockWallet(page: Page): Promise<void> {
  await page.evaluate(() => {
    const testWallet = (window as any).__TEST_WALLET__
    if (testWallet) {
      testWallet.connected = false

      window.dispatchEvent(new CustomEvent('wallet-disconnected'))
    }
  })
}

/**
 * Check if mock wallet is connected
 */
export async function isMockWalletConnected(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const testWallet = (window as any).__TEST_WALLET__
    return testWallet?.connected ?? false
  })
}
