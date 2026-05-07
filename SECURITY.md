# Security Policy

## Status Honesty Statement

This document describes the **actual runtime enforcement** of the GuardianClaw Platform as of the `Last Updated` date below. Controls are classified as:

- **Implemented** — present in code, executed at runtime, exercised by tests
- **Planned** — design exists but enforcement is partial or not wired to all surfaces
- **Known gaps** — tracked issues under active remediation

We will not overclaim. If a control is not enforced, it is not listed as Implemented.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| 2.x.x   | :x:                |
| 1.x.x   | :x:                |

---

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

## Architecture Overview

The platform layers Cloudflare Edge, a Hono-based API on Workers, and Supabase for persistence:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Edge                              │
│  (DDoS Protection, WAF, Bot Management, TLS Termination)        │
├─────────────────────────────────────────────────────────────────┤
│                     API Gateway (Hono.js)                        │
│  Logging · Security Headers · Rate Limit · CORS · Auth · Input  │
├─────────────────────────────────────────────────────────────────┤
│                     Database (Supabase)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implemented Controls

Every item in this section is enforced in code today. Links point to source.

### Authentication

- **Sign-In With Solana (SIWS)** — wallet signature verification, no passwords.
- **JWT signing** — ES256 preferred, HS256 legacy fallback (`apps/api/src/lib/jwt.ts`).
- **Token revocation** — per-JTI revocation list backed by Workers KV.
- **Session IP tracking** — last-used IPs recorded per wallet for suspicious-activity detection.
- **Session cookie** — `httpOnly`, `secure`, `SameSite=Lax`, `Domain=.guardianclaw.org`, `Max-Age=3600` (1 hour) (`apps/api/src/routes/auth.ts`).

**Token lifetime caveat:** the browser session cookie expires after **1 hour**. The JWT body returned for SDK/API clients carries its own `exp` claim set by `JWTManager.createToken()`. Do not assume a 24-hour session in browsers.

### Authorization

- **Admin RBAC** — `super_admin`, `admin`, `support`, `viewer` roles gated by `admin_roles` table (`apps/api/src/middleware/admin-auth.ts`).
- **Row-Level Security (RLS)** — policies declared across 39 migrations in `supabase/migrations/`. See **Known Gaps** section below for the honest assessment of RLS enforcement at runtime.

### Rate Limiting

- **Global:** 1000 requests/minute per IP (`apps/api/src/middleware/rate-limit.ts`).
- **Endpoint-specific:** tighter limits on auth, deploy, LLM-key, governance.
- **Per-wallet:** separate bucket for authenticated users.

| Endpoint Category | Limit |
|------------------|-------|
| Authentication | 10/min |
| Deploy operations | 5/min |
| Agent invocation | 60/min |
| LLM key management | 5/min |
| Governance actions | 5-20/min |

### HTTP Security Headers

All API responses include:

| Header | Value |
|--------|-------|
| Content-Security-Policy | Restrictive |
| Strict-Transport-Security | 1 year, includeSubDomains |
| X-Content-Type-Options | nosniff |
| X-Frame-Options | DENY |
| Referrer-Policy | strict-origin-when-cross-origin |
| Permissions-Policy | All features disabled |
| Cache-Control | no-store |

### CORS Configuration

**Allowed Origins (Production):**
- https://guardianclaw.org
- https://www.guardianclaw.org
- https://staging.guardianclaw.org
- Vercel preview deployments (pattern-matched `*.vercel.app`)

**Development only:** http://localhost:3000

**Credentials:** Allowed (required for httpOnly cookie flow).

### Request Limits

- **Body size:** 2 MB, enforced as Hono global middleware (`apps/api/src/index.ts` — returns HTTP 413 above threshold).
- **JSON depth:** max 10 levels (`apps/api/src/middleware/sanitize.ts`).

### IP Change Detection

- `detectSuspiciousActivity()` runs in the auth middleware. Sessions used from 3+ recent IPs are blocked with HTTP 401 and a `session_blocked` security event is emitted (`apps/api/src/middleware/auth.ts`).

### Webhook Security

- **Inbound trigger endpoints** validate HMAC-SHA256 signatures, IPv4 + IPv6 CIDR allowlists (BigInt arithmetic), replay protection, and per-endpoint rate limits.
- **Webhook secret rotation** tracked via `rotated_at` column and admin audit trail.

### Data Protection

- **IP hashing** — daily-rotating salt, SHA-256 (`apps/api/src/lib/secure-logger.ts`).
- **Wallet hashing** in logs — SHA-256.
- **Secret scrubbing** in errors — patterns for `sk-*`, `sk_live_*`, JWTs, emails, file paths, DB connection strings.
- **Encrypt-at-rest** for webhook secrets and tool credentials — AES-GCM with per-record nonce.

