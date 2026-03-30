# Operations Runbook

Operational procedures for the GuardianClaw Platform.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployment](#deployment)
3. [Monitoring](#monitoring)
4. [Incident Response](#incident-response)
5. [Maintenance](#maintenance)

---

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Cloudflare     │────▶│  Cloudflare      │────▶│  Modal.com      │
│  Pages (Web)    │     │  Workers (API)   │     │  (LLM Runtime)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Supabase        │
                        │  (Database)      │
                        └──────────────────┘
```

### Components

| Component | Technology | Region | Purpose |
|-----------|------------|--------|---------|
| Web Frontend | Next.js on Cloudflare Pages | Global (Edge) | User interface |
| API | Hono on Cloudflare Workers | Global (Edge) | Backend API |
| Database | Supabase (PostgreSQL) | AWS us-east-1 | Data persistence |
| LLM Runtime | Modal.com | AWS us-east-1 | AI inference |
| Rate Limiting | Cloudflare KV | Global (Edge) | Request throttling |

### URLs

| Environment | Web | API |
|-------------|-----|-----|
| Production | https://guardianclaw.org | https://api.guardianclaw.org |
| Staging | https://staging.guardianclaw.org | https://staging-api.guardianclaw.org |
| Development | http://localhost:3000 | http://localhost:8787 |

---

## Deployment

### Automatic Deployment

Deployments are triggered automatically via GitHub Actions:

1. **On Push to `main`**: Deploys to production
2. **On Push to `develop`**: Deploys to staging

### Manual Deployment

#### API (Cloudflare Workers)

```bash
cd apps/api

# Staging
npm run deploy:staging

# Production
npm run deploy:production
```

#### Web (Cloudflare Pages)

```bash
cd apps/web

# Build
npm run build

# Deploy via Wrangler
npx wrangler pages deploy .next --project-name=guardianclaw-platform
```

### Pre-Deployment Checklist

- [ ] All tests passing (`npm run test:run`)
- [ ] Lint passing (`npm run lint`)
- [ ] Build successful (`npm run build`)
- [ ] Smoke test on staging
- [ ] No breaking changes in API contracts

### Post-Deployment Verification

1. **Health Check**
   ```bash
   curl https://api.guardianclaw.org/health
   ```

2. **Smoke Test**
   ```bash
   k6 run --env API_BASE_URL=https://api.guardianclaw.org k6/smoke-test.js
   ```

3. **Verify Metrics**
   ```bash
   curl https://api.guardianclaw.org/metrics
   ```

### Rollback

#### API Rollback

```bash
# List recent deployments
wrangler deployments list --env production

# Rollback to previous version
wrangler rollback --env production
```

#### Web Rollback

Via Cloudflare Dashboard:
1. Go to Pages > guardianclaw-platform
2. Click "Deployments"
3. Find previous working deployment
4. Click "Rollback to this deployment"

---

## Monitoring

### Health Endpoints

| Endpoint | Expected Response |
|----------|-------------------|
| `GET /health` | `{"status":"ok","timestamp":"..."}` |
| `GET /metrics` | Prometheus metrics |

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `claw_http_requests_total` | Total requests | - |
| `claw_http_request_duration_ms` | Request latency | P95 > 500ms |
| `claw_blocks_total` | GuardianClaw blocks | Spike detection |
| `claw_rate_limit_hits_total` | Rate limit hits | > 1000/min |

### Alerting

Configure alerts in Cloudflare or external monitoring:

```yaml
# Example: Prometheus alerting rule
- alert: HighLatency
  expr: histogram_quantile(0.95, rate(claw_http_request_duration_ms_bucket[5m])) > 500
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High API latency detected"
```

### Dashboards

Key panels to include:

1. Request Rate (req/s)
2. Error Rate (%)
3. P95 Latency
4. GuardianClaw Block Rate
5. Rate Limit Hits

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Service down | Immediate |
| P2 | Major degradation | < 30 min |
| P3 | Minor issues | < 4 hours |
| P4 | Cosmetic/low impact | Next business day |

### Common Issues

#### API Returning 500 Errors

1. Check Cloudflare Workers logs:
   ```bash
   wrangler tail --env production
   ```

2. Verify Supabase connectivity:
   - Check Supabase Dashboard status
   - Verify service key is valid

3. Check Modal.com status if LLM-related

#### High Latency

1. Check metrics for bottleneck:
   ```bash
   curl https://api.guardianclaw.org/metrics | grep duration
   ```

2. Check external service latency (Modal, Supabase)

3. Run load test to identify degradation:
   ```bash
   k6 run --env API_BASE_URL=https://api.guardianclaw.org k6/load-test.js
   ```

#### Rate Limiting Issues

1. Check current limits in `wrangler.toml`
2. Verify KV namespace is accessible
3. Check for abuse patterns in logs

### Escalation

1. **L1**: Check dashboards, restart if needed
2. **L2**: Deep-dive logs, identify root cause
3. **L3**: Code fix, coordinated deployment

---

## Maintenance

### Scheduled Maintenance

1. Announce maintenance window (minimum 24h notice)
2. Update status page
3. Perform maintenance
4. Verify system health
5. Update status page

### Database Migrations

> **Full documentation:** See [DATABASE_OPERATIONS.md](./DATABASE_OPERATIONS.md) for comprehensive
> database management procedures including migration creation, RLS policies, and troubleshooting.

Quick reference:

```bash
# Apply migrations via Supabase CLI
npx supabase db push

# List migrations
ls supabase/migrations/
```

**Important:** All migrations must be placed in `supabase/migrations/` directory only.

### Secrets Rotation

#### Cloudflare Workers Secrets

```bash
wrangler secret put JWT_SECRET --env production
wrangler secret put SUPABASE_SERVICE_KEY --env production
```

#### Rotation Schedule

| Secret | Rotation Frequency |
|--------|-------------------|
| JWT_SECRET | Quarterly |
| SUPABASE_SERVICE_KEY | Annually or on compromise |
| API_KEYS (users) | User-managed |

### Backup Procedures

1. **Database**: Supabase handles automatic backups
2. **Code**: Git repository
3. **Configuration**: Documented in wrangler.toml

### Performance Baseline

Run monthly to establish baselines:

```bash
# Run full test suite
k6 run k6/smoke-test.js
k6 run k6/load-test.js

# Archive results
mv *-results.json performance-baselines/$(date +%Y-%m)/
```

---

## Contacts

| Role | Contact |
|------|---------|
| On-Call | GuardianClaw Team |
| Cloudflare Support | https://support.cloudflare.com |
| Supabase Support | https://supabase.com/support |
| Modal Support | https://modal.com/support |

---

## Appendix

### Environment Variables

#### API (Cloudflare Workers)

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `MODAL_RUNTIME_URL` | Modal.com endpoint | No |
| `OPENAI_API_KEY` | OpenAI fallback key | No |

#### Web (Cloudflare Pages)

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | API base URL | Yes |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint | Yes |

### Useful Commands

```bash
# View real-time logs
wrangler tail --env production

# Check deployment status
wrangler deployments list --env production

# Test specific endpoint
curl -X POST https://api.guardianclaw.org/demo/test \
  -H "Content-Type: application/json" \
  -d '{"message":"test","flow":{"nodes":[],"edges":[]}}'

# Generate new API secret
openssl rand -base64 32
```
