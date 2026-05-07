# Security Policy

## Status Honesty Statem ent

This document describes the **actual r untime enforcement** of the GuardianClaw Plat form as of the `Last Updated` date below. Con trols are classified as:

- **Implemented**  — present in code, executed at runtime, ex ercised by tests
- **Planned** — design ex ists but enforcement is partial or not wired  to all surfaces
- **Known gaps** — tracked  issues under active remediation

We will n ot overclaim. If a control is not enforced, i t is not listed as Implemented.

---

##  Supported Versions

| Version | Supported           |
| ------- | ------------------ |
 | 3.x.x   | :white_check_mark: |
| 2.x.x   |  :x:                |
| 1.x.x   | :x:                 |

---

## Reporting a Vulnerabi lity

We take the security of GuardianClaw  Platform seriously. If you discover a securit y vulnerability, please report it responsibly .

### How to Report

**Email:** security @guardianclaw.org

**Please include:**
- D escription of the vulnerability
- Steps to r eproduce
- Potential impact
- Any suggested  fixes (optional)

### Response Timeline
 
| Stage | Timeframe |
|-------|-----------| 
| Initial acknowledgment | 24 hours |
| Pr eliminary assessment | 72 hours |
| Fix deve lopment | 7-14 days (severity dependent) |
|  Public disclosure | 30 days after fix (coord inated) |

### What to Expect

1. **Ackno wledgment**: We will confirm receipt of your  report within 24 hours
2. **Communication**:  We will keep you informed of our progress
3 . **Credit**: With your permission, we will c redit you in the security advisory
4. **No l egal action**: We will not pursue legal actio n against researchers acting in good faith
 
### Scope

**In scope:**
- guardianclaw-p latform (this repository)
- API at api.guard ianclaw.org
- Web application at guardiancla w.org

**Out of scope:**
- Third-party ser vices (Supabase, Cloudflare, Vercel)
- Socia l engineering attacks
- Denial of Service (D oS/DDoS)
- Attacks requiring physical access 

---

## Architecture Overview

The pl atform layers Cloudflare Edge, a Hono-based A PI on Workers, and Supabase for persistence: 

```
┌───────────� ��──────────────� ��──────────────� ��──────────────� ��────────┐
│                      Cloudflare Edge                               │
│  (DDoS Protection, WAF, Bo t Management, TLS Termination)        │
� �──────────────� �──────────────� �──────────────� �──────────────� �─────┤
│                      API Gateway (Hono.js)                         │
│  Logging · Security Headers · Rate  Limit · CORS · Auth · Input  │
├─� ��──────────────� ��──────────────� ��──────────────� ��──────────────� ��───┤
│                     Datab ase (Supabase)                          │
 └────────────── ─────────────── ─────────────── ─────────────── ──────┘
```

---

## Imple mented Controls

Every item in this section  is enforced in code today. Links point to so urce.

### Authentication

- **Sign-In Wi th Solana (SIWS)** — wallet signature verif ication, no passwords.
- **JWT signing** —  ES256 preferred, HS256 legacy fallback (`app s/api/src/lib/jwt.ts`).
- **Token revocation ** — per-JTI revocation list backed by Work ers KV.
- **Session IP tracking** — last-u sed IPs recorded per wallet for suspicious-ac tivity detection.
- **Session cookie** — ` httpOnly`, `secure`, `SameSite=Lax`, `Domain= .guardianclaw.org`, `Max-Age=3600` (1 hour) ( `apps/api/src/routes/auth.ts`).

**Token li fetime caveat:** the browser session cookie e xpires after **1 hour**. The JWT body returne d for SDK/API clients carries its own `exp` c laim set by `JWTManager.createToken()`. Do no t assume a 24-hour session in browsers.

## # Authorization

- **Admin RBAC** — `supe r_admin`, `admin`, `support`, `viewer` roles  gated by `admin_roles` table (`apps/api/src/m iddleware/admin-auth.ts`).
- **Row-Level Sec urity (RLS)** — policies declared across 39  migrations in `supabase/migrations/`. See ** Known Gaps** section below for the honest ass essment of RLS enforcement at runtime.

###  Rate Limiting

- **Global:** 1000 requests /minute per IP (`apps/api/src/middleware/rate -limit.ts`).
- **Endpoint-specific:** tighte r limits on auth, deploy, LLM-key, governance .
- **Per-wallet:** separate bucket for auth enticated users.

