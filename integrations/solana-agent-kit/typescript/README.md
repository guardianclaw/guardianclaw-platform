# @guardianclaw/solana-agent-kit

[![npm version](https://img.shields.io/npm/v/@guardianclaw/solana-agent-kit)](https://www.npmjs.com/package/@guardianclaw/solana-agent-kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**GuardianClaw Safety Plugin for Solana Agent Kit**: AI safety validation for Solana transactions using the CLAW protocol.

Protect your AI agents from executing harmful, unauthorized, or suspicious transactions on Solana.

> Validated against `solana-agent-kit@2.0.10` and `@solana/web3.js@1.98.4` on 2026-04-24.

## Features

- **CLAW Protocol**: Four-gate validation (Credibility, Limits, Avoidance, Worth)
- **Transaction Limits**: Configurable max amounts and confirmation thresholds
- **Address Blocklist**: Block known scam addresses
- **Purpose Verification**: Require explicit justification for sensitive operations
- **Pattern Detection**: Catch suspicious transaction patterns
- **LLM Actions**: Native integration with Solana Agent Kit action system
- **Statistics**: Track validation history and block rates

## Installation

```bash
npm install @guardianclaw/solana-agent-kit
```

**Peer Dependencies:**
```bash
npm install solana-agent-kit @solana/web3.js
```

## Quick Start

```typescript
import { SolanaAgentKit } from "solana-agent-kit";
import GuardianClawPlugin from "@guardianclaw/solana-agent-kit";

const agent = new SolanaAgentKit(privateKey, rpcUrl)
  .use(GuardianClawPlugin());

// Validate before any transaction
const result = await agent.methods.validateTransaction({
  action: "transfer",
  amount: 50,
  recipient: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  purpose: "Payment for NFT purchase",
});

if (result.shouldProceed) {
  // Safe to execute
} else {
  console.log("Blocked:", result.concerns);
}
```

## Configuration

```typescript
import GuardianClawPlugin from "@guardianclaw/solana-agent-kit";

const agent = new SolanaAgentKit(privateKey, rpcUrl)
  .use(GuardianClawPlugin({
    // Maximum amount per transaction (default: 100)
    maxTransactionAmount: 100,

    // Require confirmation above this amount (default: 10)
    confirmationThreshold: 10,

    // Actions requiring explicit purpose (default shown)
    requirePurposeFor: ["transfer", "swap", "approve", "bridge", "withdraw", "stake"],

    // Block all transactions with any concerns (default: false)
    strictMode: false,

    // Known scam addresses to block
    blockedAddresses: [
      "ScamWa11etAddress111111111111111111111111111",
    ],

    // Only allow these programs (empty = all allowed)
    allowedPrograms: [],

    // Custom patterns to detect
    customPatterns: [
      {
        name: "high_slippage",
        pattern: /slippage.*(?:[5-9]\d|100)%/i,
        riskLevel: "high",
        message: "High slippage tolerance detected",
      },
    ],

    // Callback for monitoring
    onValidation: (result) => {
      console.log(`[GuardianClaw] ${result.metadata.action}: ${result.riskLevel}`);
    },
  }));
```

## CLAW Protocol

Every transaction is validated against four gates:

| Gate | Question | Checks |
|------|----------|--------|
| **Truth** | Is the data accurate? | Address format, valid amounts, program IDs |
| **Harm** | Could this cause damage? | Blocked addresses, high-risk actions, program whitelist |
| **Scope** | Is this within limits? | Amount limits, rate limits |
| **Purpose** | Is there legitimate benefit? | Explicit justification for sensitive operations |

All gates must pass for a transaction to be approved.

## Available Actions

These actions are automatically available when using the plugin:

### VALIDATE_TRANSACTION

Full validation with detailed gate analysis.

```typescript
const result = await agent.methods.validateTransaction({
  action: "transfer",
  amount: 50,
  recipient: "...",
  purpose: "Payment for services",
});

// Returns:
{
  safe: boolean,
  shouldProceed: boolean,
  requiresConfirmation: boolean,
  riskLevel: "low" | "medium" | "high" | "critical",
  concerns: string[],
  recommendations: string[],
  gateResults: [
    { gate: "credibility", passed: true },
    { gate: "avoidance", passed: true },
    { gate: "limits", passed: true },
    { gate: "worth", passed: true },
  ],
}
```

### CHECK_SAFETY

Quick pass/fail check.

```typescript
const isSafe = await agent.methods.checkSafety("transfer", 10, recipient);
```

### GET_SAFETY_STATS

Validation statistics and configuration.

```typescript
const status = await agent.methods.getSafetyStatus();
console.log(status.stats.blockRate); // e.g., 0.05 (5%)
```

### BLOCK_ADDRESS / UNBLOCK_ADDRESS

Manage the address blocklist.

```typescript
await agent.methods.blockAddress("ScamAddress...");
await agent.methods.unblockAddress("VerifiedAddress...");
```

## Risk Levels

| Level | Description | Action |
|-------|-------------|--------|
| `low` | No concerns detected | Proceed |
| `medium` | Minor concerns | Proceed with caution |
| `high` | Significant concerns | Review carefully |
| `critical` | Serious issues detected | Blocked |

## Default Suspicious Patterns

The plugin detects these patterns automatically:

- **Drain operations**: `drain`, `sweep`, `empty`
- **Unlimited approvals**: `unlimited`, `infinite approval`
- **Bulk transfers**: `transfer all`, `send entire`
- **Private key exposure**: `private key`, `seed phrase`, `mnemonic`
- **Suspicious urgency**: `urgent`, `immediately`, `asap`

## API Reference

### GuardianClawPlugin(config?)

Creates the plugin instance.

### ClawValidator

Core validation engine, available for direct use:

```typescript
import { ClawValidator } from "@guardianclaw/solana-agent-kit";

const validator = new ClawValidator({
  maxTransactionAmount: 100,
});

const result = validator.validate({
  action: "transfer",
  amount: 50,
  recipient: "...",
});
```

### Types

```typescript
import type {
  SafetyValidationResult,
  ValidationInput,
  GuardianClawPluginConfig,
  RiskLevel,
  CLAWGate,
} from "@guardianclaw/solana-agent-kit";
```

## Examples

See the [examples](./examples) directory:

- `basic-usage.ts` - Simple integration
- `defi-safety.ts` - DeFi-specific configuration

## Why GuardianClaw?

AI agents executing blockchain transactions face unique risks:

1. **Prompt Injection**: Malicious inputs can trick agents into harmful actions
2. **Memory Manipulation**: Attackers can inject false context
3. **Excessive Autonomy**: Agents may execute unintended transactions
4. **Missing Intent Verification**: No check for legitimate purpose

GuardianClaw addresses these by requiring every transaction to pass through the CLAW validation protocol before execution.

## Links

- **Website**: [guardianclaw.org](https://guardianclaw.org)
- **Documentation**: [guardianclaw.org/docs](https://guardianclaw.org/docs)
- **GitHub**: [guardian-claw/guardianclaw](https://github.com/guardian-claw/guardianclaw/tree/main/packages/solana-agent-kit/typescript)
- **npm**: [@guardianclaw/solana-agent-kit](https://www.npmjs.com/package/@guardianclaw/solana-agent-kit)
- **Contact**: [contact@guardianclaw.org](mailto:contact@guardianclaw.org)

## License

MIT License - see [LICENSE](./LICENSE)

---

Built by [GuardianClaw Team](https://guardianclaw.org) | [contact@guardianclaw.org](mailto:contact@guardianclaw.org)