### XSS Prevention

- Docs renderer uses `react-markdown` with sanitized link protocols (`javascript:`, `data:`, `vbscript:` blocked). No `dangerouslySetInnerHTML` on user-controlled content.

### SSRF / External URL Validation

- `validateExternalUrl()` (`apps/api/src/middleware/sanitize.ts`) blocks: non-HTTP(S) schemes; plain `http://` (require `https://` unless caller opts in via `allowHttp`); IPv4 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`); IPv4 loopback (`127.0.0.0/8`); IPv4 link-local (`169.254.0.0/16`); IPv6 loopback (`::1`); IPv6 unique local (`fc00::/7`); IPv6 link-local (`fe80::/10`); cloud metadata IPs and hostnames (`169.254.169.254`, `metadata.google.internal`, `metadata.goog`); and our own infrastructure hostnames.
- The check runs at every user-controlled URL boundary that turns into an outbound `fetch`:
    - **Webhook endpoint create / update** (`apps/api/src/routes/webhook-endpoints.ts`)
    - **Webhook delivery execution** (`apps/api/src/services/webhook-delivery.ts`) — defense-in-depth re-check at each delivery
    - **Alert rule create / update / test** (`apps/api/src/routes/alerts.ts`)
    - **Background alert notification** (`apps/api/src/services/agent-alerts.ts`)
    - **Flow webhook output nodes** (`apps/api/src/services/execution.ts`)
    - **Tool credential `custom_api` test** and **Discord webhook credential test** (`apps/api/src/routes/tool-credentials.ts`)
    - **Discord social-connector delivery** (`apps/api/src/services/social-connectors/discord.ts`)
- Blocks emit a structured `ssrf_blocked` security event via `SecureLogger`. The log includes the surface label and the rejected hostname only — never the full URL (path/query may contain credentials).
- HTTPS is required by default. The `allowHttp` opt-in exists for development integrations against non-TLS endpoints; production callers do not pass it.

### Server-Side Ownership Predicate (Social Deliveries)

- `approve_social_delivery(p_delivery_id, p_wallet_address)` (`supabase/migrations/20260426000000_secure_approve_social_delivery.sql`) enforces the wallet-ownership check inside the same UPDATE statement that transitions the row from `draft` to `pending`. The route handler (`apps/api/src/routes/social-deliveries.ts`) does not perform a post-hoc revert — if the caller does not own the agent, zero rows update and the RPC returns `success=false`. Closes the TOCTOU window flagged as F-05 / P1.1 in the 2026-04-23 audit.

### Unified Web/Admin Session Model

- Browser sessions land at the API with the JWT in the httpOnly `claw_session` cookie set by `/auth/verify`. Both `authMiddleware` and `adminAuthMiddleware` accept either a `Bearer <jwt>` header (used by SDK / CLI clients) or the cookie; the previous sentinel-string Bearer header used by the frontend is gone (`apps/web/src/components/providers/auth-provider.tsx` now exposes a `hasSession: boolean` instead of a `token` field).
- All `apps/web` admin and account pages fetch with `credentials: 'include'` and no `Authorization` header. The auth context never holds a fake token, so admin views fail closed when the cookie is missing or expired.
- Closes F-03 / P0.3 from the 2026-04-23 audit.

### Admin Audit Trail

- Every admin action logged with outcome (`success` / `failure`), wallet hash, IP hash, and request context (`apps/api/src/middleware/admin-audit.ts`).

### Cryptographic Standards

| Purpose | Algorithm | Notes |
|---------|-----------|-------|
| JWT signing | ES256 | Preferred |
| JWT signing (legacy) | HS256 | Fallback, phased deprecation |
| IP hashing | SHA-256 | Daily-rotating salt |
| Wallet hashing | SHA-256 | Stable salt |
| Webhook signatures | HMAC-SHA256 | Per-endpoint secret |
| At-rest encryption | AES-GCM | Per-record nonce |

---

## Planned Controls

These are designed and partially implemented but are **not yet enforced across all surfaces**. Do not rely on them as guarantees until they move to Implemented.

### Dependency and SAST Scanning

- CI currently runs: lint, typecheck, test, build, pattern sync.
- Dependency review, SAST, and secret scanning are **planned** but not yet wired into CI. See **Known Gaps**.

---

## Known Gaps

These are tracked issues identified by the 2026-04-23 external audit and open in the remediation backlog. Listed transparently so operators and contributors can make informed decisions.

### G-01 — `service_role` as Dominant Authorization Boundary

**Resolved 2026-05-07 (Onda 3 Frentes B.1 + B.2 + B.4).** Every user-bucket runtime path now authenticates under an anon-key client whose minted JWT carries the wallet as a custom claim. JWT-claim RLS policies on the user-scoped tables (`llm_keys`, `agents`, `agent_events`, `conversations`, `memories`, `character`, `alerts`, `tool_credentials`, `webhooks`, `credits_*`, `execution_logs`, `deployments`, `api_keys`, `governance_*`, `profiles`, `subscriptions`, `social_deliveries`) reject cross-tenant access at the database. Cross-tenant or atomic write paths run through SECURITY DEFINER RPCs (`purge_user_data`, `record_payment`, `approve_social_delivery`) that verify the JWT wallet claim before bypassing RLS for the privileged operation.

The remaining `getServiceClient` callers in `apps/api/src/` are documented exempt: auth bootstrap before the JWT exists, the API-key authenticated invoke endpoint, the system health probe, all admin routes and middleware, the scheduled CRON worker, and the helper module itself. Each is reviewed at PR time against the same exempt list to prevent regression. See G-05 for the closure timeline.

Entry retained for traceability and will be removed at the next SECURITY.md revision.

### G-02 — SSRF Enforcement Incomplete

**Resolved 2026-04-25 (Onda 2 Frente A.1).** `validateExternalUrl()` now runs at every documented user-controlled URL boundary listed under **Implemented Controls → SSRF / External URL Validation**. HTTPS is required by default; `http://` is rejected unless the caller explicitly opts in (no production caller does). Blocks emit `ssrf_blocked` security events. This entry remains for historical traceability and will be removed at the next SECURITY.md revision.

