#!/usr/bin/env node
import { performance } from "node:perf_hooks";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BACKEND_E2E_ORIGIN, SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

const DEFAULT_EDGE_BASE = SITE_ORIGIN;
const DEFAULT_BACKEND_BASE = BACKEND_E2E_ORIGIN;
const BACKEND_ACCESS_CLIENT_ID = trim(process.env.BENCH_CF_ACCESS_CLIENT_ID);
const BACKEND_ACCESS_CLIENT_SECRET = trim(process.env.BENCH_CF_ACCESS_CLIENT_SECRET);

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBaseUrl(rawValue, fallback) {
  const raw = trim(rawValue) || fallback;
  return raw.replace(/\/+$/, "");
}

function parseArgs(argv) {
  const args = {
    requests: 30,
    concurrency: 5,
    timeoutMs: 20_000,
    edgeBase: normalizeBaseUrl(process.env.BENCH_EDGE_BASE_URL, DEFAULT_EDGE_BASE),
    backendBase: normalizeBaseUrl(process.env.BENCH_BACKEND_BASE_URL, DEFAULT_BACKEND_BASE),
    jsonOut: "",
  };

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--")) continue;
    if (value === undefined) break;
    switch (key) {
      case "--requests":
        args.requests = Math.max(1, Number.parseInt(value, 10) || args.requests);
        index += 1;
        break;
      case "--concurrency":
        args.concurrency = Math.max(1, Number.parseInt(value, 10) || args.concurrency);
        index += 1;
        break;
      case "--timeout-ms":
        args.timeoutMs = Math.max(1_000, Number.parseInt(value, 10) || args.timeoutMs);
        index += 1;
        break;
      case "--edge-base":
        args.edgeBase = normalizeBaseUrl(value, args.edgeBase);
        index += 1;
        break;
      case "--backend-base":
        args.backendBase = normalizeBaseUrl(value, args.backendBase);
        index += 1;
        break;
      case "--json-out":
        args.jsonOut = value;
        index += 1;
        break;
      default:
        break;
    }
  }
  return args;
}

function percentile(samples, pct) {
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[index];
}

function average(samples) {
  if (samples.length === 0) return null;
  return samples.reduce((sum, value) => sum + value, 0) / samples.length;
}

function round(value) {
  return value == null ? "-" : `${value.toFixed(1)}ms`;
}

async function runWithConcurrency(total, concurrency, worker) {
  let cursor = 0;
  const out = [];

  async function runner() {
    for (;;) {
      const current = cursor;
      cursor += 1;
      if (current >= total) return;
      out[current] = await worker(current);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => runner()));
  return out;
}

async function benchmarkEndpoint(endpoint, options) {
  const results = await runWithConcurrency(options.requests, options.concurrency, async () => {
    const started = performance.now();
    try {
      const headers = new Headers(endpoint.headers || {});
      if (
        endpoint.url.startsWith(options.backendBase) &&
        BACKEND_ACCESS_CLIENT_ID &&
        BACKEND_ACCESS_CLIENT_SECRET
      ) {
        headers.set("CF-Access-Client-Id", BACKEND_ACCESS_CLIENT_ID);
        headers.set("CF-Access-Client-Secret", BACKEND_ACCESS_CLIENT_SECRET);
      }
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers,
        body: endpoint.body,
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      const durationMs = performance.now() - started;
      return { ok: true, status: response.status, durationMs };
    } catch (error) {
      const durationMs = performance.now() - started;
      return { ok: false, status: "ERR", durationMs, error: String(error) };
    }
  });

  const durations = results.filter((result) => result.ok).map((result) => result.durationMs);
  const statusCounts = {};
  let errorCount = 0;
  for (const result of results) {
    if (!result.ok) {
      errorCount += 1;
      continue;
    }
    const key = String(result.status);
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }

  return {
    id: endpoint.id,
    method: endpoint.method,
    url: endpoint.url,
    requests: options.requests,
    success: durations.length,
    errors: errorCount,
    statuses: statusCounts,
    avgMs: average(durations),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
  };
}

function printReport(config, summaries) {
  console.log("Free-tier latency benchmark");
  console.log(`edge:    ${config.edgeBase}`);
  console.log(`backend: ${config.backendBase}`);
  console.log(`requests per endpoint: ${config.requests} | concurrency: ${config.concurrency}`);
  console.log("");
  console.log("endpoint                              req   ok  err   avg      p50      p95      p99    statuses");
  console.log("----------------------------------------------------------------------------------------------------");
  for (const item of summaries) {
    const statuses = Object.entries(item.statuses)
      .map(([code, count]) => `${code}:${count}`)
      .join(",");
    const name = `${item.id}`.padEnd(36, " ");
    const row = [
      name,
      String(item.requests).padStart(4, " "),
      String(item.success).padStart(4, " "),
      String(item.errors).padStart(4, " "),
      round(item.avgMs).padStart(8, " "),
      round(item.p50Ms).padStart(8, " "),
      round(item.p95Ms).padStart(8, " "),
      round(item.p99Ms).padStart(8, " "),
      statuses,
    ].join(" ");
    console.log(row);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  const endpoints = [
    { id: "edge_landing", method: "GET", url: `${args.edgeBase}/` },
    { id: "edge_auth_me", method: "GET", url: `${args.edgeBase}/api/auth/me` },
    { id: "edge_telegram_auth_gate", method: "GET", url: `${args.edgeBase}/api/telegram` },
    {
      id: "backend_user_info_auth_gate",
      method: "POST",
      url: `${args.backendBase}/api/intel-dashboard/user-info`,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: "benchmark-user" }),
    },
  ];

  const summaries = [];
  for (const endpoint of endpoints) {
    summaries.push(await benchmarkEndpoint(endpoint, args));
  }

  printReport(args, summaries);

  const output = {
    timestamp: new Date().toISOString(),
    config: {
      edgeBase: args.edgeBase,
      backendBase: args.backendBase,
      requests: args.requests,
      concurrency: args.concurrency,
      timeoutMs: args.timeoutMs,
    },
    results: summaries,
  };

  if (args.jsonOut) {
    mkdirSync(dirname(args.jsonOut), { recursive: true });
    writeFileSync(args.jsonOut, JSON.stringify(output, null, 2));
    console.log(`\nWrote benchmark JSON: ${args.jsonOut}`);
  }
}

await main();
