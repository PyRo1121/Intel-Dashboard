import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
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

const args = process.argv.slice(2);
const testArgs = args.length > 0 ? args : ["--test", "e2e/smoke.test.mjs", "e2e/coverage-contract.test.mjs"];

execFileSync(process.execPath, ["--experimental-strip-types", ...testArgs], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
