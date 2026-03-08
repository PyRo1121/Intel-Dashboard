import { existsSync } from "node:fs";
import { resolveE2eEnvCandidates } from "./e2e-env-path.mjs";
import { SITE_ORIGIN } from "../packages/shared/site-config.ts";

const root = process.cwd();
const envName = process.env.E2E_ENV_NAME?.trim() || "e2e";
const candidates = resolveE2eEnvCandidates(root, envName);

for (const candidate of candidates) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
    break;
  }
}

const required = [
  "E2E_SESSION_COOKIE",
  "E2E_BACKEND_BASE_URL",
  "E2E_BACKEND_TOKEN",
  "E2E_USER_ID",
  "E2E_NON_OWNER_USER_ID",
];

const missing = required.filter((key) => {
  const value = process.env[key];
  return typeof value !== "string" || value.trim().length === 0;
});

if (missing.length > 0) {
  console.error("Missing required live e2e configuration:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

const accessClientId = process.env.E2E_CF_ACCESS_CLIENT_ID?.trim() || "";
const accessClientSecret = process.env.E2E_CF_ACCESS_CLIENT_SECRET?.trim() || "";
if ((accessClientId && !accessClientSecret) || (!accessClientId && accessClientSecret)) {
  console.error("E2E_CF_ACCESS_CLIENT_ID and E2E_CF_ACCESS_CLIENT_SECRET must be set together when using Cloudflare Access for backend e2e.");
  process.exit(1);
}

const edgeBaseUrl = (process.env.E2E_EDGE_BASE_URL?.trim() || SITE_ORIGIN).replace(/\/+$/, "");
const sessionCookie = process.env.E2E_SESSION_COOKIE.trim();
const signoutSessionCookie = process.env.E2E_SIGNOUT_SESSION_COOKIE?.trim() || "";

async function assertValidSessionCookie(label, cookieHeader) {
  const authResponse = await fetch(`${edgeBaseUrl}/api/auth/me`, {
    headers: {
      Cookie: cookieHeader,
    },
    signal: AbortSignal.timeout(20_000),
  });

  if (authResponse.status !== 200) {
    console.error(
      `${label} is invalid: /api/auth/me returned HTTP ${authResponse.status}. Refresh ${label} and rerun.`,
    );
    process.exit(1);
  }

  let authPayload = null;
  try {
    authPayload = await authResponse.json();
  } catch {
    console.error(`${label} check returned invalid JSON from /api/auth/me.`);
    process.exit(1);
  }

  if (authPayload?.authenticated !== true || typeof authPayload?.user?.login !== "string") {
    console.error(`${label} check returned an unexpected authenticated payload.`);
    process.exit(1);
  }
}

await assertValidSessionCookie("E2E_SESSION_COOKIE", sessionCookie);

if (signoutSessionCookie) {
  if (signoutSessionCookie === sessionCookie) {
    console.error("E2E_SIGNOUT_SESSION_COOKIE must differ from E2E_SESSION_COOKIE. Use a separate live session for destructive logout coverage.");
    process.exit(1);
  }
  await assertValidSessionCookie("E2E_SIGNOUT_SESSION_COOKIE", signoutSessionCookie);
}

console.log("Live e2e configuration is present and authenticated edge session validation passed.");
