/**
 * E2E Test Fixtures
 *
 * Central export for all E2E test utilities and fixtures.
 */

// Authentication helpers
export {
  setupAuthenticatedUser,
  setupAuthenticatedAdmin,
  clearAuth,
  isAuthenticated,
  waitForAuth,
  navigateAuthenticated,
  navigateAsAdmin,
  TEST_USER,
  TEST_ADMIN,
} from './auth'

// Test data and API mocks
export {
  setupApiMocks,
  setupAdminApiMocks,
  waitForApiCall,
  generateTestId,
  TEST_IDS,
  TEST_AGENT,
  TEST_DEPLOYMENT,
  TEST_PROPOSAL,
  TEST_ALERT_RULE,
} from './test-data'

// Wallet mock (for future real wallet testing)
export {
  injectWalletMock,
  connectMockWallet,
  disconnectMockWallet,
  isMockWalletConnected,
  TEST_WALLET_ADDRESS,
} from './wallet-mock'
