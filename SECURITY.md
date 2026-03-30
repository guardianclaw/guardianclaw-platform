# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| 2.x.x   | :x:                |
| 1.x.x   | :x:                |

## Reporting a Vulnerability

We take the security of GuardianClaw Platform seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Email:** security@guardianclaw.org

**Please include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

### Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Initial acknowledgment | 24 hours |
| Preliminary assessment | 72 hours |
| Fix development | 7-14 days (severity dependent) |
| Public disclosure | 30 days after fix (coordinated) |

### What to Expect

1. **Acknowledgment**: We will confirm receipt of your report within 24 hours
2. **Communication**: We will keep you informed of our progress
3. **Credit**: With your permission, we will credit you in the security advisory
4. **No legal action**: We will not pursue legal action against researchers acting in good faith

### Scope

**In scope:**
- guardianclaw-platform (this repository)
- API at api.guardianclaw.org
- Web application at guardianclaw.org

**Out of scope:**
- Third-party services (Supabase, Cloudflare, Vercel)
- Social engineering attacks
- Denial of Service (DoS/DDoS)
- Attacks requiring physical access

---

## Security Architecture

### Overview

GuardianClaw Platform implements defense-in-depth with multiple security layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge                              │
│  (DDoS Protection, WAF, Bot Management, TLS Termination)        │
├─────────────────────────────────────────────────────────────────┤
│                     API Gateway (Hono.js)                        │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │   Logging   │ │  Security   │ │    Rate     │                │
│  │ Middleware  │ │   Headers   │ │  Limiting   │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │    CORS     │ │    Auth     │ │   Input     │                │
│  │  Hardened   │ │  (JWT/SIWS) │ │ Sanitize    │                │
│  └─────────────┘ └─────────────┘ └─────────────┘                │
├─────────────────────────────────────────────────────────────────┤
│                     Database (Supabase)                          │
│  (Row-Level Security, Encrypted at rest, Connection pooling)    │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication

**Sign-In With Solana (SIWS)**

- Wallet-based authentication using cryptographic signatures
- No passwords stored or transmitted
- JWT tokens with ES256 signing (HS256 legacy fallback)
- Token revocation support (per-token and per-wallet)
- Session security with IP change detection

**Token Security**

| Property | Value |
|----------|-------|
| Algorithm | ES256 (preferred), HS256 (legacy) |
| Expiration | 24 hours |
| Revocation | Supported via KV store |
| Refresh | Not implemented (re-authentication required) |

### Authorization

**Row-Level Security (RLS)**

All database tables enforce RLS policies:
- Users can only access their own data
- Agents are scoped to owner wallet
- Conversations linked to authenticated users
- Admin operations require verified role

**Admin RBAC**

| Role | Access Level |
|------|--------------|
| super_admin | Full system access |
| admin | Most operations |
| support | Limited user/agent operations |
| viewer | Read-only access |

### Rate Limiting

**Three-tier system:**

1. **Global (IP-based)**: 1000 requests/minute per IP
2. **Endpoint-specific**: Sensitive endpoints have lower limits
3. **Per-wallet**: 100 requests/minute per authenticated user

| Endpoint Category | Limit |
|------------------|-------|
| Authentication | 10/min |
| Deploy operations | 5/min |
| Agent invocation | 60/min |
| LLM key management | 5/min |
| Governance actions | 5-20/min |

### HTTP Security Headers

All API responses include:

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | Restrictive | XSS prevention |
| Strict-Transport-Security | 1 year, includeSubDomains | Force HTTPS |
| X-Content-Type-Options | nosniff | MIME sniffing prevention |
| X-Frame-Options | DENY | Clickjacking prevention |
| Referrer-Policy | strict-origin-when-cross-origin | Referrer control |
| Permissions-Policy | All features disabled | Feature restriction |
| Cache-Control | no-store | Prevent caching |

### CORS Configuration

**Allowed Origins (Production):**
- https://guardianclaw.org
- https://www.guardianclaw.org
- https://staging.guardianclaw.org
- https://guardianclaw-platform.pages.dev
- https://guardianclaw-v3.pages.dev
- Cloudflare Pages preview deployments (pattern-matched)

**Development only:**
- http://localhost:3000

**Allowed Methods:** GET, POST, PUT, PATCH, DELETE, OPTIONS

**Credentials:** Allowed (for JWT authentication)

### Input Validation

**SSRF Prevention:**
- Private IP ranges blocked (10.x, 172.16-31.x, 192.168.x, 127.x)
- Cloud metadata endpoints blocked (169.254.169.254)
- Internal hostnames blocked (localhost, metadata.google.internal)
- HTTPS enforced in production

**Request Limits:**
- JSON depth: max 10 levels
- Body size: 1MB (Cloudflare enforced)

### Data Protection

**PII Handling:**
- IP addresses hashed with daily-rotating salt (GDPR compliance)
- Error messages scrubbed of sensitive data
- Wallet addresses hashed in logs
- No personal data in URL parameters

**Patterns Scrubbed:**
- API keys (sk-*, sk_live_*)
- JWT tokens
- Email addresses
- File paths
- Database connection strings
- Internal URLs

### Logging & Monitoring

**Request Tracing:**
- Unique request ID for every request
- Structured JSON logging
- Duration and status tracking

**Security Events Logged:**
- Authentication failures
- Rate limit violations
- Suspicious activity (IP changes)
- Token revocations

### Cryptographic Standards

| Purpose | Algorithm | Key Size |
|---------|-----------|----------|
| JWT signing | ES256 | 256-bit |
| JWT signing (legacy) | HS256 | 256-bit |
| IP hashing | SHA-256 | N/A |
| Wallet hashing | SHA-256 | N/A |

---

## Development Security

### Pre-commit Hooks

All commits must pass:
- ESLint (no warnings)
- Prettier formatting
- TypeScript type checking

### CI/CD Security

- Dependency scanning
- Type checking
- Lint checks
- Test coverage requirements

### Secret Management

**Environment Variables:**
- Never committed to repository
- Stored in Cloudflare Workers secrets
- Rotated periodically

**Required Secrets:**
- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- JWT_SECRET (legacy)
- JWT_ES256_PRIVATE_KEY
- IP_HASH_SECRET

---

## Incident Response

### Classification

| Severity | Response Time | Examples |
|----------|--------------|----------|
| Critical | 1 hour | Data breach, RCE |
| High | 4 hours | Auth bypass, SQLi |
| Medium | 24 hours | XSS, CSRF |
| Low | 72 hours | Info disclosure |

### Contact

**Security Team:** security@guardianclaw.org

**Escalation:** For critical issues, email with subject line `[CRITICAL]`

---

## Compliance

### Standards

- OWASP Top 10 mitigations
- GDPR data minimization
- SOC 2 alignment (in progress)

### Audits

Security audits are conducted:
- Quarterly internal reviews
- Annual third-party penetration testing

---

## Acknowledgments

We thank the security researchers who have helped improve GuardianClaw Platform:

*No acknowledgments yet. Be the first!*

---

**Last Updated:** 2026-01-28
**Version:** 1.0.0
