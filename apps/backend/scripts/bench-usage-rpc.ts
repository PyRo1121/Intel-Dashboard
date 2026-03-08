import { performance } from "node:perf_hooks";

type ParsedArgs = Record<string, string | boolean>;

type BenchOptions = {
  label: string;
  baseUrl: string;
  token?: string;
  endpointPath: string;
  requests: number;
  concurrency: number;
  warmup: number;
  timeoutMs: number;
  body: { method: string; params: Record<string, unknown> };
};

type BenchResult = {
  label: string;
  requests: number;
  successes: number;
  failures: number;
  non2xx: number;
  durationMsTotal: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }
    const key = token.slice(2);
    if (!key) {
      continue;
    }
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function getString(args: ParsedArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getInt(args: ParsedArgs, key: string, fallback: number, min: number, max: number): number {
  const raw = getString(args, key);
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`--${key} must be a valid number.`);
  }
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function usage(): void {
  console.log(
    [
      "Usage: node --import tsx scripts/bench-usage-rpc.ts --base-url <url> [options]",
      "",
      "Required:",
      "  --base-url <url>                Target Worker origin",
      "",
      "Optional:",
      "  --token <token>                 Bearer token for target endpoint",
      "  --endpoint-path <path>          RPC path (default /api/intel-dashboard/usage-data-source)",
      "  --method <name>                 RPC method (default loadCostUsageSummary)",
      "  --start-ms <epoch-ms>           Range start (default now-30d)",
      "  --end-ms <epoch-ms>             Range end (default now)",
      "  --requests <n>                  Number of measured requests (default 100)",
      "  --concurrency <n>               In-flight requests (default 10)",
      "  --warmup <n>                    Warmup requests before measuring (default 5)",
      "  --timeout-ms <n>                Per-request timeout (default 10000)",
      "  --compare-base-url <url>        Optional baseline origin to compare against",
      "  --compare-token <token>         Optional baseline bearer token",
      "  --json                          Emit JSON output",
      "  --help                          Show this help",
    ].join("\n"),
  );
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return sorted[index] ?? 0;
}

function summarize(label: string, samples: number[], failures: number, non2xx: number): BenchResult {
  const sorted = [...samples].sort((a, b) => a - b);
  const requests = samples.length + failures;
  const successes = samples.length;
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    label,
    requests,
    successes,
    failures,
    non2xx,
    durationMsTotal: total,
    minMs: sorted[0] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0,
    avgMs: successes > 0 ? total / successes : 0,
    p50Ms: percentile(sorted, 50),
    p95Ms: percentile(sorted, 95),
    p99Ms: percentile(sorted, 99),
  };
}

async function runSingleRequest(args: {
  url: string;
  token?: string;
  timeoutMs: number;
  body: { method: string; params: Record<string, unknown> };
}): Promise<{ ok: boolean; status: number; elapsedMs: number }> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), args.timeoutMs);
  try {
    const response = await fetch(args.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(args.token ? { authorization: `Bearer ${args.token}` } : {}),
      },
      body: JSON.stringify(args.body),
      signal: controller.signal,
    });

    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: performance.now() - startedAt,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      elapsedMs: performance.now() - startedAt,
    };
  } finally {
    clearTimeout(timeoutHandle);
  }
}

async function runBenchmark(options: BenchOptions): Promise<BenchResult> {
  const target = new URL(options.baseUrl);
  target.pathname = options.endpointPath.startsWith("/") ? options.endpointPath : `/${options.endpointPath}`;
  target.search = "";
  target.hash = "";
  const url = target.toString();

  for (let index = 0; index < options.warmup; index += 1) {
    await runSingleRequest({
      url,
      token: options.token,
      timeoutMs: options.timeoutMs,
      body: options.body,
    });
  }

  const durations: number[] = [];
  let failures = 0;
  let non2xx = 0;
  let next = 0;

  const workers = Array.from({ length: options.concurrency }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= options.requests) {
        return;
      }

      const result = await runSingleRequest({
        url,
        token: options.token,
        timeoutMs: options.timeoutMs,
        body: options.body,
      });

      if (result.ok) {
        durations.push(result.elapsedMs);
      } else {
        failures += 1;
        if (result.status !== 0) {
          non2xx += 1;
        }
      }
    }
  });

  await Promise.all(workers);
  return summarize(options.label, durations, failures, non2xx);
}

