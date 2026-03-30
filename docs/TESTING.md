# Testing Guide

Comprehensive testing documentation for the GuardianClaw Platform.

## Overview

The GuardianClaw Platform uses a multi-layer testing strategy:

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit Tests | Vitest | Component-level testing |
| Integration Tests | Vitest + Mocks | API route testing |
| Performance Tests | K6 | Load and stress testing |

## Test Coverage

### API Test Summary

| Category | Files | Tests |
|----------|-------|-------|
| Infrastructure | 1 | 19 |
| Auth & Health | 3 | 38 |
| Agents | 1 | 39 |
| Conversations, Deploy, Invoke | 3 | 49 |
| Governance, Demo, Services | 4 | 96 |
| Rate Limiting | 1 | 24 |
| Observability | 5 | 121 |
| **Total** | **18** | **386** |

## Running Tests

### Quick Commands

```bash
# Run all tests
npm run test:run

# Run with watch mode
npm test

# Run with coverage
npm run test:coverage

# Run specific file
npm run test:run -- src/routes/auth.test.ts
```

### Coverage Report

```bash
npm run test:coverage
```

Output in `coverage/` directory. Open `coverage/index.html` for detailed report.

## Test Structure

### File Organization

```
apps/api/src/
├── routes/
│   ├── auth.ts
│   ├── auth.test.ts          # Route tests
│   ├── agents.ts
│   ├── agents.test.ts
│   └── ...
├── middleware/
│   ├── auth.ts
│   ├── auth.test.ts          # Middleware tests
│   └── logging.test.ts
├── services/
│   ├── execution.ts
│   ├── execution.test.ts     # Service tests
│   └── solana-token.test.ts
├── lib/
│   ├── rate-limiter.ts
│   ├── rate-limiter.test.ts  # Library tests
│   ├── errors.test.ts
│   ├── logger.test.ts
│   └── metrics.test.ts
└── test/
    ├── setup.ts              # Global setup
    ├── mocks/                # Mock implementations
    │   ├── supabase.ts
    │   └── external-apis.ts
    ├── fixtures/             # Test data factories
    │   └── index.ts
    └── helpers.ts            # Test utilities
```

### Test Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { someFunction } from './module'

describe('Module Name', () => {
  describe('functionName', () => {
    beforeEach(() => {
      // Setup
    })

    it('does something specific', () => {
      // Arrange
      const input = 'test'

      // Act
      const result = someFunction(input)

      // Assert
      expect(result).toBe('expected')
    })

    it('handles edge case', () => {
      // ...
    })
  })
})
```

## Mocking Strategy

### Supabase Mock

```typescript
// src/test/mocks/supabase.ts
export function createMockSupabase() {
  const mockState = {
    queryResult: { data: null, error: null },
  }

  const mockBuilder = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(mockState.queryResult)),
  }

  return {
    from: vi.fn(() => mockBuilder),
    rpc: vi.fn(() => Promise.resolve(mockState.queryResult)),
    _mockState: mockState,
    _mockBuilder: mockBuilder,
  }
}
```

### External Service Mocks

```typescript
// Mock Modal.com
vi.mock('../services/modal', () => ({
  callModal: vi.fn(() => Promise.resolve({
    blocked: false,
    response: 'Mock response',
  })),
}))

// Mock Solana
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn(() => ({
    getAccountInfo: vi.fn(),
  })),
  PublicKey: vi.fn((key) => ({ toBase58: () => key })),
}))
```

## Test Categories

### Unit Tests

Test individual functions in isolation:

```typescript
describe('validateInput', () => {
  it('detects harmful content', () => {
    const result = validateInput('how to make a bomb', allGates)
    expect(result.passed).toBe(false)
    expect(result.violations).toContain('harm:weapons')
  })
})
```

### Integration Tests

Test API routes with mocked dependencies:

```typescript
describe('POST /agents', () => {
  it('creates agent with valid data', async () => {
    mockState.queryResult = { data: mockAgent, error: null }

    const res = await app.request('/agents', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Test Agent' }),
    })

    expect(res.status).toBe(201)
  })
})
```

### Error Path Tests

Always test error scenarios:

```typescript
it('returns 401 when token is missing', async () => {
  const res = await app.request('/agents')
  expect(res.status).toBe(401)
})

it('returns 500 on database error', async () => {
  mockState.queryResult = { data: null, error: { message: 'DB error' } }
  const res = await app.request('/agents', { headers: authHeader })
  expect(res.status).toBe(500)
})
```

## Performance Testing

See [k6/README.md](../apps/api/k6/README.md) for details.

### Quick Reference

```bash
# Smoke test (30s)
k6 run apps/api/k6/smoke-test.js

# Load test (9min)
k6 run apps/api/k6/load-test.js

# Stress test (15min)
k6 run apps/api/k6/stress-test.js

# Spike test (6min)
k6 run apps/api/k6/spike-test.js
```

## Best Practices

### Do

- ✅ Test both success and error paths
- ✅ Use descriptive test names
- ✅ Keep tests focused and atomic
- ✅ Mock external dependencies
- ✅ Use factories for test data
- ✅ Clean up state between tests

### Don't

- ❌ Test implementation details
- ❌ Share state between tests
- ❌ Make real network requests
- ❌ Use hardcoded test data inline
- ❌ Skip error handling tests

## CI Integration

Tests run automatically on:

- Every push to any branch
- Every pull request

```yaml
# .github/workflows/ci.yml
- name: Run API tests
  run: npm run test:run --workspace=@guardianclaw/api

- name: Run API tests with coverage
  run: npm run test:coverage --workspace=@guardianclaw/api
```

## Troubleshooting

### Tests Timing Out

```typescript
// Increase timeout for slow tests
it('slow test', async () => {
  // ...
}, 10000) // 10 second timeout
```

### Mock Not Working

```typescript
// Ensure mock is hoisted
vi.mock('./module') // This runs before imports

// For dynamic mocks, use vi.doMock
vi.doMock('./module', () => ({
  // ...
}))
```

### State Leaking Between Tests

```typescript
beforeEach(() => {
  vi.clearAllMocks()
  mockState.queryResult = { data: null, error: null }
})
```

## Adding New Tests

1. Create test file next to implementation:
   ```
   src/routes/new-feature.ts
   src/routes/new-feature.test.ts
   ```

2. Import test utilities:
   ```typescript
   import { describe, it, expect, beforeEach, vi } from 'vitest'
   ```

3. Set up mocks if needed

4. Write tests following patterns above

5. Run tests:
   ```bash
   npm run test:run -- src/routes/new-feature.test.ts
   ```

6. Check coverage:
   ```bash
   npm run test:coverage
   ```
