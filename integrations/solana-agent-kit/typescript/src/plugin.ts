/**
 * GuardianClaw Safety Plugin for Solana Agent Kit
 *
 * This plugin provides AI safety validation for Solana transactions
 * using the CLAW (Credibility-Limits-Avoidance-Worth) protocol.
 *
 * @example
 * ```typescript
 * import { SolanaAgentKit } from "solana-agent-kit";
 * import GuardianClawPlugin from "@guardianclaw/solana-agent-kit";
 *
 * const agent = new SolanaAgentKit(privateKey, rpcUrl)
 *   .use(GuardianClawPlugin({
 *     maxTransactionAmount: 100,
 *     requirePurposeFor: ["transfer", "swap"],
 *   }));
 *
 * // Validate before transactions
 * const result = await agent.methods.validateTransaction({
 *   action: "transfer",
 *   amount: 50,
 *   recipient: "...",
 *   worth: "Payment for services",
 * });
 * ```
 */

import type { Plugin, SolanaAgentKit } from "solana-agent-kit";
import { ClawValidator } from "./tools/validator";
import {
  validateTransaction,
  checkSafety,
  getSafetyStatus,
  blockAddress,
  unblockAddress,
  clearValidationHistory,
  updateSafetyConfig,
  setSharedValidator,
} from "./tools/functions";
import {
  clawActions,
  setValidatorForValidate,
  setValidatorForCheck,
  setValidatorForStats,
  setValidatorForBlock,
} from "./actions";
import type { GuardianClawPluginConfig } from "./types";

/**
 * GuardianClaw Plugin Methods
 *
 * These methods are added to agent.methods when the plugin is registered.
 */
export interface GuardianClawMethods {
  validateTransaction: typeof validateTransaction;
  checkSafety: typeof checkSafety;
  getSafetyStatus: typeof getSafetyStatus;
  blockAddress: typeof blockAddress;
  unblockAddress: typeof unblockAddress;
  clearValidationHistory: typeof clearValidationHistory;
  updateSafetyConfig: typeof updateSafetyConfig;
}

/**
 * Create the GuardianClaw safety plugin
 *
 * @param config - Plugin configuration options
 * @returns Plugin instance ready for registration with SolanaAgentKit
 *
 * @example
 * ```typescript
 * const agent = new SolanaAgentKit(privateKey, rpcUrl)
 *   .use(GuardianClawPlugin({
 *     maxTransactionAmount: 100,
 *     strictMode: false,
 *   }));
 * ```
 */
export function GuardianClawPlugin(config: GuardianClawPluginConfig = {}): Plugin {
  // Create single validator instance for the entire plugin
  const validator = new ClawValidator(config);

  return {
    name: "claw",

    methods: {
      validateTransaction,
      checkSafety,
      getSafetyStatus,
      blockAddress,
      unblockAddress,
      clearValidationHistory,
      updateSafetyConfig,
    },

    actions: clawActions,

    initialize(agent: SolanaAgentKit): void {
      // Initialize validator with agent instance
      validator.initialize(agent);

      // Share the SAME validator instance with all functions and actions
      // This ensures consistent state across the entire plugin
      setSharedValidator(validator);
      setValidatorForValidate(validator);
      setValidatorForCheck(validator);
      setValidatorForStats(validator);
      setValidatorForBlock(validator);
    },
  } satisfies Plugin;
}

/**
 * Default export for convenient import
 *
 * @example
 * ```typescript
 * import GuardianClawPlugin from "@guardianclaw/solana-agent-kit";
 * ```
 */
export default GuardianClawPlugin;
