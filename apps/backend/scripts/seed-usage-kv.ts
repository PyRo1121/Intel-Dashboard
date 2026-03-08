import { readFile } from "node:fs/promises";
import { seedEntries, type UsageKvSeedEntry } from "../src/seed-client.js";

type ParsedArgs = Record<string, string | boolean>;

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

function usage(): void {
  console.log(
    [
      "Usage: bun run --cwd apps/backend seed -- --worker-base-url <url> --admin-token <token> --entries-file <path> [options]",
      "",
      "Options:",
      "  --worker-base-url <url>   Required unless INTEL_DASHBOARD_WORKER_BASE_URL is set",
      "  --admin-token <token>     Required unless INTEL_DASHBOARD_WORKER_ADMIN_TOKEN is set",
      "  --entries-file <path>     JSON file containing array of { key, value, ttlSeconds? }",
      "  --seed-path <path>        Optional seed path override",
      "  --batch-size <n>          Optional batch size (default 100)",
      "  --help                    Show this help",
    ].join("\n"),
  );
}

function getString(args: ParsedArgs, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function parseBatchSize(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("--batch-size must be a positive number.");
  }
  return Math.floor(parsed);
}

async function loadEntries(filePath: string): Promise<UsageKvSeedEntry[]> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("entries file must be a JSON array");
  }
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw new Error(`entry ${index + 1} must be an object`);
    }
    const record = entry as Record<string, unknown>;
    if (typeof record.key !== "string" || record.key.trim().length === 0) {
      throw new Error(`entry ${index + 1} requires non-empty string key`);
    }
    return {
      key: record.key,
      value: record.value,
      ...(typeof record.ttlSeconds === "number" ? { ttlSeconds: Math.floor(record.ttlSeconds) } : {}),
    };
  });
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === true) {
    usage();
    return;
  }

  const workerBaseUrl = getString(args, "worker-base-url") ?? process.env.INTEL_DASHBOARD_WORKER_BASE_URL;
  const adminToken = getString(args, "admin-token") ?? process.env.INTEL_DASHBOARD_WORKER_ADMIN_TOKEN;
  const entriesFile = getString(args, "entries-file");
  const seedPath = getString(args, "seed-path");
  const batchSize = parseBatchSize(getString(args, "batch-size"));

  if (!workerBaseUrl || !adminToken || !entriesFile) {
    usage();
    throw new Error("Missing required options: --worker-base-url, --admin-token, --entries-file");
  }

  const entries = await loadEntries(entriesFile);
  const result = await seedEntries({
    workerBaseUrl,
    adminToken,
    entries,
    seedPath,
    batchSize,
  });

  console.log(
    JSON.stringify(
      {
        endpoint: result.endpointUrl,
        entries: entries.length,
        batches: result.batches,
        written: result.written,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