| Endpoint Category | Lim it |
|------------------|-------|
| Authent ication | 10/min |
| Deploy operations | 5/m in |
| Agent invocation | 60/min |
| LLM ke y management | 5/min |
| Governance actions  | 5-20/min |

### HTTP Security Headers

 All API responses include:

| Header | Valu e |
|--------|-------|
| Content-Security-P olicy | Restrictive |
| Strict-Transport-Sec urity | 1 year, includeSubDomains |
| X-Cont ent-Type-Options | nosniff |
| X-Frame-Optio ns | DENY |
| Referrer-Policy | strict-origi n-when-cross-origin |
| Permissions-Policy |  All features disabled |
| Cache-Control | n o-store |

### CORS Configuration

**Allo wed Origins (Production):**
- https://guardi anclaw.org
- https://www.guardianclaw.org
-  https://staging.guardianclaw.org
- Vercel p review deployments (pattern-matched `*.vercel .app`)

**Development only:** http://localh ost:3000

**Credentials:** Allowed (require d for httpOnly cookie flow).

### Request L imits

- **Body size:** 2 MB, enforced as H ono global middleware (`apps/api/src/index.ts ` — returns HTTP 413 above threshold).
- * *JSON depth:** max 10 levels (`apps/api/src/m iddleware/sanitize.ts`).

### IP Change Det ection

- `detectSuspiciousActivity()` runs  in the auth middleware. Sessions used from 3 + recent IPs are blocked with HTTP 401 and a  `session_blocked` security event is emitted ( `apps/api/src/middleware/auth.ts`).

### We bhook Security

- **Inbound trigger endpoin ts** validate HMAC-SHA256 signatures, IPv4 +  IPv6 CIDR allowlists (BigInt arithmetic), rep lay protection, and per-endpoint rate limits. 
- **Webhook secret rotation** tracked via ` rotated_at` column and admin audit trail.

 ### Data Protection

- **IP hashing** — d aily-rotating salt, SHA-256 (`apps/api/src/li b/secure-logger.ts`).
- **Wallet hashing** i n logs — SHA-256.
- **Secret scrubbing** i n errors — patterns for `sk-*`, `sk_live_*` , JWTs, emails, file paths, DB connection str ings.
- **Encrypt-at-rest** for webhook secr ets and tool credentials — AES-GCM with per -record nonce.

### XSS Prevention

- Doc s renderer uses `react-markdown` with sanitiz ed link protocols (`javascript:`, `data:`, `v bscript:` blocked). No `dangerouslySetInnerHT ML` on user-controlled content.

### SSRF /  External URL Validation

- `validateExtern alUrl()` (`apps/api/src/middleware/sanitize.t s`) blocks: non-HTTP(S) schemes; plain `http: //` (require `https://` unless caller opts in  via `allowHttp`); IPv4 private ranges (`10.0 .0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`);  IPv4 loopback (`127.0.0.0/8`); IPv4 link-loca l (`169.254.0.0/16`); IPv6 loopback (`::1`);  IPv6 unique local (`fc00::/7`); IPv6 link-loc al (`fe80::/10`); cloud metadata IPs and host names (`169.254.169.254`, `metadata.google.in ternal`, `metadata.goog`); and our own infras tructure hostnames.
- The check runs at ever y user-controlled URL boundary that turns int o an outbound `fetch`:
    - **Webhook endpo int create / update** (`apps/api/src/routes/w ebhook-endpoints.ts`)
    - **Webhook delive ry execution** (`apps/api/src/services/webhoo k-delivery.ts`) — defense-in-depth re-check  at each delivery
    - **Alert rule create  / update / test** (`apps/api/src/routes/alert s.ts`)
    - **Background alert notification ** (`apps/api/src/services/agent-alerts.ts`) 
    - **Flow webhook output nodes** (`apps/a pi/src/services/execution.ts`)
    - **Tool  credential `custom_api` test** and **Discord  webhook credential test** (`apps/api/src/rout es/tool-credentials.ts`)
    - **Discord soc ial-connector delivery** (`apps/api/src/servi ces/social-connectors/discord.ts`)
