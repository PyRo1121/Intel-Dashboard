#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    ...options,
  });
}

function parseAccountIdFromWhoAmI(output) {
  const match = output.match(/\b([a-f0-9]{32})\b/i);
  return match ? match[1] : "";
}

const repo = trim(process.env.GITHUB_REPOSITORY) || "PyRo1121/Intel-Dashboard";
const cloudflareToken =
  trim(process.env.CLOUDFLARE_DEPLOY_API_TOKEN) ||
  trim(process.env.CLOUDFLARE_API_TOKEN) ||
  trim(process.env.CF_API_TOKEN);

const whoami = run("npx", ["wrangler", "whoami"]);
const accountId = parseAccountIdFromWhoAmI(whoami);

if (!accountId) {
  throw new Error("Unable to derive CLOUDFLARE_ACCOUNT_ID from `wrangler whoami`.");
}

run("gh", ["variable", "set", "CLOUDFLARE_ACCOUNT_ID", "--repo", repo], {
  input: accountId,
});

if (cloudflareToken) {
  run("gh", ["secret", "set", "CLOUDFLARE_DEPLOY_API_TOKEN", "--repo", repo], {
    input: cloudflareToken,
  });
  console.log("Set CLOUDFLARE_DEPLOY_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in GitHub.");
} else {
  console.log("Set CLOUDFLARE_ACCOUNT_ID in GitHub.");
  console.log("No local API token env was available, so CLOUDFLARE_DEPLOY_API_TOKEN was not updated.");
  console.log("Workflow will fall back to the existing CLOUDFLARE_API_TOKEN secret if present.");
}
