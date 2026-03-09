import { existsSync } from "node:fs";
import { resolveE2eEnvCandidates } from "./e2e-env-path.mjs";

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
  console.error("Missing required backend API e2e configuration:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

console.log("Backend API e2e configuration is present.");