function resolveDefaultBody(args: ParsedArgs): { method: string; params: Record<string, unknown> } {
  const method = getString(args, "method") ?? "loadCostUsageSummary";
  const now = Date.now();
  const endMs = getInt(args, "end-ms", now, 0, Number.MAX_SAFE_INTEGER);
  const startMs = getInt(args, "start-ms", endMs - 30 * 24 * 60 * 60 * 1000, 0, Number.MAX_SAFE_INTEGER);

  if (method === "loadCostUsageSummary" || method === "discoverSessionsForRange") {
    return { method, params: { startMs, endMs } };
  }

  return { method, params: { startMs, endMs } };
}

function printHuman(result: BenchResult): void {
  console.log(
    [
      `${result.label}:`,
      `  requests=${result.requests} success=${result.successes} failure=${result.failures} non2xx=${result.non2xx}`,
      `  latency_ms min=${result.minMs.toFixed(1)} avg=${result.avgMs.toFixed(1)} p50=${result.p50Ms.toFixed(1)} p95=${result.p95Ms.toFixed(1)} p99=${result.p99Ms.toFixed(1)} max=${result.maxMs.toFixed(1)}`,
    ].join("\n"),
  );
}

function printComparison(target: BenchResult, baseline: BenchResult): void {
  const p95Delta = target.p95Ms - baseline.p95Ms;
  const p99Delta = target.p99Ms - baseline.p99Ms;
  const errorDelta = target.failures - baseline.failures;
  console.log(
    [
      "comparison:",
      `  p95_delta_ms=${p95Delta.toFixed(1)}`,
      `  p99_delta_ms=${p99Delta.toFixed(1)}`,
      `  failure_delta=${errorDelta}`,
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === true) {
    usage();
    return;
  }

  const baseUrl = getString(args, "base-url") ?? process.env.INTEL_DASHBOARD_WORKER_BASE_URL;
  if (!baseUrl) {
    usage();
    throw new Error("Missing --base-url (or INTEL_DASHBOARD_WORKER_BASE_URL)");
  }

  const endpointPath = getString(args, "endpoint-path") ?? "/api/intel-dashboard/usage-data-source";
  const token = getString(args, "token") ?? process.env.INTEL_DASHBOARD_WORKER_TOKEN;
  const requests = getInt(args, "requests", 100, 1, 20_000);
  const concurrency = getInt(args, "concurrency", 10, 1, 500);
  const warmup = getInt(args, "warmup", 5, 0, 5000);
  const timeoutMs = getInt(args, "timeout-ms", 10_000, 100, 120_000);
  const body = resolveDefaultBody(args);

  const target = await runBenchmark({
    label: "target",
    baseUrl,
    token,
    endpointPath,
    requests,
    concurrency,
    warmup,
    timeoutMs,
    body,
  });

  const compareBaseUrl = getString(args, "compare-base-url");
  const compareToken = getString(args, "compare-token") ?? process.env.INTEL_DASHBOARD_COMPARE_TOKEN;

  const jsonOutput = args.json === true;
  if (!compareBaseUrl) {
    if (jsonOutput) {
      console.log(JSON.stringify({ target }, null, 2));
    } else {
      printHuman(target);
    }
    return;
  }

  const baseline = await runBenchmark({
    label: "baseline",
    baseUrl: compareBaseUrl,
    token: compareToken,
    endpointPath,
    requests,
    concurrency,
    warmup,
    timeoutMs,
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ target, baseline }, null, 2));
    return;
  }

  printHuman(target);
  printHuman(baseline);
  printComparison(target, baseline);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
