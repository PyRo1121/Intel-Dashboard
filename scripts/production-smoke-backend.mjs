#!/usr/bin/env node

const baseUrl = (process.env.BACKEND_SMOKE_BASE_URL || "https://backend-e2e.pyro1121.com").trim().replace(/\/+$/, "");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const response = await fetch(`${baseUrl}/health`, {
  redirect: "manual",
  signal: AbortSignal.timeout(20_000),
});

assert(
  response.status === 403 || response.status === 200,
  `backend health expected 200 or 403, got ${response.status}`,
);

if (response.status === 403) {
  const accessDomain = response.headers.get("cf-access-domain") || "";
  assert(accessDomain.length > 0, "backend 403 should come from Cloudflare Access");
}

console.log(`Backend smoke passed with HTTP ${response.status}`);