### G-03 — Admin Session Model Hybrid

**Resolved 2026-04-26 (Onda 2 Frente A.2).** The frontend no longer holds a sentinel `'authenticated'` token; the auth context exposes a `hasSession` boolean and every web/admin call sends `credentials: 'include'`. `adminAuthMiddleware` accepts either the httpOnly cookie or a real Bearer token, with the cookie as the browser path and Bearer reserved for SDK / CLI clients. Entry retained for traceability and will be removed at the next SECURITY.md revision.

### G-04 — CI Without Security Scanners

**Partially resolved 2026-04-26.** Secret scanning (gitleaks) and dependency audit (`npm audit` with allowlist gate) are wired in CI. Static analysis (SAST) is still on the backlog and will land alongside the move to GitHub Advanced Security when the repo migrates Org/public.

### G-05 — Writes With Application-Level Ownership Predicate

**Resolved 2026-05-07 (Onda 2 Frente A.3 + Onda 3 Frentes B.1 + B.2 + B.4).** Four remediations closed this finding in sequence:

- The `social-deliveries` approval path moved to a server-side predicate on 2026-04-26 (Frente A.3, see **Implemented Controls → Server-Side Ownership Predicate**).
- Frente B.1 (2026-04-26 → 2026-04-28) shifted every user-bucket read from service-role to JWT-claims RLS. Reads on `memories`, `character`, and `/user` now run under an anon-key client whose minted JWT carries the wallet as a custom claim, and parallel RLS policies reject cross-tenant access at the database.
- Frente B.2 (2026-04-28) replaced the GDPR `DELETE /user/data` cascade with a `SECURITY DEFINER` RPC `purge_user_data(wallet, wallet_hash, request_id, ip_hash)`. The function reads the caller's JWT `wallet_address` claim and refuses to proceed if it does not match the parameter; the ten ordered mutations plus the immutable `deletion_audit_log` insert run as a single Postgres transaction.
- Frente B.4 (2026-05-07) closed the last user-bucket residuals. `/payments/{status,history}` and `/social-deliveries` (GET) moved to `getUserClient` under the JWT-claims policies on `subscriptions`, `profiles`, and the new `social_deliveries_select_jwt`. `/payments/verify` replaced its cross-tenant `tx_signature` uniqueness check + subscription insert + profile update with a single `record_payment` SECURITY DEFINER RPC. `approve_social_delivery` was promoted to SECURITY DEFINER + JWT verification so the approve flow can run under the user JWT client.

After B.4, the only remaining `service_role` callers in the user-bucket runtime are documented exempt: auth bootstrap before the JWT exists (`routes/auth.ts`), the API-key authenticated invoke endpoint (`routes/invoke.ts`), the system health probe (`routes/health.ts`), all admin routes and middleware (`routes/admin*.ts`, `middleware/admin-{auth,audit}.ts`), and the scheduled CRON worker (`scheduled.ts`).

Entry retained for traceability and will be removed at the next SECURITY.md revision.

### G-06 — Branch Protection and CODEOWNERS Gating Not Active