- Blocks  emit a structured `ssrf_blocked` security eve nt via `SecureLogger`. The log includes the s urface label and the rejected hostname only � �� never the full URL (path/query may contain  credentials).
- HTTPS is required by defaul t. The `allowHttp` opt-in exists for developm ent integrations against non-TLS endpoints; p roduction callers do not pass it.

### Serv er-Side Ownership Predicate (Social Deliverie s)

- `approve_social_delivery(p_delivery_i d, p_wallet_address)` (`supabase/migrations/2 0260426000000_secure_approve_social_delivery. sql`) enforces the wallet-ownership check ins ide the same UPDATE statement that transition s the row from `draft` to `pending`. The rout e handler (`apps/api/src/routes/social-delive ries.ts`) does not perform a post-hoc revert  — if the caller does not own the agent, zer o rows update and the RPC returns `success=fa lse`. Closes the TOCTOU window flagged as F-0 5 / P1.1 in the 2026-04-23 audit.

### Unif ied Web/Admin Session Model

- Browser sess ions land at the API with the JWT in the http Only `claw_session` cookie set by `/auth/veri fy`. Both `authMiddleware` and `adminAuthMidd leware` accept either a `Bearer <jwt>` header  (used by SDK / CLI clients) or the cookie; t he previous sentinel-string Bearer header use d by the frontend is gone (`apps/web/src/comp onents/providers/auth-provider.tsx` now expos es a `hasSession: boolean` instead of a `toke n` field).
- All `apps/web` admin and accoun t pages fetch with `credentials: 'include'` a nd no `Authorization` header. The auth contex t never holds a fake token, so admin views fa il closed when the cookie is missing or expir ed.
- Closes F-03 / P0.3 from the 2026-04-23  audit.

### Admin Audit Trail

- Every a dmin action logged with outcome (`success` /  `failure`), wallet hash, IP hash, and request  context (`apps/api/src/middleware/admin-audi t.ts`).

### Cryptographic Standards

| P urpose | Algorithm | Notes |
|---------|---- -------|-------|
| JWT signing | ES256 | Pre ferred |
| JWT signing (legacy) | HS256 | Fa llback, phased deprecation |
| IP hashing |  SHA-256 | Daily-rotating salt |
| Wallet has hing | SHA-256 | Stable salt |
| Webhook sig natures | HMAC-SHA256 | Per-endpoint secret | 
| At-rest encryption | AES-GCM | Per-record  nonce |

---

## Planned Controls

The se are designed and partially implemented but  are **not yet enforced across all surfaces** . Do not rely on them as guarantees until the y move to Implemented.

### Dependency and  SAST Scanning

- CI currently runs: lint, t ypecheck, test, build, pattern sync.
- Depen dency review, SAST, and secret scanning are * *planned** but not yet wired into CI. See **K nown Gaps**.

---

## Known Gaps

These  are tracked issues identified by the 2026-04 -23 external audit and open in the remediatio n backlog. Listed transparently so operators  and contributors can make informed decisions. 

### G-01 — `service_role` as Dominant A uthorization Boundary

The API runtime uses  the Supabase `service_role` key across most  user-scoped routes. Declared RLS policies the refore act as **defense in depth**, not the p rimary boundary. The effective boundary today  is the application handler's predicate filte rs.

- **Impact:** a missed `.eq('wallet_ad dress', ...)` or analogous filter in a handle r could cross tenant boundaries because the d atabase call does not run under a restricted  user context.
- **Mitigation in flight (Fren te B.1, started 2026-04-26):**
  - `apps/api /src/lib/supabase-client.ts` exposes `getServ iceClient` (admin/cron/system) and `getUserCl ient(env, wallet)` (user-scoped). The latter  mints a short-lived HS256 JWT signed with `SU PABASE_JWT_SECRET`, carrying `role: 'authenti cated'` and the wallet as a custom claim.
   - Migration `20260427000000` adds parallel RL S policies on `llm_keys` keyed on the JWT's ` wallet_address` claim. Permissive policies ar e OR'd, so the existing GUC-based policies st ay in place during the rollout window.
  - ` routes/llm-keys.ts` is the pilot — flipped  to `getUserClient`. Subsequent routes migrate  one or two at a time per the inventory track ed locally in `_internal/auditoria/service-ro le-inventory.md`.
- **Until full rollout com pletes:** do not describe RLS as the effectiv e tenancy boundary across all routes. The pil ot route does have RLS as its primary barrier .

