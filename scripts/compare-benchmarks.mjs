#!/usr/bin/env node
import { readFileSync } from "node:fs";

function parseArgs(argv) {
  const args = {
    baseline: "",
    candidate: "",
    maxP95RegressionPct: 20,
    maxAvgRegressionPct: 20,
    minBaselineMs: 20,
    tinyBaselineMaxDeltaMs: 8,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key.startsWith("--")) continue;
    if (value === undefined) break;
    switch (key) {
      case "--baseline":
        args.baseline = value;
        index += 1;
        break;
      case "--candidate":
        args.candidate = value;
        index += 1;
        break;
      case "--max-p95-regression-pct":
        args.maxP95RegressionPct = Number.parseFloat(value) || args.maxP95RegressionPct;
        index += 1;
        break;
      case "--max-avg-regression-pct":
        args.maxAvgRegressionPct = Number.parseFloat(value) || args.maxAvgRegressionPct;
        index += 1;
        break;
      case "--min-baseline-ms":
        args.minBaselineMs = Number.parseFloat(value) || args.minBaselineMs;
        index += 1;
        break;
      case "--tiny-baseline-max-delta-ms":
        args.tinyBaselineMaxDeltaMs = Number.parseFloat(value) || args.tinyBaselineMaxDeltaMs;
        index += 1;
        break;
      default:
        break;
    }
  }

  if (!args.baseline || !args.candidate) {
    throw new Error(
      "Usage: node scripts/compare-benchmarks.mjs --baseline <file.json> --candidate <file.json> [threshold flags]",
    );
  }
  return args;
}

function loadBenchmark(path) {
  const parsed = JSON.parse(readFileSync(path, "utf8"));
  const map = new Map();
  for (const row of parsed.results || []) {
    map.set(row.id, row);
  }
  return map;
}

function pctDelta(base, current) {
  if (base === 0) return Number.POSITIVE_INFINITY;
  return ((current - base) / base) * 100;
}

function fmt(n) {
  return Number.isFinite(n) ? n.toFixed(1) : "inf";
}

const args = parseArgs(process.argv);
const baseline = loadBenchmark(args.baseline);
const candidate = loadBenchmark(args.candidate);

let failures = 0;

console.log("Benchmark regression check");
console.log(`baseline:  ${args.baseline}`);
console.log(`candidate: ${args.candidate}`);
console.log(
  `thresholds: p95<=${args.maxP95RegressionPct}% avg<=${args.maxAvgRegressionPct}% (base>=${args.minBaselineMs}ms), small-base delta<=${args.tinyBaselineMaxDeltaMs}ms`,
);
console.log("");

for (const [id, base] of baseline.entries()) {
  const current = candidate.get(id);
  if (!current) {
    console.log(`- ${id}: missing in candidate (FAIL)`);
    failures += 1;
    continue;
  }

  const checks = [
    { metric: "p95Ms", thresholdPct: args.maxP95RegressionPct },
    { metric: "avgMs", thresholdPct: args.maxAvgRegressionPct },
  ];

  let endpointFailed = false;
  const messages = [];
  for (const check of checks) {
    const baseValue = Number(base[check.metric] ?? 0);
    const currentValue = Number(current[check.metric] ?? 0);
    const deltaMs = currentValue - baseValue;
    const deltaPct = pctDelta(baseValue, currentValue);

    if (baseValue >= args.minBaselineMs) {
      if (deltaPct > check.thresholdPct) {
        endpointFailed = true;
        messages.push(
          `${check.metric} regressed ${fmt(deltaPct)}% (${fmt(baseValue)} -> ${fmt(currentValue)}ms)`,
        );
      }
    } else if (deltaMs > args.tinyBaselineMaxDeltaMs) {
      endpointFailed = true;
      messages.push(
        `${check.metric} regressed +${fmt(deltaMs)}ms on tiny baseline (${fmt(baseValue)} -> ${fmt(currentValue)}ms)`,
      );
    }
  }

  if (endpointFailed) {
    failures += 1;
    console.log(`- ${id}: FAIL | ${messages.join(" | ")}`);
  } else {
    const p95Delta = pctDelta(Number(base.p95Ms ?? 0), Number(current.p95Ms ?? 0));
    const avgDelta = pctDelta(Number(base.avgMs ?? 0), Number(current.avgMs ?? 0));
    console.log(`- ${id}: PASS | p95 ${fmt(p95Delta)}% | avg ${fmt(avgDelta)}%`);
  }
}

if (failures > 0) {
  console.error(`\nRegression check failed: ${failures} endpoint(s) exceeded thresholds.`);
  process.exit(1);
}

console.log("\nRegression check passed.");
