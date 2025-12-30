# CMS Load Testing Suite

Tools to measure your server's capacity and find its breaking point.

## Quick Start

### Option 1: Using k6 (Recommended)

```bash
# Install k6
# Windows: choco install k6  OR  winget install k6
# Mac: brew install k6
# Linux: sudo apt install k6

# Run quick capacity test
k6 run quick-test.js

# Run against specific server
k6 run --env BASE_URL=http://your-server:8080 quick-test.js
```

### Option 2: Using Docker (No installation)

```bash
# Windows
docker-run-test.bat http://host.docker.internal:8080

# Linux/Mac
docker run --rm -i -v $(pwd):/scripts grafana/k6 run \
  --env BASE_URL=http://host.docker.internal:8080 \
  /scripts/quick-test.js
```

### Option 3: Using Artillery (npm-based)

```bash
npm install -g artillery
artillery run artillery-config.yml
```

## Available Tests

| Test | Command | Description |
|------|---------|-------------|
| **Quick** | `run-tests --type quick` | 8-minute capacity finder (10→300 users) |
| **Smoke** | `run-tests --type smoke` | 30-second sanity check (5 users) |
| **Full** | `run-tests --type full` | 11-minute comprehensive suite |
| **Stress** | `run-tests --type stress` | 2-minute max stress (500 users) |

## Test Scripts

### run-tests.bat / run-tests.sh

Convenience wrapper scripts:

```bash
# Windows
run-tests.bat --url http://localhost:8080 --type quick

# Linux/Mac
./run-tests.sh --url http://localhost:8080 --type quick
```

### quick-test.js

Gradually ramps up from 10 to 300 users to find your server's capacity:

```
10 → 25 → 50 → 75 → 100 → 150 → 200 → 250 → 300 users
```

Outputs estimated capacity based on error rate and response times.

### load-test.js

Full test suite with multiple scenarios:
- Smoke test (1 user)
- Load test (0→50→100 users)
- Stress test (0→500 users)
- Spike test (sudden 500 user spike)

## Understanding Results

### Key Metrics

| Metric | Good | Warning | Critical |
|--------|------|---------|----------|
| Error Rate | <1% | 1-5% | >5% |
| P95 Response | <500ms | 500-1000ms | >1000ms |
| P99 Response | <1000ms | 1-2000ms | >2000ms |

### Capacity Estimation

Based on the quick test results:

| Error Rate | P95 Time | Estimated Capacity |
|------------|----------|-------------------|
| <1% | <500ms | 300+ users |
| <5% | <1000ms | 150-300 users |
| <10% | <2000ms | 75-150 users |
| <20% | any | 25-75 users |
| >20% | any | <25 users |

## Customization

### Testing Your Actual Endpoints

Edit `load-test.js` and modify the `apiEndpoints` function:

```javascript
const endpoints = [
  '/api/v1/your-endpoint',
  '/api/v1/another-endpoint',
];
```

### Adding Authentication

Set environment variables:

```bash
k6 run --env BASE_URL=http://localhost:8080 \
       --env TEST_EMAIL=real@email.com \
       --env TEST_PASSWORD=realpassword \
       load-test.js
```

### Custom Virtual Users & Duration

```bash
# 100 users for 5 minutes
k6 run --vus 100 --duration 5m quick-test.js

# Gradual ramp to 200 users
k6 run --stage 1m:50,2m:100,2m:200,1m:0 quick-test.js
```

## Output Reports

Tests generate JSON reports:
- `summary.json` - Full test results
- `capacity-report.json` - Capacity estimation

### HTML Report

```bash
k6 run --out json=results.json quick-test.js

# Convert to HTML (requires k6-reporter)
# See: https://github.com/benc-uk/k6-reporter
```

## For 2GB/2vCPU Server

Based on your resource constraints, expect:

| Workload | Realistic Capacity |
|----------|-------------------|
| Read-heavy (browsing) | 200-300 users |
| Mixed (read/write) | 100-150 users |
| Write-heavy (uploads) | 50-75 users |

Run the quick test to get your actual numbers!
