#!/usr/bin/env node

const baseUrl = (process.env.EDGE_SMOKE_BASE_URL || "https://intel.pyro1121.com").trim().replace(/\/+$/, "");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return { payload: text ? JSON.parse(text) : null, text };
  } catch {
    throw new Error(`expected JSON from ${response.url}, got: ${text.slice(0, 200)}`);
  }
}

const authMe = await fetch(`${baseUrl}/api/auth/me`, {
  signal: AbortSignal.timeout(20_000),
});
assert(authMe.status === 401, `/api/auth/me expected 401, got ${authMe.status}`);
const auth = await readJson(authMe);
assert(auth.payload?.authenticated === false, `/api/auth/me should fail closed with authenticated=false: ${auth.text.slice(0, 200)}`);

const collectorIngest = await fetch(`${baseUrl}/api/telegram/collector-ingest`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ probe: true }),
  signal: AbortSignal.timeout(20_000),
});
assert(collectorIngest.status === 403, `/api/telegram/collector-ingest expected 403, got ${collectorIngest.status}`);
const collector = await readJson(collectorIngest);
assert(
  collector.payload?.reason === "missing_headers" || collector.payload?.error === "Forbidden",
  `collector ingest should fail closed for unsigned requests: ${collector.text.slice(0, 200)}`,
);

const backendPassThrough = await fetch(`${baseUrl}/api/intel-dashboard/billing/status`, {
  method: "POST",
  headers: {
    authorization: "Bearer invalid-token",
    "content-type": "application/json",
  },
  body: JSON.stringify({ userId: "PyRo1121" }),
  signal: AbortSignal.timeout(20_000),
});
assert(
  backendPassThrough.status === 401 || backendPassThrough.status === 403,
  `/api/intel-dashboard/billing/status expected 401/403, got ${backendPassThrough.status}`,
);
const backend = await readJson(backendPassThrough);
assert(
  !Object.prototype.hasOwnProperty.call(backend.payload || {}, "login_url"),
  `/api/intel-dashboard/billing/status should not be blocked by edge session login gate: ${backend.text.slice(0, 200)}`,
);

console.log("Edge smoke passed");
