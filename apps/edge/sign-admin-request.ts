import { signAdminRequest } from "./src/security-guards.ts";
import { SITE_ORIGIN } from "../shared/site-config.ts";

type OutputFormat = "headers" | "json" | "curl";

function readFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function hasFlag(args: string[], name: string): boolean {
  return args.includes(name);
}

function parseOutputFormat(raw: string | undefined): OutputFormat {
  if (!raw || raw === "headers") return "headers";
  if (raw === "json" || raw === "curl") return raw;
  throw new Error(`invalid format: ${raw}`);
}

function parseTimestamp(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  if (!/^\d{10,13}$/.test(raw)) {
    throw new Error("timestamp must be 10 or 13 digit unix time");
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("timestamp must be positive");
  }
  return raw.length === 10 ? parsed * 1000 : parsed;
}

function printUsage(): void {
  process.stdout.write(
    [
      "Usage:",
      "  node --experimental-strip-types apps/edge/sign-admin-request.ts --path /api/cache-bust --secret <CACHE_BUST_SECRET> [options]",
      "",
      "Options:",
      "  --path <path>           Required request path to sign (for example /api/cache-bust)",
      "  --method <method>       HTTP method to sign (default: POST)",
      "  --secret <value>        Shared admin signing secret (falls back to CACHE_BUST_SECRET env)",
      "  --nonce <value>         Optional fixed nonce for deterministic signing",
      "  --timestamp <unix>      Optional unix seconds or milliseconds",
      "  --url <url>             Optional full URL used by --format curl",
      "  --format <type>         headers | json | curl (default: headers)",
      "  --help                  Show this help",
      "",
      "Examples:",
      "  npm run admin:sign -- --path /api/cache-bust --secret \"$CACHE_BUST_SECRET\"",
      `  npm run admin:sign -- --path /api/scraper/trigger --url ${SITE_ORIGIN}/api/scraper/trigger --format curl`,
      "",
    ].join("\n"),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
    printUsage();
    return;
  }

  const path = readFlag(args, "--path")?.trim() ?? "";
  if (!path.startsWith("/")) {
    throw new Error("--path is required and must start with '/'");
  }

  const method = (readFlag(args, "--method")?.trim() || "POST").toUpperCase();
  const secret = readFlag(args, "--secret")?.trim() || process.env.CACHE_BUST_SECRET?.trim() || "";
  const format = parseOutputFormat(readFlag(args, "--format")?.trim());
  const url = readFlag(args, "--url")?.trim();
  const nonce = readFlag(args, "--nonce")?.trim();
  const timestampMs = parseTimestamp(readFlag(args, "--timestamp")?.trim());

  const signed = await signAdminRequest({
    method,
    path,
    configuredSecret: secret,
    nonce,
    timestampMs,
  });

  if (format === "json") {
    process.stdout.write(`${JSON.stringify({ method, path, ...signed }, null, 2)}\n`);
    return;
  }

  if (format === "curl") {
    const targetUrl = url || `${SITE_ORIGIN}${path}`;
    process.stdout.write(
      [
        `curl -X ${method} \"${targetUrl}\"`,
        `  -H \"X-Admin-Timestamp: ${signed.timestamp}\"`,
        `  -H \"X-Admin-Nonce: ${signed.nonce}\"`,
        `  -H \"X-Admin-Signature: ${signed.signature}\"`,
      ].join(" \\\n+"),
    );
    process.stdout.write("\n");
    return;
  }

  process.stdout.write(`X-Admin-Timestamp: ${signed.timestamp}\n`);
  process.stdout.write(`X-Admin-Nonce: ${signed.nonce}\n`);
  process.stdout.write(`X-Admin-Signature: ${signed.signature}\n`);
}

main().catch((error) => {
  const msg = error instanceof Error ? error.message : String(error);
  process.stderr.write(`admin-sign error: ${msg}\n`);
  process.exitCode = 1;
});
