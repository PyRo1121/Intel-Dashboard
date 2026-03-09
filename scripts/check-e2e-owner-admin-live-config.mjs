import { existsSync } from "node:fs";
import { resolveE2eEnvCandidates } from "./e2e-env-path.mjs";
import { SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

const root = process.cwd();
const envName = process.env.E2E_ENV_NAME?.trim() || "e2e";
const candidates = resolveE2eEnvCandidates(root, envName);

for (const candidate of candidates) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const edgeBaseUrl = (process.env.E2E_EDGE_BASE_URL?.trim() || SITE_ORIGIN).replace(/\/+$/, "");
const sessionCookie = process.env.E2E_SESSION_COOKIE?.trim() || "";
const accessClientId = process.env.E2E_CF_ACCESS_CLIENT_ID?.trim() || "";
const accessClientSecret = process.env.E2E_CF_ACCESS_CLIENT_SECRET?.trim() || "";

if (!sessionCookie) {
  console.error("Missing required owner/admin browser e2e configuration:");
  console.error("- E2E_SESSION_COOKIE");
  process.exit(1);
}

const headers = {
  Cookie: sessionCookie,
};
if ((accessClientId && !accessClientSecret) || (!accessClientId && accessClientSecret)) {
  console.error("E2E_CF_ACCESS_CLIENT_ID and E2E_CF_ACCESS_CLIENT_SECRET must be set together when using Cloudflare Access for owner/admin e2e.");
  process.exit(1);
}
if (accessClientId && accessClientSecret) {
  headers["CF-Access-Client-Id"] = accessClientId;
  headers["CF-Access-Client-Secret"] = accessClientSecret;
}

const response = await fetch(`${edgeBaseUrl}/api/auth/me`, {
  headers,
  signal: AbortSignal.timeout(20_000),
});

if (response.status !== 200) {
  console.error(`E2E_SESSION_COOKIE is invalid: /api/auth/me returned HTTP ${response.status}.`);
  process.exit(1);
}

const payload = await response.json().catch(() => null);
if (payload?.authenticated !== true || typeof payload?.user?.login !== "string") {
  console.error("E2E_SESSION_COOKIE check returned an unexpected authenticated payload.");
  process.exit(1);
}

console.log("Owner/admin browser e2e configuration is present and authenticated.");
