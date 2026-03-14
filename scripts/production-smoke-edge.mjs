#!/usr/bin/env node

const baseUrl = (process.env.EDGE_SMOKE_BASE_URL || "https://intel.pyro1121.com").trim().replace(/\/+$/, "");
const maxAttempts = Number.parseInt(process.env.EDGE_SMOKE_MAX_ATTEMPTS || "8", 10);
const retryDelayMs = Number.parseInt(process.env.EDGE_SMOKE_RETRY_DELAY_MS || "5000", 10);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response) {
  const text = await response.text();
  try {
    return { payload: text ? JSON.parse(text) : null, text };
  } catch {
    throw new Error(`expected JSON from ${response.url}, got: ${text.slice(0, 200)}`);
  }
}

async function assertEventually(label, fn) {
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await fn();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(retryDelayMs);
      }
    }
  }
  throw new Error(`${label} failed after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

await assertEventually("auth smoke", async () => {
  const authMe = await fetch(`${baseUrl}/api/auth/me`, {
    signal: AbortSignal.timeout(20_000),
  });
  assert(authMe.status === 401, `/api/auth/me expected 401, got ${authMe.status}`);
  const auth = await readJson(authMe);
  assert(auth.payload?.authenticated === false, `/api/auth/me should fail closed with authenticated=false: ${auth.text.slice(0, 200)}`);
});

await assertEventually("collector ingest smoke", async () => {
  const collectorIngest = await fetch(`${baseUrl}/api/telegram/collector-ingest`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ probe: true }),
    signal: AbortSignal.timeout(20_000),
  });
  assert(collectorIngest.status === 403, `/api/telegram/collector-ingest expected 403, got ${collectorIngest.status}`);
  const collector = await readJson(collectorIngest);
  assert(
    collector.payload?.reason === "missing_headers",
    `collector ingest should fail closed for unsigned requests: ${collector.text.slice(0, 200)}`,
  );
});

await assertEventually("backend pass-through smoke", async () => {
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
});

console.log("Edge smoke passed");
