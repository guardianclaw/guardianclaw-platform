# Phase 2 Preparation: Crypto Integrations

> **Date:** 2026-01-09
> **Phase:** Crypto Integrations (Coinbase, Solana)
> **Status:** READY TO START

---

## Overview

Phase 2 implements crypto-specific integration handlers for:
1. **Coinbase AgentKit** - x402 payment validation with spending limits
2. **Solana Agent Kit** - Transaction validation with wallet protection

---

## Existing guardianclaw Integrations

The guardianclaw SDK already has comprehensive integrations at:

### Coinbase x402 Integration
**Location:** `guardianclaw/src/guardianclaw/integrations/coinbase/x402/`

Files:
- `agentkit_provider.py` - GuardianClawX402ActionProvider for AgentKit
- `config.py` - SpendingLimits, ValidationConfig, GuardianClawX402Config
- `middleware.py` - GuardianClawX402Middleware for validation
- `types.py` - PaymentDecision, PaymentRiskLevel, etc.
- `schemas.py` - Pydantic schemas for actions

**Key Classes:**
```python
# GuardianClawX402ActionProvider - ActionProvider for AgentKit
from guardianclaw.integrations.coinbase.x402 import (
    GuardianClawX402ActionProvider,
    claw_x402_action_provider,
    GuardianClawX402Config,
    get_default_config,
)

# Usage with AgentKit
provider = claw_x402_action_provider(security_profile="strict")
agent = AgentKit(action_providers=[provider])
```

**Actions Provided:**
| Action | Description |
|--------|-------------|
| `claw_x402_validate_payment` | Validate payment with CLAW gates |
| `claw_x402_get_spending_summary` | Get spending statistics |
| `claw_x402_configure_limits` | Configure spending limits |
| `claw_x402_check_endpoint` | Check endpoint safety |
| `claw_x402_get_audit_log` | Get payment audit log |
| `claw_x402_reset_spending` | Reset spending records |

---

## Configuration Models

### SpendingLimits
```python
@dataclass
class SpendingLimits:
    max_single_payment: float = 100.0      # USD
    max_daily_total: float = 500.0         # USD
    max_weekly_total: float = 2000.0       # USD
    max_monthly_total: float = 5000.0      # USD
    max_transactions_per_day: int = 50
    max_transactions_per_hour: int = 10
```

### ConfirmationThresholds
```python
@dataclass
class ConfirmationThresholds:
    amount_threshold: float = 10.0         # USD
    unknown_endpoint_threshold: float = 5.0
    new_recipient_threshold: float = 5.0
    high_risk_threshold: float = 1.0
```

### Security Profiles
| Profile | max_single | max_daily | Description |
|---------|------------|-----------|-------------|
| permissive | $1000 | $5000 | Minimal restrictions |
| standard | $100 | $500 | Balanced |
| strict | $25 | $100 | Higher security |
| paranoid | $10 | $50 | Maximum security |

---

## TypeScript Types (Already Defined)

### CoinbaseConfig
```typescript
interface CoinbaseConfig extends BaseIntegrationConfig {
  spending_limits?: SpendingLimits
  blocked_addresses?: string[]
  blocked_tokens?: string[]
  fiduciary_enabled?: boolean
  user_context?: UserContext
  validate_before_sign?: boolean
  block_unlimited_approvals?: boolean
}
```

### SolanaConfig
```typescript
interface SolanaConfig extends BaseIntegrationConfig {
  spending_limits?: SpendingLimits
  blocked_addresses?: string[]
  fiduciary_enabled?: boolean
  user_context?: UserContext
  memory_integrity_check?: boolean
  memory_secret_key?: string
  slippage_tolerance?: number
  priority_fee_cap?: number
}
```

---

## Implementation Plan

### Phase 2A: Coinbase Handler

**File:** `packages/runtime/claw_runtime/integrations/coinbase_handler.py`

