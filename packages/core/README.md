# @guardianclaw/core

Core validation module for GuardianClaw. Implements the CLAW Protocol (Credibility, Limits, Avoidance, Worth) with pattern-based heuristic validation and optional semantic analysis via API.

## Features

| Feature | Description |
|---------|-------------|
| **CLAW Protocol** | Five-gate validation system (Credibility, Limits, Avoidance, Worth, Jailbreak) |
| **Heuristic Validation** | Pattern-based detection, runs offline, sub-millisecond latency |
| **Semantic Validation** | LLM-powered analysis via API for nuanced cases |
| **~370 Patterns** | Comprehensive pattern library synchronized with Python core |
| **TypeScript Native** | Full type definitions included |

## Installation

```bash
npm install @guardianclaw/core
```

## Quick Start

### Heuristic Validation (Offline)

```typescript
import { validateCLAW, quickCheck } from '@guardianclaw/core';

// Full validation with detailed results
const result = validateCLAW("Hello, how can I help you?");

if (result.overall) {
  console.log("Content is safe");
} else {
  console.log("Blocked:", result.summary);
  console.log("Risk level:", result.riskLevel);
}

// Quick boolean check
if (quickCheck("Some user input")) {
  // Process input
} else {
  // Block input
}
```

### Semantic Validation (API)

```typescript
import { configureApi, validateWithFallback } from '@guardianclaw/core';

// Configure API endpoint
configureApi({
  endpoint: 'https://api.guardianclaw.org',
  apiKey: process.env.GCLAW_API_KEY,
});

// Validate with heuristic first, API fallback for edge cases
const result = await validateWithFallback("Complex content to analyze");

console.log("Safe:", result.is_safe);
console.log("Layer:", result.layer); // "heuristic" or "semantic"
```

## API Reference

### Core Functions

| Function | Description | Returns |
|----------|-------------|---------|
| `validateCLAW(text)` | Full CLAW validation through all gates | `CLAWResult` |
| `quickCheck(text)` | Fast boolean safety check | `boolean` |
| `checkJailbreak(text)` | Jailbreak detection only | `GateResult` |
| `checkHarm(text)` | Harm detection only | `GateResult` |
| `validateWithFallback(text)` | Heuristic with API fallback | `Promise<ValidateResponse>` |

### Types

```typescript
interface CLAWResult {
  credibility: GateResult;
  avoidance: GateResult;
  limits: GateResult;
  worth: GateResult;
  jailbreak: GateResult;
  overall: boolean;
  summary: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

interface GateResult {
  passed: boolean;
  score: number;
  violations: string[];
}
```

## Gate Descriptions

| Gate | Function | Examples |
|------|----------|----------|
| **Credibility** | Detects deception and misinformation | Impersonation, false claims |
| **Avoidance** | Identifies harmful content and sensitive data | Violence, malware, credentials |
| **Limits** | Catches boundary violations | Unauthorized access, excessive permissions |
| **Worth** | Flags purposeless destruction | Actions without legitimate benefit |
| **Jailbreak** | Detects prompt injection attacks | Instruction override, DAN mode, roleplay manipulation |

## Pattern Categories

The package includes ~370 patterns organized by category:

**Jailbreak Detection**
- Instruction override patterns
- Role manipulation patterns
- Prompt extraction patterns
- Filter bypass patterns
- Roleplay manipulation patterns
- System injection patterns

**Harm Detection**
- Violence and weapons
- Malware and hacking
- Illegal activities
- Self-harm content

**Sensitive Data**
- API keys (OpenAI, AWS, GitHub)
- Passwords and credentials
- PII (emails, phone numbers)

## Usage in Browser Extensions

```typescript
import { validateCLAW } from '@guardianclaw/core';

// Validate user input before sending to AI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'VALIDATE') {
    const result = validateCLAW(message.text);
    sendResponse({
      safe: result.overall,
      violations: result.summary,
    });
  }
});
```

## Usage in Node.js

```typescript
import { validateCLAW, configureApi, validateSemantic } from '@guardianclaw/core';

// Heuristic validation (no network required)
const heuristicResult = validateCLAW(userInput);

if (!heuristicResult.overall) {
  // Blocked by heuristic
  return { blocked: true, reason: heuristicResult.summary };
}

// Optional: semantic validation for edge cases
configureApi({ endpoint: 'https://api.guardianclaw.org' });
const semanticResult = await validateSemantic({
  content: userInput,
  context: { source: 'user' },
});
```

## Performance

| Operation | Latency | Cost |
|-----------|---------|------|
| Heuristic validation | < 1ms | Free |
| Semantic validation | 500ms to 2s | API usage |

## Development

```bash
# Build
npm run build

# Test
npm run test

# Lint
npm run lint

# Type check
npm run typecheck
```

## License

MIT

## Links

| Resource | URL |
|----------|-----|
| Website | https://guardianclaw.org |
| Documentation | https://guardianclaw.org/docs |
| GitHub | https://github.com/guardian-claw/guardianclaw |
| Issues | https://github.com/guardian-claw/guardianclaw/issues |
