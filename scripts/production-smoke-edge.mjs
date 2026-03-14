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
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`expected JSON from ${response.url}, got: ${text.slice(0, 200)}`);
  }
}

const authMe = await fetch(`${baseUrl}/api/auth/me`, {
  signal: AbortSignal.timeout(20_000),
});
assert(authMe.status === 401, `/api/auth/me expected 401, got ${authMe.status}`);
const authPayload = await readJson(authMe);
assert(authPayload?.authenticated === false, "/api/auth/me should fail closed with authenticated=false");

const collectorIngest = await fetch(`${baseUrl}/api/telegram/collector-ingest`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ probe: true }),
  signal: AbortSignal.timeout(20_000),
});
assert(collectorIngest.status === 403, `/api/telegram/collector-ingest expected 403, got ${collectorIngest.status}`);
const collectorPayload = await readJson(collectorIngest);
assert(
  collectorPayload?.reason === "missing_headers" || collectorPayload?.error === "Forbidden",
  "collector ingest should fail closed for unsigned requests",
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
const backendPayload = await readJson(backendPassThrough);
assert(
  !Object.prototype.hasOwnProperty.call(backendPayload || {}, "login_url"),
  "/api/intel-dashboard/billing/status should not be blocked by edge session login gate",
);

console.log("Edge smoke passed");