```python
class CoinbaseHandler(BaseIntegrationHandler):
    FRAMEWORK = "coinbase"

    def __init__(self, config: IntegrationConfig):
        super().__init__(config)
        self._security_profile = config.get("security_profile", "standard")
        self._spending_limits = SpendingLimits(**config.get("spending_limits", {}))

    def get_action_provider(self) -> GuardianClawX402ActionProvider:
        """Get configured x402 action provider for AgentKit."""
        return claw_x402_action_provider(
            security_profile=self._security_profile,
        )

    def validate_payment(self, endpoint: str, amount: float, ...) -> ValidationResult:
        """Validate a payment before execution."""
        # Use middleware from guardianclaw

    def get_spending_summary(self, wallet: str) -> dict:
        """Get spending summary for wallet."""
```

### Phase 2B: Solana Handler

**File:** `packages/runtime/claw_runtime/integrations/solana_handler.py`

```python
class SolanaHandler(BaseIntegrationHandler):
    FRAMEWORK = "solana_agent_kit"

    def __init__(self, config: IntegrationConfig):
        super().__init__(config)
        self._spending_limits = SpendingLimits(**config.get("spending_limits", {}))
        self._slippage_tolerance = config.get("slippage_tolerance", 1.0)

    def validate_transaction(self, tx: Transaction) -> ValidationResult:
        """Validate a Solana transaction before signing."""

    def wrap_wallet(self, wallet: Keypair) -> ProtectedWallet:
        """Wrap a wallet with GuardianClaw protection."""
```

---

## UI Components

### Coinbase Properties Panel
```
┌─────────────────────────────────────┐
│ Coinbase AgentKit Configuration     │
├─────────────────────────────────────┤
│ Security Profile: [Standard ▼]      │
│                                     │
│ ── Spending Limits ──               │
│ Max Single Transaction: [$100    ]  │
│ Max Daily Total:        [$500    ]  │
│ Confirmation Above:     [$10     ]  │
│                                     │
│ ── Security ──                      │
│ [✓] Block Unlimited Approvals       │
│ [✓] Validate Before Sign            │
│ [✓] Fiduciary Mode                  │
│                                     │
│ ── Blocked Addresses ──             │
│ [Add Address] [Import Blocklist]    │
└─────────────────────────────────────┘
```

### Solana Properties Panel
```
┌─────────────────────────────────────┐
│ Solana Agent Kit Configuration      │
├─────────────────────────────────────┤
│ ── Spending Limits ──               │
│ Max Single Transaction: [$100    ]  │
│ Max Daily Total:        [$500    ]  │
│                                     │
│ ── DeFi Settings ──                 │
│ Slippage Tolerance:     [1.0%    ]  │
│ Priority Fee Cap:       [10000 ◊ ]  │
│                                     │
│ ── Security ──                      │
│ [✓] Fiduciary Mode                  │
│ [ ] Memory Integrity Check          │
│                                     │
│ ── Blocked Addresses ──             │
│ [Add Address]                       │
└─────────────────────────────────────┘
```

---

## Test Strategy

### Unit Tests
- SpendingLimits validation
- Blocked address filtering
- Payment validation with CLAW gates
- Transaction wrapping

### Integration Tests
- Mock Coinbase AgentKit interaction
- Mock Solana Agent Kit interaction
- Full flow: config → validate → execute

### Visual Tests
- `/test/coinbase-properties` - Coinbase panel
- `/test/solana-properties` - Solana panel

---

## Dependencies

### Python (packages/runtime)
```python
# Already in guardianclaw
coinbase_agentkit  # Coinbase AgentKit SDK
solana-py          # Solana Python SDK

# May need to add
solana-agent-kit   # If Python bindings available
```

### TypeScript (apps/web)
```typescript
// Already in package.json
@solana/web3.js
@coinbase/wallet-sdk
```

---

## Files to Create

| File | Description |
|------|-------------|
| `coinbase_handler.py` | Coinbase AgentKit handler |
| `solana_handler.py` | Solana Agent Kit handler |
| `coinbase-properties.tsx` | Coinbase config panel |
| `solana-properties.tsx` | Solana config panel |
| `test_phase2_handlers.py` | Unit tests |

