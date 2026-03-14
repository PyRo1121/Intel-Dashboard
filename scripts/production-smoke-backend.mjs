#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

const configPath = (process.env.BACKEND_WRANGLER_CONFIG || "apps/backend/wrangler.jsonc").trim();
const deployStartedAt = Number.parseInt(process.env.BACKEND_DEPLOY_STARTED_AT || "", 10);

assert(Number.isFinite(deployStartedAt) && deployStartedAt > 0, "BACKEND_DEPLOY_STARTED_AT must be set");

const raw = run("npx", ["wrangler", "deployments", "list", "--config", configPath, "--json"], {
  env: process.env,
});
const deployments = JSON.parse(raw);

assert(Array.isArray(deployments) && deployments.length > 0, "wrangler deployments list returned no deployments");

const latest = [...deployments]
  .filter((deployment) => typeof deployment?.created_on === "string")
  .sort((left, right) => Date.parse(right.created_on) - Date.parse(left.created_on))[0];

assert(latest, "wrangler deployments list did not contain a deployment with created_on");
const createdAtMs = Date.parse(latest?.created_on || "");
assert(Number.isFinite(createdAtMs), `latest deployment has invalid created_on: ${JSON.stringify(latest)}`);

const latestEpochSeconds = Math.floor(createdAtMs / 1000);
assert(
  latestEpochSeconds >= deployStartedAt,
  `latest backend deployment (${latest?.created_on}) predates this deploy attempt (${deployStartedAt})`,
);

console.log(`Backend deployment verification passed: ${latest?.id} @ ${latest?.created_on}`);
