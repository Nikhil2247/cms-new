/**
 * K6 Quick Load Test - Find Server Capacity
 *
 * This script specifically tests how many concurrent users your server can handle.
 * It gradually increases load until the server starts failing.
 *
 * Usage:
 *   k6 run quick-test.js
 *   k6 run --env BASE_URL=http://your-server:8080 quick-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');

// Test stages - ramp up to find breaking point
export const options = {
  stages: [
    { duration: '30s', target: 10 },    // Warm up
    { duration: '30s', target: 25 },    // Light load
    { duration: '30s', target: 50 },    // Moderate load
    { duration: '30s', target: 75 },    // Medium load
    { duration: '30s', target: 100 },   // High load
    { duration: '30s', target: 150 },   // Very high load
    { duration: '30s', target: 200 },   // Stress
    { duration: '30s', target: 250 },   // Heavy stress
    { duration: '30s', target: 300 },   // Breaking point test
    { duration: '1m', target: 300 },    // Sustain max load
    { duration: '30s', target: 0 },     // Ramp down
  ],

  thresholds: {
    http_req_duration: ['p(95)<2000'],  // 95% requests < 2s
    http_req_failed: ['rate<0.1'],      // Less than 10% errors
  },
};

export default function () {
  // Primary test: Health endpoint
  const healthRes = http.get(`${BASE_URL}/health`, {
    timeout: '10s',
  });

  const healthOk = check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health time < 500ms': (r) => r.timings.duration < 500,
  });

  errorRate.add(!healthOk);
  responseTime.add(healthRes.timings.duration);

  // Secondary test: API endpoint
  const apiRes = http.get(`${BASE_URL}/api/v1/health`, {
    timeout: '10s',
  });

  check(apiRes, {
    'api responds': (r) => r.status < 500,
  });

  // Simulate user think time
  sleep(Math.random() * 1 + 0.5); // 0.5-1.5 seconds
}

export function handleSummary(data) {
  const vus = data.metrics.vus_max?.values?.max || 0;
  const reqs = data.metrics.http_reqs?.values?.count || 0;
  const rps = data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0;
  const avgTime = data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0;
  const p95Time = data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0;
  const failRate = ((data.metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2);

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              SERVER CAPACITY TEST RESULTS                     ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Max Virtual Users:        ${String(vus).padStart(6)}                         ║`);
  console.log(`║  Total Requests:           ${String(reqs).padStart(6)}                         ║`);
  console.log(`║  Requests/second:          ${String(rps).padStart(6)}                         ║`);
  console.log(`║  Avg Response Time:        ${String(avgTime).padStart(6)} ms                      ║`);
  console.log(`║  P95 Response Time:        ${String(p95Time).padStart(6)} ms                      ║`);
  console.log(`║  Error Rate:               ${String(failRate).padStart(6)} %                       ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');

  // Capacity estimation
  let capacity = 'Unknown';
  let recommendation = '';

  if (parseFloat(failRate) < 1 && parseFloat(p95Time) < 500) {
    capacity = '300+ users';
    recommendation = 'Server handles load well. Consider testing higher.';
  } else if (parseFloat(failRate) < 5 && parseFloat(p95Time) < 1000) {
    capacity = '150-300 users';
    recommendation = 'Good capacity. Monitor during peak hours.';
  } else if (parseFloat(failRate) < 10 && parseFloat(p95Time) < 2000) {
    capacity = '75-150 users';
    recommendation = 'Moderate capacity. Consider scaling for growth.';
  } else if (parseFloat(failRate) < 20) {
    capacity = '25-75 users';
    recommendation = 'Limited capacity. Optimize or scale resources.';
  } else {
    capacity = '<25 users';
    recommendation = 'Server struggling. Immediate optimization needed.';
  }

  console.log(`║  ESTIMATED CAPACITY:       ${capacity.padEnd(15)}               ║`);
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  ${recommendation.padEnd(60)} ║`);
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('\n');

  return {
    'capacity-report.json': JSON.stringify({
      maxVUs: vus,
      totalRequests: reqs,
      requestsPerSecond: rps,
      avgResponseTime: avgTime,
      p95ResponseTime: p95Time,
      errorRate: failRate,
      estimatedCapacity: capacity,
      recommendation: recommendation,
      timestamp: new Date().toISOString(),
    }, null, 2),
  };
}
