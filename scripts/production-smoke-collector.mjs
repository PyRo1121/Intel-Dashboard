#!/usr/bin/env node

const baseUrl = (process.env.COLLECTOR_SMOKE_BASE_URL || "https://intel-dashboard-telegram-collector.latham.workers.dev")
  .trim()
  .replace(/\/+$/, "");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
  return { response, payload };
}

for (const path of ["/status", "/status/live"]) {
  const { response, payload } = await fetchJson(path);
  assert(response.status === 200, `${path} expected 200, got ${response.status}`);
  assert(payload?.ok === true, `${path} should report ok=true`);
  assert(payload?.configured === true, `${path} should report configured=true`);
}

console.log("Collector smoke passed");
