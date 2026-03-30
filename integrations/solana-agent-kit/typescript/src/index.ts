/**
 * @guardianclaw/solana-agent-kit
 *
 * GuardianClaw Safety Plugin for Solana Agent Kit
 *
 * Provides AI safety validation for Solana transactions using the
 * CLAW (Credibility-Limits-Avoidance-Worth) protocol. Protects AI agents from
 * executing harmful, unauthorized, or suspicious transactions.
 *
 * @packageDocumentation
 *
 * @example Basic Usage
 * ```typescript
 * import { SolanaAgentKit } from "solana-agent-kit";
 * import GuardianClawPlugin from "@guardianclaw/solana-agent-kit";
 *
 * const agent = new SolanaAgentKit(privateKey, rpcUrl)
 *   .use(GuardianClawPlugin());
 *
 * // All transactions now pass through CLAW validation
 * ```
 *
 * @example With Configuration
 * ```typescript
 * const agent = new SolanaAgentKit(privateKey, rpcUrl)
 *   .use(GuardianClawPlugin({
 *     maxTransactionAmount: 100,
 *     confirmationThreshold: 10,
 *     requirePurposeFor: ["transfer", "swap", "stake"],
 *     strictMode: false,
 *   }));
 * ```
 *
 * @example Manual Validation
 * ```typescript
 * const result = await agent.methods.validateTransaction({
 *   action: "transfer",
 *   amount: 50,
 *   recipient: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
 *   worth: "Payment for NFT purchase",
 * });
 *
 * if (result.shouldProceed) {
 *   // Safe to execute
 * } else {
 *   console.log("Blocked:", result.concerns);
 * }
 * ```
 */

// Main plugin export
export { GuardianClawPlugin, default } from "./plugin";
export type { GuardianClawMethods } from "./plugin";

// Validator for direct use
export { ClawValidator, createValidator } from "./tools/validator";

// Actions for custom integrations
export {
  validateTransactionAction,
  checkSafetyAction,
  getSafetyStatsAction,
  blockAddressAction,
  unblockAddressAction,
  clawActions,
} from "./actions";

// Types
export {
  RiskLevel,
  CLAWGate,
  AddressValidationMode,
  DEFAULT_CONFIG,
  HIGH_RISK_ACTIONS,
  DEFAULT_SUSPICIOUS_PATTERNS,
} from "./types";

export type {
  SafetyValidationResult,
  ValidationInput,
  ValidationStats,
  GuardianClawPluginConfig,
  GateResult,
  SuspiciousPattern,
  SeedVariant,
} from "./types";