### G-02 — SSRF Enforcement Incomplete 

**Resolved 2026-04-25 (Onda 2 Frente A.1) .** `validateExternalUrl()` now runs at every  documented user-controlled URL boundary list ed under **Implemented Controls → SSRF / Ex ternal URL Validation**. HTTPS is required by  default; `http://` is rejected unless the ca ller explicitly opts in (no production caller  does). Blocks emit `ssrf_blocked` security e vents. This entry remains for historical trac eability and will be removed at the next SECU RITY.md revision.

### G-03 — Admin Sessi on Model Hybrid

**Resolved 2026-04-26 (Ond a 2 Frente A.2).** The frontend no longer hol ds a sentinel `'authenticated'` token; the au th context exposes a `hasSession` boolean and  every web/admin call sends `credentials: 'in clude'`. `adminAuthMiddleware` accepts either  the httpOnly cookie or a real Bearer token,  with the cookie as the browser path and Beare r reserved for SDK / CLI clients. Entry retai ned for traceability and will be removed at t he next SECURITY.md revision.

### G-04 —  CI Without Security Scanners

**Partially  resolved 2026-04-26.** Secret scanning (gitle aks) and dependency audit (`npm audit` with a llowlist gate) are wired in CI. Static analys is (SAST) is still on the backlog and will la nd alongside the move to GitHub Advanced Secu rity when the repo migrates Org/public.

## # G-05 — Writes With Application-Level Owne rship Predicate

**Resolved 2026-04-28 (Ond a 2 Frente A.3 + Onda 3 Frentes B.1 + B.2).**  Three remediations closed this finding in se quence:

- The `social-deliveries` approval  path moved to a server-side predicate on 202 6-04-26 (Frente A.3, see **Implemented Contro ls → Server-Side Ownership Predicate**).
-  Frente B.1 (2026-04-26 → 2026-04-28) shift ed every user-bucket read from service-role t o JWT-claims RLS. The reads on `memories`, `c haracter`, and `/user` now run under an anon- key client whose minted JWT carries the walle t as a custom claim, and parallel RLS policie s reject cross-tenant access at the database. 
- Frente B.2 (2026-04-28) replaced the last  service-role write — the GDPR `DELETE /use r/data` cascade — with a `SECURITY DEFINER`  RPC `purge_user_data(wallet, wallet_hash, re quest_id, ip_hash)`. The function reads the c aller's JWT `wallet_address` claim and refuse s to proceed if it does not match the paramet er; the ten ordered mutations plus the immuta ble `deletion_audit_log` insert run as a sing le Postgres transaction. The handler now uses  `getUserClient` and a single `rpc()` call.
 - The `memories` and `character` mutation pat hs run under JWT-claims RLS via `getUserClien t`. The `verifyAgentOwnership` check-then-wri te pattern is now belt-and-suspenders rather  than the boundary; RLS UPDATE policies on `ag ents` and `conversations` enforce the predica te at the database.

Entry retained for tra ceability and will be removed at the next SEC URITY.md revision.

### G-06 — Branch Pro tection and CODEOWNERS Gating Not Active

T he repo currently lives under a User account  on the Free plan, which gates branch protecti on rules, rulesets, and Environments behind G itHub Pro for private repos. The `.github/COD EOWNERS` file is in tree but the team handles  (`@guardianclaw/security`, `/ops`, `/core`,  `/maintainers`) do not resolve in a User-acco unt context, so PR review gating is informati onal only. CI status checks still run on ever y PR (Lint, TypeCheck, Test API, Test Web, Bu ild, Pattern Sync, gitleaks); merges of faili ng checks rely on maintainer discipline rathe r than enforcement. This gap closes when the  repo (a) moves to an Organization, or (b) is  made public after Onda 2/3 hardening lands.
 
### G-07 — Long-Lived Cloudflare API Toke n

