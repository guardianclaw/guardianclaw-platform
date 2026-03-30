/**
 * GuardianClaw Tools for Solana Agent Kit
 *
 * These tools provide safety validation functionality that can be
 * registered with the SolanaAgentKit plugin system.
 */

export { ClawValidator, createValidator } from "./validator";
export {
  validateTransaction,
  checkSafety,
  getSafetyStatus,
  blockAddress,
  unblockAddress,
  clearValidationHistory,
  updateSafetyConfig,
  initializeValidator,
  setSharedValidator,
  isValidatorInitialized,
} from "./functions";