The repo currently lives under a User account on the Free plan, which gates branch protection rules, rulesets, and Environments behind GitHub Pro for private repos. The `.github/CODEOWNERS` file is in tree but the team handles (`@guardianclaw/security`, `/ops`, `/core`, `/maintainers`) do not resolve in a User-account context, so PR review gating is informational only. CI status checks still run on every PR (Lint, TypeCheck, Test API, Test Web, Build, Pattern Sync, gitleaks); merges of failing checks rely on maintainer discipline rather than enforcement. This gap closes when the repo (a) moves to an Organization, or (b) is made public after Onda 2/3 hardening lands.

### G-07 — Long-Lived Cloudflare API Token

**Mitigated 2026-04-28 (Frente B.3 partial); credential rotated to least-privilege 2026-05-07.** `cloudflare/wrangler-action@v3`, the canonical action for deploying Workers from GitHub Actions, **does not yet implement OIDC token exchange** ([upstream issue #402](https://github.com/cloudflare/wrangler-action/issues/402), filed 2026-01-07, no implementation as of the Frente B.3 review). The originally-planned migration to GitHub OIDC federation cannot land until upstream support exists.

In the meantime the long-lived `CLOUDFLARE_API_TOKEN` GitHub secret stays the deploy credential. Risk is reduced via three controls rather than eliminated:

1. **Least-privilege scope.** The token in production (`claw-api-deploy-min-scope-20260507`) was issued from the Cloudflare dashboard "Edit Cloudflare Workers" template (Account: Workers Scripts:Edit, Workers KV Storage:Edit, Account Settings:Read, Workers Tail:Read). Account-scoped to `b7d1c882911fdee3ad40d959eeb3a4b9`. Zone-scoped Workers Routes:Edit on `guardianclaw.org` is added later, when the DNS migration in Frente I lands and routes return to `wrangler.toml`. The previous broad-scope token (`GuardianClaw Full Deploy`, with Zone Write/Read/Settings + DNS R/W + Workers Routes Write) was revoked on 2026-05-07 after a green deploy validated the min-scope replacement. Per-binding documentation in `_internal/projects/CHECKLIST_ROTACAO_SECRETS.md`.
2. **Quarterly rotation.** Cadence recorded in the same checklist; rotation re-uses the 5-points-of-truth procedure from Frente G.2.
3. **Standing alarm on the upstream issue.** When wrangler-action adds OIDC support, rotation removes the secret entirely and replaces it with `permissions: id-token: write` on the deploy job.

This entry closes when (a) the upstream action lands OIDC and the secret is removed, or (b) the deploy is rewritten on top of a non-action OIDC flow. Until then this is a Known Gap with active mitigation, not a deferred finding.

---

## Development Security

### Pre-commit Hooks

All commits must pass:
- ESLint (no warnings)
- Prettier formatting
- TypeScript type checking

### CI (Current)

| Job | Purpose |
|-----|---------|
| lint | ESLint on apps/api and apps/web |
| test-api | Vitest suite with coverage |
| test-web | Vitest suite (CI config) |
| typecheck | `tsc --noEmit` on both apps |
| build | Next.js build |
| pattern-sync | Verify `patterns/*.json` matches generated sources |

### CI (Being Added)

- **gitleaks** — secret scanning on every PR against full repo history.
- **Dependency review** and **SAST** — planned next.

### Secret Management

**Environment Variables:**
- Never committed to repository.
- Stored in Cloudflare Workers secrets (API) and Vercel Environment Variables (web).
- Rotation is currently manual and not on a fixed schedule. A documented rotation cadence is planned as part of the ops repository.

**Required Worker Secrets:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRET` (legacy HS256)
- `JWT_ES256_PRIVATE_KEY`
- `JWT_ES256_PUBLIC_KEY` (optional, derived from private)
- `IP_HASH_SECRET`
- `RESEND_API_KEY` (contact form)
- `SOLANA_RPC_URL` / `SOLANA_ARCHIVE_RPC_URL` (Helius)

### Public Environment Variables

Variables prefixed with `NEXT_PUBLIC_*` are **public by design** — embedded in the browser bundle. They are not secrets. Do not store anything confidential in a `NEXT_PUBLIC_*` variable.

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

- OWASP Top 10 — mitigations tracked per category. Coverage is not uniform; see **Known Gaps** for live issues.
- GDPR — data minimization, IP hashing, export/deletion endpoints implemented.
- SOC 2 — not claimed. Not in progress beyond alignment-minded decisions.

### Audits

- **Static audit:** 2026-04-23 Tier-1 static review. Findings tracked as `G-01` through `G-05` above.
- **Dynamic audit:** not yet performed. A dynamic round is a prerequisite for any "fully public managed platform" claim.

---

## Acknowledgments

We thank the security researchers who have helped improve GuardianClaw Platform:

*No acknowledgments yet. Be the first!*

---

**Last Updated:** 2026-05-07
**Version:** 1.2.0