**Mitigated 2026-04-28 (Frente B.3 parti al).** `cloudflare/wrangler-action@v3`, the c anonical action for deploying Workers from Gi tHub Actions, **does not yet implement OIDC t oken exchange** ([upstream issue #402](https: //github.com/cloudflare/wrangler-action/issue s/402), filed 2026-01-07, no implementation a s of the Frente B.3 review). The originally-p lanned migration to GitHub OIDC federation ca nnot land until upstream support exists.

I n the meantime the long-lived `CLOUDFLARE_API _TOKEN` GitHub secret stays the deploy creden tial. Risk is reduced via three controls rath er than eliminated:

1. **Least-privilege s cope.** The token must be issued from the Clo udflare dashboard "Edit Cloudflare Workers" t emplate (Account: Workers Scripts:Edit, Worke rs KV Storage:Edit, Account Settings:Read, Wo rkers Tail:Read; User: User Details:Read). Ac count-scoped to `b7d1c882911fdee3ad40d959eeb3 a4b9`. Zone-scoped Workers Routes:Edit on `gu ardianclaw.org` is added later, when the DNS  migration in Frente I lands and routes return  to `wrangler.toml`. This is documented per-b inding in `_internal/projects/CHECKLIST_ROTAC AO_SECRETS.md`.
2. **Quarterly rotation.** C adence recorded in the same checklist; rotati on re-uses the 5-points-of-truth procedure fr om Frente G.2.
3. **Standing alarm on the up stream issue.** When wrangler-action adds OID C support, rotation removes the secret entire ly and replaces it with `permissions: id-toke n: write` on the deploy job.

This entry cl oses when (a) the upstream action lands OIDC  and the secret is removed, or (b) the deploy  is rewritten on top of a non-action OIDC flow . Until then this is a Known Gap with active  mitigation, not a deferred finding.

---
 
## Development Security

### Pre-commit Ho oks

All commits must pass:
- ESLint (no w arnings)
- Prettier formatting
- TypeScript  type checking

### CI (Current)

| Job |  Purpose |
|-----|---------|
| lint | ESLin t on apps/api and apps/web |
| test-api | Vi test suite with coverage |
| test-web | Vite st suite (CI config) |
| typecheck | `tsc -- noEmit` on both apps |
| build | Next.js bui ld |
| pattern-sync | Verify `patterns/*.jso n` matches generated sources |

### CI (Bei ng Added)

- **gitleaks** — secret scanni ng on every PR against full repo history.
-  **Dependency review** and **SAST** — planne d next.

### Secret Management

**Environ ment Variables:**
- Never committed to repos itory.
- Stored in Cloudflare Workers secret s (API) and Vercel Environment Variables (web ).
- Rotation is currently manual and not on  a fixed schedule. A documented rotation cade nce is planned as part of the ops repository. 

**Required Worker Secrets:**
- `SUPABASE _URL`
- `SUPABASE_SERVICE_KEY`
- `JWT_SECRE T` (legacy HS256)
- `JWT_ES256_PRIVATE_KEY` 
- `JWT_ES256_PUBLIC_KEY` (optional, derived  from private)
- `IP_HASH_SECRET`
- `RESEND_ API_KEY` (contact form)
- `SOLANA_RPC_URL` /  `SOLANA_ARCHIVE_RPC_URL` (Helius)

### Pub lic Environment Variables

Variables prefix ed with `NEXT_PUBLIC_*` are **public by desig n** — embedded in the browser bundle. They  are not secrets. Do not store anything confid ential in a `NEXT_PUBLIC_*` variable.

--- 

## Incident Response

### Classification 

| Severity | Response Time | Examples |
 |----------|--------------|----------|
| Cri tical | 1 hour | Data breach, RCE |
| High |  4 hours | Auth bypass, SQLi |
| Medium | 24  hours | XSS, CSRF |
| Low | 72 hours | Info  disclosure |

### Contact

**Security Te am:** security@guardianclaw.org

**Escalati on:** For critical issues, email with subject  line `[CRITICAL]`

---

## Compliance
 
### Standards

- OWASP Top 10 — mitigati ons tracked per category. Coverage is not uni form; see **Known Gaps** for live issues.
-  GDPR — data minimization, IP hashing, expor t/deletion endpoints implemented.
- SOC 2 � � not claimed. Not in progress beyond alignme nt-minded decisions.

### Audits

- **Sta tic audit:** 2026-04-23 Tier-1 static review.  Findings tracked as `G-01` through `G-05` ab ove.
- **Dynamic audit:** not yet performed.  A dynamic round is a prerequisite for any "f ully public managed platform" claim.

---
 
## Acknowledgments

We thank the security  researchers who have helped improve Guardian Claw Platform:

*No acknowledgments yet. Be  the first!*

---

**Last Updated:** 2026 -04-24
**Version:** 1.1.0
 