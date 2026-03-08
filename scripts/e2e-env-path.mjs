#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";

export function resolveSecureE2eEnvPath(envName = "e2e") {
  const codexHome = process.env.CODEX_HOME?.trim();
  const base = codexHome && codexHome.length > 0
    ? codexHome
    : join(homedir(), ".codex");
  return join(base, "secrets", `intel-dashboard.${envName}.env`);
}

export function resolveE2eEnvCandidates(root, envName = "e2e") {
  const explicit = process.env.E2E_ENV_FILE?.trim();
  const candidates = [];
  if (explicit) {
    candidates.push(explicit);
  }
  candidates.push(
    resolveSecureE2eEnvPath(envName),
    join(root, `.dev.vars.${envName}`),
    join(root, ".dev.vars"),
  );
  return [...new Set(candidates)];
}
