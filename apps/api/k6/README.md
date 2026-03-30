# Performance Testing

K6-based performance testing suite for the GuardianClaw API.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Windows
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

## Test Types

| Test             | Duration | Purpose                   |
| ---------------- | -------- | ------------------------- |
| `smoke-test.js`  | 30s      | Quick sanity check        |
| `load-test.js`   | 9min     | Normal traffic simulation |
| `stress-test.js` | 15min    | Find breaking points      |
| `spike-test.js`  | 6min     | Sudden traffic spikes     |

## Usage

### Local Development

```bash
# Start the API locally first
npm run dev

# Run smoke test
k6 run k6/smoke-test.js

# Run load test
k6 run k6/load-test.js
```

### Against Staging/Production

```bash
# Staging
k6 run --env API_BASE_URL=https://staging-api.guardianclaw.org k6/smoke-test.js

# Production (use with caution!)
k6 run --env API_BASE_URL=https://api.guardianclaw.org k6/smoke-test.js
```

### With Authentication

For tests requiring API keys:

```bash
k6 run \
  --env API_BASE_URL=https://api.guardianclaw.org \
  --env API_KEY=sk_live_your_key_here \
  --env AGENT_ID=your-agent-id \
  k6/load-test.js
```

## Thresholds

### Standard Thresholds (Load Test)

| Metric      | Threshold | Description                   |
| ----------- | --------- | ----------------------------- |
| P95 Latency | < 500ms   | 95th percentile response time |
| P99 Latency | < 1000ms  | 99th percentile response time |
| Error Rate  | < 1%      | Failed requests percentage    |

### Relaxed Thresholds (Stress Test)

| Metric      | Threshold | Description                         |
| ----------- | --------- | ----------------------------------- |
| P95 Latency | < 2000ms  | Allow slower responses under stress |
| P99 Latency | < 5000ms  | Allow degradation                   |
| Error Rate  | < 10%     | Some errors expected                |

## Output

Each test generates a JSON report:

- `smoke-test-results.json`
- `load-test-results.json`
- `stress-test-results.json`
- `spike-test-results.json`

### Example Output

```
============================================================
LOAD TEST SUMMARY
============================================================
Status:          PASSED
------------------------------------------------------------
Total Requests:  5420
Throughput:      10.04 req/s
Error Rate:      0.185%
------------------------------------------------------------
P50 Latency:     45.23ms
P95 Latency:     234.56ms
P99 Latency:     456.78ms
------------------------------------------------------------
Health P95:      12.34ms
Demo P95:        345.67ms
GuardianClaw Blocks: 23
============================================================

THRESHOLD ANALYSIS:
  P95 < 500ms:   PASS (234.56ms)
  P99 < 1000ms:  PASS (456.78ms)
  Errors < 1%:   PASS (0.185%)
```

## CI Integration

Add to GitHub Actions:

```yaml
- name: Run K6 Smoke Test
  uses: grafana/k6-action@v0.3.0
  with:
    filename: apps/api/k6/smoke-test.js
  env:
    API_BASE_URL: ${{ secrets.STAGING_API_URL }}
```

## Grafana Cloud Integration

For visualization:

```bash
k6 run \
  --out cloud \
  --env K6_CLOUD_PROJECT_ID=your-project-id \
  k6/load-test.js
```

## Best Practices

1. **Always run smoke test first** before load/stress tests
2. **Use staging** for stress tests, not production
3. **Schedule stress tests** during low-traffic periods
4. **Monitor infrastructure** during tests (CPU, memory, network)
5. **Compare baselines** after each deployment

## Troubleshooting

### High Error Rate

- Check if API is running and healthy
- Verify rate limits aren't too aggressive
- Check for network issues

### Timeouts

- Increase timeout in test config
- Check if downstream services are slow
- Verify Cloudflare isn't blocking requests

### Inconsistent Results

- Run multiple iterations
- Check for background processes
- Use isolated test environment
