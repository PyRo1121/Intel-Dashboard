import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BACKEND_E2E_ORIGIN, SITE_ORIGIN } from "../shared/site-config.ts";
import { resolveSecureE2eEnvPath } from "./e2e-env-path.mjs";

const root = process.cwd();
const outputPath = process.env.E2E_ENV_FILE?.trim() || resolveSecureE2eEnvPath("e2e");
const legacyOutputPath = join(root, ".dev.vars.e2e");

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalFile(path) {
  try {
    if (existsSync(path)) {
      return trim(readFileSync(path, "utf8"));
    }
  } catch {
    // ignore file read failures
  }
  return "";
}

function readExistingEnvFile(path) {
  const values = {};
  if (!existsSync(path)) return values;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    try {
      values[key] = JSON.parse(rawValue);
    } catch {
      values[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
  return values;
}

function normalizeCookieHeader(rawValue, defaultName) {
  const value = trim(rawValue);
  if (!value) return "";
  if (value.includes("=")) return value;
  return `${defaultName}=${value}`;
}

const sessionCookieName = trim(process.env.E2E_SESSION_COOKIE_NAME) || "__Secure-better-auth.session_token";
const signoutSessionCookieName = trim(process.env.E2E_SIGNOUT_SESSION_COOKIE_NAME) || sessionCookieName;
const existingValues = {
  ...readExistingEnvFile(legacyOutputPath),
  ...readExistingEnvFile(outputPath),
};
const rawSessionCookie =
  trim(process.env.E2E_SESSION_COOKIE) ||
  trim(process.env.E2E_SESSION_TOKEN) ||
  readOptionalFile(trim(process.env.E2E_SESSION_COOKIE_FILE) || "/tmp/e2e_session_cookie.txt") ||
  trim(existingValues.E2E_SESSION_COOKIE);
const rawSignoutSessionCookie =
  trim(process.env.E2E_SIGNOUT_SESSION_COOKIE) ||
  trim(process.env.E2E_SIGNOUT_SESSION_TOKEN) ||
  readOptionalFile(trim(process.env.E2E_SIGNOUT_SESSION_COOKIE_FILE) || "/tmp/e2e_signout_session_cookie.txt") ||
  trim(existingValues.E2E_SIGNOUT_SESSION_COOKIE);

const values = {
  E2E_EDGE_BASE_URL: trim(process.env.E2E_EDGE_BASE_URL) || trim(existingValues.E2E_EDGE_BASE_URL) || SITE_ORIGIN,
  E2E_SESSION_COOKIE: normalizeCookieHeader(rawSessionCookie, sessionCookieName),
  E2E_SIGNOUT_SESSION_COOKIE: normalizeCookieHeader(rawSignoutSessionCookie, signoutSessionCookieName),
  E2E_BACKEND_BASE_URL:
    trim(process.env.E2E_BACKEND_BASE_URL) ||
    trim(existingValues.E2E_BACKEND_BASE_URL) ||
    BACKEND_E2E_ORIGIN,
  E2E_CF_ACCESS_CLIENT_ID:
    trim(process.env.E2E_CF_ACCESS_CLIENT_ID) ||
    trim(existingValues.E2E_CF_ACCESS_CLIENT_ID),
  E2E_CF_ACCESS_CLIENT_SECRET:
    trim(process.env.E2E_CF_ACCESS_CLIENT_SECRET) ||
    trim(existingValues.E2E_CF_ACCESS_CLIENT_SECRET),
  E2E_BACKEND_TOKEN:
    trim(process.env.E2E_BACKEND_TOKEN) ||
    readOptionalFile(trim(process.env.E2E_BACKEND_TOKEN_FILE) || "/tmp/e2e_backend_token.txt") ||
    trim(existingValues.E2E_BACKEND_TOKEN),
  E2E_AI_JOBS_TOKEN:
    trim(process.env.E2E_AI_JOBS_TOKEN) ||
    trim(existingValues.E2E_AI_JOBS_TOKEN),
  E2E_USER_ID: trim(process.env.E2E_USER_ID) || trim(existingValues.E2E_USER_ID) || "PyRo1121",
  E2E_NON_OWNER_USER_ID:
    trim(process.env.E2E_NON_OWNER_USER_ID) ||
    trim(existingValues.E2E_NON_OWNER_USER_ID) ||
    "e2e-non-owner",
};

const lines = Object.entries(values)
  .filter(([, value]) => value.length > 0)
  .map(([key, value]) => `${key}=${JSON.stringify(value)}`);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${lines.join("\n")}\n`, { mode: 0o600 });
chmodSync(outputPath, 0o600);
if (legacyOutputPath !== outputPath && existsSync(legacyOutputPath)) {
  rmSync(legacyOutputPath, { force: true });
}

console.log(`Saved e2e secrets to ${outputPath}`);
console.log("Loaded keys:");
for (const [key, value] of Object.entries(values)) {
  if (!value) continue;
  const redacted =
    key.includes("COOKIE") || key.includes("TOKEN")
      ? `${value.slice(0, 6)}...${value.slice(-4)}`
      : value;
  console.log(`- ${key}=${redacted}`);
}
