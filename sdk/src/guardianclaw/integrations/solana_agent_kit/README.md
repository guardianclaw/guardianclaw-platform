# Solana Agent Kit Integration

Safety validation for Solana blockchain agents.

## Requirements

```bash
pip install guardianclaw
```

**Note:** This integration provides validation functions that work **alongside** Solana Agent Kit, not as a plugin. Solana Agent Kit plugins add actions, they don't intercept transactions.

**Dependencies:**
- `guardianclaw>=2.0.0`

**Solana Agent Kit:** [GitHub](https://github.com/sendaifun/solana-agent-kit) | [Docs](https://docs.sendai.fun)

## Overview

| Component | Description |
|-----------|-------------|
| `ClawValidator` | Core transaction validator |
| `safe_transaction` | Quick validation function |
| `create_claw_actions` | Actions for custom workflows |
| `GuardianClawSafetyMiddleware` | Function wrapper |
| `is_valid_solana_address` | Address format validation |

## Quick Start

```python
from guardianclaw.integrations.solana_agent_kit import safe_transaction

result = safe_transaction(
    "transfer",
    amount=5.0,
    recipient="7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    purpose="Payment for services",
)

if result.should_proceed:
    # Execute with Solana Agent Kit
    pass
else:
    print(f"Blocked: {result.concerns}")
```

## Usage Patterns

### Pattern 1: Explicit Validation

```python
from solana_agent_kit import SolanaAgentKit
from guardianclaw.integrations.solana_agent_kit import ClawValidator

# Initialize both
agent = SolanaAgentKit(wallet, rpc_url, config)
validator = ClawValidator(max_transfer=10.0)

# Validate before executing
result = validator.check(
    action="transfer",
    amount=5.0,
    recipient="ABC123...",
    purpose="Payment for services",
)

if result.should_proceed:
    agent.transfer(recipient, amount)
else:
    print(f"Blocked: {result.concerns}")
```

### Pattern 2: Quick Check

```python
from guardianclaw.integrations.solana_agent_kit import safe_transaction

result = safe_transaction(
    "transfer",
    amount=50.0,
    recipient="ABC...",
    purpose="User requested payment",
)

if result.should_proceed:
    # execute with your Solana Agent Kit
    pass
```

### Pattern 3: Function Wrapper

```python
from guardianclaw.integrations.solana_agent_kit import (
    GuardianClawSafetyMiddleware,
    TransactionBlockedError,
)

middleware = GuardianClawSafetyMiddleware()

def my_transfer(amount, recipient):
    # your transfer logic
    pass

# Wrap function
safe_transfer = middleware.wrap(my_transfer, "transfer")

try:
    safe_transfer(5.0, "ABC...")  # Validates then executes
except TransactionBlockedError as e:
    print(f"Blocked: {e}")
```

## Configuration

### ClawValidator

```python
from guardianclaw.integrations.solana_agent_kit import (
    ClawValidator,
    AddressValidationMode,
)

ClawValidator(
    # Core settings
    seed_level="standard",           # GuardianClaw seed level ("minimal", "standard", "full")
    max_transfer=100.0,              # Max SOL per transaction (see note below)
    confirm_above=10.0,              # Require confirmation above
    blocked_addresses=[],            # Blocked wallet addresses
    allowed_programs=[],             # Whitelist (empty = all)
    require_purpose_for=[            # Actions needing purpose
        "transfer", "send", "approve", "swap", "bridge", "withdraw", "stake"
    ],
    address_validation=AddressValidationMode.STRICT,  # IGNORE, WARN, or STRICT (default: STRICT for security)

    # Advanced settings
    max_history_size=1000,           # Max validation history entries
    strict_mode=False,               # Block any transaction with concerns
    custom_patterns=None,            # Additional SuspiciousPattern list
    on_validation=None,              # Callback after each validation
    validator=None,                  # Custom LayeredValidator (for testing)

    # Memory integrity
    memory_integrity_check=False,    # Enable cryptographic history verification
    memory_secret_key=None,          # Secret key for HMAC signatures
    memory_content_validation=True,  # Enable injection detection (v2.0)

    # Fiduciary validation (see section below)
    fiduciary_enabled=True,          # Enable duty of loyalty/care checks
    user_context=None,               # UserContext for fiduciary validation
    strict_fiduciary=False,          # Block on any fiduciary violation
)
```

> **Important:** Default `max_transfer=100.0` SOL may be too high for many use cases.
> Always configure appropriate limits for your application.

### Address Validation Modes

| Mode | Behavior |
|------|----------|
| `IGNORE` | Don't validate address format |
| `WARN` | Log warning but allow transaction |
| `STRICT` | Reject invalid addresses with CRITICAL risk (default) |

```python
from guardianclaw.integrations.solana_agent_kit import is_valid_solana_address

# Validate address format (base58, 32-44 chars)
valid = is_valid_solana_address("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU")
```

## Validation Result

```python
@dataclass
class TransactionSafetyResult:
    safe: bool                   # Passed all checks
    risk_level: TransactionRisk  # LOW, MEDIUM, HIGH, CRITICAL
    transaction_type: str        # Action name
    concerns: List[str]          # Safety concerns
    recommendations: List[str]   # Suggested actions
    should_proceed: bool         # Final decision
    requires_confirmation: bool  # High-value flag
```

## Risk Levels

| Level | Blocks | Example |
|-------|--------|---------|
| `LOW` | No | Normal transactions |
| `MEDIUM` | No | Missing purpose, suspicious patterns |
| `HIGH` | Yes | Non-whitelisted program, GuardianClaw concerns |
| `CRITICAL` | Yes | Blocked address, exceeds max, invalid address (strict) |

## Checks Performed

1. **Address validation:** Format check (base58, configurable mode)
2. **Blocked addresses:** Recipient in blocklist
3. **Program whitelist:** Program ID allowed
4. **Transfer limits:** Amount within max
5. **PURPOSE gate:** Sensitive actions need purpose
6. **GuardianClaw validation:** CLAW protocol check
7. **Pattern detection:** Drain, sweep, bulk transfers
8. **Fiduciary validation:** User-aligned decision making (if enabled)

## Fiduciary Validation

Validates that transactions align with user's best interests (duty of loyalty/care).

### Enabling Fiduciary Validation

```python
from guardianclaw.integrations.solana_agent_kit import ClawValidator

# Enabled by default with Solana-specific defaults
validator = ClawValidator(fiduciary_enabled=True)

# Custom user context
from guardianclaw.fiduciary import UserContext, RiskTolerance

validator = ClawValidator(
    fiduciary_enabled=True,
    user_context=UserContext(
        goals=["protect holdings", "minimize fees"],
        constraints=["max 10 SOL per day"],
        risk_tolerance=RiskTolerance.LOW,
    ),
    strict_fiduciary=True,  # Block any fiduciary violation
)
```

### Fiduciary Classes (re-exported)

| Class | Description |
|-------|-------------|
| `UserContext` | User goals, constraints, risk tolerance |
| `RiskTolerance` | LOW, MODERATE, HIGH, AGGRESSIVE |
| `FiduciaryValidator` | Core fiduciary validator |
| `FiduciaryResult` | Validation result with violations |

### Fiduciary Methods

| Method | Description |
|--------|-------------|
| `get_fiduciary_stats()` | Get fiduciary validation statistics |
| `update_user_context(ctx)` | Update user context at runtime |

### Checking Fiduciary Availability

```python
from guardianclaw.integrations.solana_agent_kit import HAS_FIDUCIARY

if HAS_FIDUCIARY:
    print("Fiduciary validation available")
```

## Memory Content Validation (v2.0)

Memory Shield v2.0 adds content validation BEFORE HMAC signing, detecting injection attacks at the source. This protects against Princeton CrAIBench attack vectors where malicious content is injected before memory protection is applied.

### Enabling Content Validation

```python
from guardianclaw.integrations.solana_agent_kit import ClawValidator

# Content validation is enabled by default when memory integrity is on
validator = ClawValidator(
    memory_integrity_check=True,
    memory_secret_key="your-secret-key",
    memory_content_validation=True,  # Default: True
)
```

### Disabling Content Validation (Not Recommended)

```python
validator = ClawValidator(
    memory_integrity_check=True,
    memory_secret_key="your-secret-key",
    memory_content_validation=False,  # Only HMAC, no injection detection
)
```

### Checking Memory Stats

```python
stats = validator.get_memory_stats()
# Returns:
# {
#     "enabled": True,
#     "content_validation": True,
#     "entries_stored": 42,
#     ...
# }
```

### Verifying Transaction History

```python
result = validator.verify_transaction_history()
# Returns:
# {
#     "all_valid": True,
#     "checked": 42,
#     "invalid_count": 0,
#     ...
# }
```

### Detected Patterns

| Category | Examples |
|----------|----------|
| Authority Claims | "ADMIN:", "SYSTEM NOTICE:" |
| Instruction Overrides | "Ignore previous instructions" |
| Address Redirection | Suspicious wallet address changes |
| Airdrop Scams | Fake eligibility claims |
| Urgency Manipulation | "URGENT: action required" |
| Trust Exploitation | Fake verification messages |
| Role Manipulation | Identity injection attempts |
| Context Poisoning | Fake context markers |
| Crypto Attacks | Drain/sweep commands |

### Performance

| Metric | Value |
|--------|-------|
| Latency | < 1ms per validation |
| False Positive Rate | < 5% |
| Detection Rate | > 90% |

## Running Examples

```bash
# Basic examples
python -m guardianclaw.integrations.solana_agent_kit.example

# All examples including statistics
python -m guardianclaw.integrations.solana_agent_kit.example --all
```

## API Reference

### Classes

| Class | Description |
|-------|-------------|
| `ClawValidator` | Core validator |
| `TransactionSafetyResult` | Validation result dataclass |
| `TransactionRisk` | Risk level enum (LOW, MEDIUM, HIGH, CRITICAL) |
| `AddressValidationMode` | Address validation mode (IGNORE, WARN, STRICT) |
| `SuspiciousPattern` | Pattern definition for suspicious behavior detection |
| `GuardianClawSafetyMiddleware` | Function wrapper |
| `TransactionBlockedError` | Exception for blocked transactions |

### Functions

| Function | Description |
|----------|-------------|
| `safe_transaction(action, **params)` | Quick validation |
| `create_claw_actions()` | Action functions dict |
| `is_valid_solana_address(addr)` | Validate address format |

### Constants

| Constant | Type | Description |
|----------|------|-------------|
| `__version__` | str | Integration version (e.g., "2.1.0") |
| `HAS_FIDUCIARY` | bool | Whether fiduciary module is available |
| `DEFAULT_SUSPICIOUS_PATTERNS` | List[SuspiciousPattern] | Default crypto-specific patterns |
| `HIGH_RISK_ACTIONS` | List[str] | Actions that always trigger blocking |
| `ALLOWED_METADATA_KEYS` | Set[str] | Allowed keys for metadata sanitization |

### Methods (ClawValidator)

| Method | Returns | Description |
|--------|---------|-------------|
| `check(action, amount, recipient, ...)` | TransactionSafetyResult | Validate transaction |
| `get_stats()` | Dict | Validation statistics |
| `clear_history()` | None | Clear validation history |
| `verify_transaction_history()` | Dict | Verify history integrity (if enabled) |
| `get_memory_stats()` | Dict | Memory integrity statistics |
| `get_fiduciary_stats()` | Dict | Fiduciary validation statistics |
| `update_user_context(ctx)` | None | Update fiduciary user context |
| `block_address(addr)` | None | Add address to blocklist |
| `unblock_address(addr)` | None | Remove address from blocklist |
| `get_config()` | Dict | Get current configuration |
| `update_config(...)` | None | Update configuration at runtime |

## Error Handling

```python
from guardianclaw.integrations.solana_agent_kit import (
    GuardianClawSafetyMiddleware,
    TransactionBlockedError,
)

middleware = GuardianClawSafetyMiddleware()
safe_fn = middleware.wrap(my_function, "transfer")

try:
    safe_fn(100.0, "recipient")
except TransactionBlockedError as e:
    # Handle blocked transaction
    print(f"Transaction blocked: {e}")
```

## Logging

Enable debug logging to see validation details:

```python
import logging
logging.getLogger("guardianclaw.solana_agent_kit").setLevel(logging.DEBUG)
```

## Links

- **Solana Agent Kit:** https://docs.sendai.fun
- **Solana Agent Kit GitHub:** https://github.com/sendaifun/solana-agent-kit
- **GuardianClaw:** https://guardianclaw.org
