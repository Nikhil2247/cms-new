/**
 * K6 Load Test Script for CMS Backend
 *
 * Installation:
 *   - Windows: choco install k6  OR  winget install k6
 *   - Linux/Mac: brew install k6
 *   - Docker: docker run --rm -i grafana/k6 run - <load-test.js
 *
 * Usage:
 *   k6 run load-test.js
 *   k6 run --vus 50 --duration 30s load-test.js
 *   k6 run --out json=results.json load-test.js
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ============================================
// CONFIGURATION - Update these values
// ============================================
const BASE_URL = __ENV.BASE_URL || 'https://api.sukeerat.com';
const TEST_USER_EMAIL = __ENV.TEST_EMAIL || 'dtepunjab.internship@gmail.com';
const TEST_USER_PASSWORD = __ENV.TEST_PASSWORD || 'Dtepunjab@directorate';

// ============================================
// CUSTOM METRICS
// ============================================
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// ============================================
// TEST SCENARIOS
// ============================================
export const options = {
  scenarios: {
    // Scenario 1: Smoke Test (sanity check)
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '10s',
      startTime: '0s',
      tags: { test_type: 'smoke' },
    },

    // Scenario 2: Load Test (normal load)
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 },   // Ramp up to 50 users
        { duration: '1m', target: 50 },    // Stay at 50 users
        { duration: '30s', target: 100 },  // Ramp up to 100 users
        { duration: '1m', target: 100 },   // Stay at 100 users
        { duration: '30s', target: 0 },    // Ramp down
      ],
      startTime: '15s',
      tags: { test_type: 'load' },
    },

    // Scenario 3: Stress Test (find breaking point)
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 100 },  // Ramp up to 100
        { duration: '30s', target: 200 },  // Ramp up to 200
        { duration: '30s', target: 300 },  // Ramp up to 300
        { duration: '30s', target: 400 },  // Ramp up to 400
        { duration: '30s', target: 500 },  // Ramp up to 500
        { duration: '1m', target: 500 },   // Stay at 500
        { duration: '30s', target: 0 },    // Ramp down
      ],
      startTime: '4m',
      tags: { test_type: 'stress' },
    },

    // Scenario 4: Spike Test (sudden traffic spike)
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 10 },   // Normal load
        { duration: '5s', target: 500 },   // Spike!
        { duration: '30s', target: 500 },  // Stay at spike
        { duration: '10s', target: 10 },   // Back to normal
        { duration: '30s', target: 10 },   // Stay normal
        { duration: '5s', target: 0 },     // Ramp down
      ],
      startTime: '9m',
      tags: { test_type: 'spike' },
    },
  },

  // Thresholds - test fails if these are not met
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],  // 95% < 500ms, 99% < 1s
    http_req_failed: ['rate<0.05'],                  // Error rate < 5%
    errors: ['rate<0.1'],                            // Custom error rate < 10%
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function getHeaders(token = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function handleResponse(response, name) {
  const success = response.status >= 200 && response.status < 300;

  if (success) {
    successfulRequests.add(1);
  } else {
    failedRequests.add(1);
  }

  errorRate.add(!success);
  apiLatency.add(response.timings.duration);

  return success;
}

// ============================================
// TEST FUNCTIONS
// ============================================
function healthCheck() {
  group('Health Check', function () {
    const response = http.get(`${BASE_URL}/health`, {
      headers: getHeaders(),
      tags: { name: 'health' },
    });

    check(response, {
      'health check status is 200': (r) => r.status === 200,
      'health check response time < 200ms': (r) => r.timings.duration < 200,
    });

    handleResponse(response, 'health');
  });
}

function apiEndpoints(token = null) {
  group('API Endpoints', function () {
    // Test various GET endpoints - adjust these to match your actual API
    const endpoints = [
      '/api/users/me',
      '/api/state/dashboard',
      '/api/dashboard/critical-alerts',
      '/api/institutions',
      '/api/institutions/dashboard-stats'
    ];

    endpoints.forEach((endpoint) => {
      const response = http.get(`${BASE_URL}${endpoint}`, {
        headers: getHeaders(token),
        tags: { name: endpoint },
      });

      // Accept 200, 401 (if no token), 404 (if endpoint doesn't exist)
      check(response, {
        [`${endpoint} responds`]: (r) => [200, 401, 404].includes(r.status),
        [`${endpoint} response time < 500ms`]: (r) => r.timings.duration < 500,
      });

      handleResponse(response, endpoint);
    });
  });
}

function authFlow() {
  group('Authentication Flow', function () {
    // Login attempt
    const loginPayload = JSON.stringify({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    const loginResponse = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
      headers: getHeaders(),
      tags: { name: 'login' },
    });

    const loginSuccess = check(loginResponse, {
      'login status is 200 or 401': (r) => [200, 201, 401].includes(r.status),
      'login response time < 500ms': (r) => r.timings.duration < 500,
    });

    handleResponse(loginResponse, 'login');

    // Extract token if login successful
    let token = null;
    if (loginResponse.status === 200 || loginResponse.status === 201) {
      try {
        const body = JSON.parse(loginResponse.body);
        token = body.accessToken || body.access_token || body.token;
      } catch (e) {
        // Token extraction failed
      }
    }

    return token;
  });
}

function readHeavyOperations() {
  group('Read-Heavy Operations', function () {
    // Simulate pagination/listing requests
    const listEndpoints = [
      '/api/v1/content?page=1&limit=10',
      '/api/v1/content?page=1&limit=50',
      '/api/v1/users?page=1&limit=20',
    ];

    listEndpoints.forEach((endpoint) => {
      const response = http.get(`${BASE_URL}${endpoint}`, {
        headers: getHeaders(),
        tags: { name: 'list-operation' },
      });

      check(response, {
        'list operation responds': (r) => r.status < 500,
        'list operation < 1s': (r) => r.timings.duration < 1000,
      });

      handleResponse(response, 'list');
    });
  });
}

function writeOperations(token = null) {
  group('Write Operations', function () {
    // Test POST/PUT operations (adjust payload to match your API)
    const payload = JSON.stringify({
      title: `Load Test Content ${Date.now()}`,
      body: 'This is test content created during load testing',
      status: 'draft',
    });

    const response = http.post(`${BASE_URL}/api/v1/content`, payload, {
      headers: getHeaders(token),
      tags: { name: 'create-content' },
    });

    check(response, {
      'create responds': (r) => r.status < 500,
      'create response time < 1s': (r) => r.timings.duration < 1000,
    });

    handleResponse(response, 'create');
  });
}

// ============================================
// MAIN TEST EXECUTION
// ============================================
export default function () {
  // Always run health check
  healthCheck();
  sleep(0.5);

  // Random scenario selection for realistic traffic pattern
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Just browsing (read operations)
    readHeavyOperations();
  } else if (scenario < 0.7) {
    // 30% - API interactions
    apiEndpoints();
  } else if (scenario < 0.9) {
    // 20% - Auth flow
    const token = authFlow();
    if (token) {
      apiEndpoints(token);
    }
  } else {
    // 10% - Write operations
    const token = authFlow();
    writeOperations(token);
  }

  // Think time between requests (simulates real user behavior)
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// ============================================
// LIFECYCLE HOOKS
// ============================================
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);

  // Verify server is up
  const healthResponse = http.get(`${BASE_URL}/health`);
  if (healthResponse.status !== 200) {
    console.warn(`Warning: Health check returned ${healthResponse.status}`);
  }

  return { startTime: new Date().toISOString() };
}

export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
}

// ============================================
// CUSTOM SUMMARY
// ============================================
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalRequests: data.metrics.http_reqs?.values?.count || 0,
    failedRequests: data.metrics.http_req_failed?.values?.passes || 0,
    avgResponseTime: data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0,
    p95ResponseTime: data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0,
    p99ResponseTime: data.metrics.http_req_duration?.values['p(99)']?.toFixed(2) || 0,
    maxResponseTime: data.metrics.http_req_duration?.values?.max?.toFixed(2) || 0,
    requestsPerSecond: data.metrics.http_reqs?.values?.rate?.toFixed(2) || 0,
  };

  console.log('\n========== LOAD TEST SUMMARY ==========');
  console.log(`Total Requests:      ${summary.totalRequests}`);
  console.log(`Failed Requests:     ${summary.failedRequests}`);
  console.log(`Avg Response Time:   ${summary.avgResponseTime}ms`);
  console.log(`P95 Response Time:   ${summary.p95ResponseTime}ms`);
  console.log(`P99 Response Time:   ${summary.p99ResponseTime}ms`);
  console.log(`Max Response Time:   ${summary.maxResponseTime}ms`);
  console.log(`Requests/sec:        ${summary.requestsPerSecond}`);
  console.log('========================================\n');

  return {
    'summary.json': JSON.stringify(summary, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