---

## Architecture

```
┌─────────────────────┐      ┌─────────────────────┐
│ Coinbase Panel      │      │   Solana Panel      │
│                     │      │                     │
│ - Security Profile  │      │ - Spending Limits   │
│ - Spending Limits   │      │ - Slippage          │
│ - Blocked Addresses │      │ - Priority Fee      │
└─────────┬───────────┘      └─────────┬───────────┘
          │                            │
          └──────────┬─────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │ Integration Router  │
          └─────────┬───────────┘
                    │
                    ▼
  ┌─────────────────┴─────────────────┐
  │                                   │
  ▼                                   ▼
┌─────────────────────┐    ┌─────────────────────┐
│  CoinbaseHandler    │    │   SolanaHandler     │
│                     │    │                     │
│ - get_action_       │    │ - validate_         │
│   provider()        │    │   transaction()     │
│ - validate_         │    │ - wrap_wallet()     │
│   payment()         │    │                     │
└─────────┬───────────┘    └─────────┬───────────┘
          │                          │
          └──────────┬───────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────┐
│                guardianclaw SDK                 │
│                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    │
│  │ coinbase/x402   │    │ solana (TBD)    │    │
│  │                 │    │                 │    │
│  │ - ActionProvider│    │ - Wallet wrapper│    │
│  │ - Middleware    │    │ - TX validation │    │
│  │ - Config        │    │                 │    │
│  └─────────────────┘    └─────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## Solana Agent Kit Details

### Core Architecture
- **SolanaAgentKit** - Main class for all blockchain operations
- **KeypairWallet** - Keypair-based wallet wrapper
- **Plugin System** - Modular architecture (Token, NFT, DeFi, Misc)

### Initialization
```typescript
const agent = new SolanaAgentKit(
  wallet,      // KeypairWallet or Privy/Turnkey embedded wallet
  rpcUrl,      // Solana RPC endpoint
  options      // API keys and config
)
```

### Plugin Operations
| Plugin | Operations |
|--------|------------|
| `@solana-agent-kit/plugin-token` | transfer, trade, bridge, deployToken, rugCheck |
| `@solana-agent-kit/plugin-nft` | mint, list, metadata, collections |
| `@solana-agent-kit/plugin-defi` | stake, lend, borrow, perps |
| `@solana-agent-kit/plugin-misc` | airdrops, price feeds, domains |

### Security Integration Patterns

**Pattern 1: Plugin-Based Wrapper**
```typescript
class GuardianClawValidationPlugin {
  async validateBeforeExecute(operation, parameters) {
    // Apply CLAW gates
    return { passed: boolean, reason?: string }
  }
}
agent.use(new GuardianClawValidationPlugin())
```

**Pattern 2: Turnkey Policy Integration**
```typescript
const turnkeyConfig = {
  rules: [
    {
      condition: 'transfer && amount > 1000000 && !whitelist.includes(target)',
      action: 'BLOCK',
      reason: 'GuardianClaw: High-value transfer to unvetted address'
    },
  ],
  requireConfirmation: ['deployToken', 'tokenBridge']
}
```

**Pattern 3: Human-in-the-Loop (Privy)**
```typescript
// Privy enables manual transaction approval
const agent = new SolanaAgentKit(privyWallet, rpcUrl, options)
// Transactions held pending user signature
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Solana SDK is TypeScript only | Create Python wrapper or use MCP adapter |
| Spending limits bypass | Server-side validation + Turnkey policies |
| Blocklist maintenance | Integrate with threat intelligence feeds |
| Private key exposure | Use embedded wallets (Privy/Turnkey) |

---

## Success Criteria

- [ ] CoinbaseHandler wraps guardianclaw x402 provider
- [ ] SolanaHandler validates transactions
- [ ] UI panels match existing design patterns
- [ ] All tests pass (target: 30+ tests)
- [ ] TypeScript compiles without errors

---

**Phase 2 Status: READY TO START**

*Prepared by: GuardianClaw Team*
*Date: 2026-01-09*
