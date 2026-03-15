#!/usr/bin/env node

const baseUrl = (process.env.COLLECTOR_SMOKE_BASE_URL || "https://intel-dashboard-telegram-collector.latham.workers.dev")
  .trim()
  .replace(/\/+$/, "");
const maxAttempts = normalizePositiveInt(process.env.COLLECTOR_SMOKE_MAX_ATTEMPTS, 8);
const retryDelayMs = normalizeNonNegativeInt(process.env.COLLECTOR_SMOKE_RETRY_DELAY_MS, 5000);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeNonNegativeInt(rawValue, fallback) {
  const parsed = Number.parseInt(rawValue || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`collector ${path} returned non-JSON: ${text.slice(0, 200)}`);
  }
  return { response, payload, text };
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
  throw new Error(
    `${label} failed after ${maxAttempts} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
    { cause: lastError instanceof Error ? lastError : undefined },
  );
}

for (const path of ["/status", "/status/live"]) {
  await assertEventually(`collector smoke ${path}`, async () => {
    const { response, payload, text } = await fetchJson(path);
    assert(response.status === 200, `${path} expected 200, got ${response.status}: ${text.slice(0, 200)}`);
    assert(payload?.ok === true, `${path} should report ok=true: ${text.slice(0, 200)}`);
    assert(payload?.configured === true, `${path} should report configured=true: ${text.slice(0, 200)}`);
  });
}

console.log("Collector smoke passed");
