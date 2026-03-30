# GuardianClaw + Solana Agent Kit Integration

This directory contains GuardianClaw safety integrations for [Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit).

## Available Implementations

### TypeScript (Native Plugin)

**Location:** `typescript/`

A native plugin for Solana Agent Kit v2 that implements the CLAW protocol for transaction safety validation.

```bash
npm install @guardianclaw/solana-agent-kit
```

```typescript
import { SolanaAgentKit } from "solana-agent-kit";
import GuardianClawPlugin from "@guardianclaw/solana-agent-kit";

const agent = new SolanaAgentKit(privateKey, rpcUrl)
  .use(GuardianClawPlugin({
    maxTransactionAmount: 100,
    requirePurposeFor: ["transfer", "swap"],
  }));
```

See [typescript/README.md](./typescript/README.md) for full documentation.

### Python (Validation Layer)

**Location:** `src/guardianclaw/integrations/solana_agent_kit/`

Python integration that provides validation functions to use with Solana Agent Kit workflows.

```python
from guardianclaw.integrations.solana_agent_kit import SolanaValidator

validator = SolanaValidator(max_single_transfer=100.0)
result = validator.validate_transaction(
    action="transfer",
    amount=50.0,
    recipient="...",
)

if result.is_safe:
    # Execute transaction
    pass
```

See the [Python integration README](../../src/guardianclaw/integrations/solana_agent_kit/README.md) for full documentation.

## Choosing an Implementation

| Feature | TypeScript | Python |
|---------|------------|--------|
| Native SAK Plugin | Yes | No |
| LLM Action Integration | Yes | Manual |
| Automatic Validation | Via plugin | Via wrapper |
| Package | npm | pip (guardianclaw) |

**Use TypeScript** if you're building with Solana Agent Kit v2 and want native plugin integration.

**Use Python** if you're using the Python ecosystem or need validation in custom workflows.

## Links

- [GuardianClaw Documentation](https://guardianclaw.org/docs)
- [Solana Agent Kit](https://docs.sendai.fun)
- [CLAW Protocol](https://guardianclaw.org/docs/claw)
- [Contact](mailto:contact@guardianclaw.org)

---

Built by [GuardianClaw Team](https://guardianclaw.org) | [contact@guardianclaw.org](mailto:contact@guardianclaw.org)
