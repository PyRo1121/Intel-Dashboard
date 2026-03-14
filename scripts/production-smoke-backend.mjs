#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...options,
    });
  } catch (error) {
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    const stderr = typeof error?.stderr === "string" ? error.stderr : "";
    const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join("\n");
    throw new Error(
      `Failed to run ${command} ${args.join(" ")}${detail ? `:\n${detail}` : ""}`,
    );
  }
}

function resolveWranglerCommand(configPath) {
  const packageDir = dirname(configPath);
  const localWrangler = resolve(packageDir, "node_modules/.bin/wrangler");
  if (existsSync(localWrangler)) {
    return { command: localWrangler, args: [] };
  }
  return { command: "bunx", args: ["wrangler"] };
}

const configPath = (process.env.BACKEND_WRANGLER_CONFIG || "apps/backend/wrangler.jsonc").trim();
const deployStartedAt = Number.parseInt(process.env.BACKEND_DEPLOY_STARTED_AT || "", 10);
const maxClockSkewSeconds = Number.parseInt(process.env.BACKEND_DEPLOY_MAX_CLOCK_SKEW_SECONDS || "120", 10);

assert(Number.isFinite(deployStartedAt) && deployStartedAt > 0, "BACKEND_DEPLOY_STARTED_AT must be set");
assert(Number.isFinite(maxClockSkewSeconds) && maxClockSkewSeconds >= 0, "BACKEND_DEPLOY_MAX_CLOCK_SKEW_SECONDS must be a non-negative integer");

const wrangler = resolveWranglerCommand(configPath);
const raw = run(wrangler.command, [...wrangler.args, "deployments", "list", "--config", configPath, "--json"], {
  env: process.env,
});
const parsed = JSON.parse(raw);
const deployments = Array.isArray(parsed)
  ? parsed
  : Array.isArray(parsed?.deployments)
    ? parsed.deployments
    : null;

assert(deployments && deployments.length > 0, `wrangler deployments list returned unexpected payload: ${raw.slice(0, 500)}`);

const latest = [...deployments]
  .filter((deployment) => typeof deployment?.created_on === "string")
  .sort((left, right) => Date.parse(right.created_on) - Date.parse(left.created_on))[0];

assert(latest, "wrangler deployments list did not contain a deployment with created_on");
const createdAtMs = Date.parse(latest?.created_on || "");
assert(Number.isFinite(createdAtMs), `latest deployment has invalid created_on: ${JSON.stringify(latest)}`);

const latestEpochSeconds = Math.floor(createdAtMs / 1000);
assert(
  latestEpochSeconds + maxClockSkewSeconds >= deployStartedAt,
  `latest backend deployment (${latest?.created_on}) predates this deploy attempt (${deployStartedAt}) beyond ${maxClockSkewSeconds}s skew tolerance`,
);

console.log(`Backend deployment verification passed: ${latest?.id} @ ${latest?.created_on}`);
