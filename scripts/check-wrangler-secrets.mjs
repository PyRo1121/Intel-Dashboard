#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";

const WRANGLER_FILES = [
  "worker/wrangler.toml",
  "backend/wrangler.jsonc",
];

const ENV_FILES = [
  ".env",
  "worker/.env",
  "backend/.env",
];

const errors = [];

for (const file of WRANGLER_FILES) {
  if (!existsSync(file)) continue;
  const body = readFileSync(file, "utf8");
  const hasTomlVars = /\[\s*vars\s*\]/m.test(body);
  const hasJsonVars = /"\s*vars\s*"\s*:/m.test(body);
  if (hasTomlVars || hasJsonVars) {
    errors.push(`${file}: found disallowed Wrangler vars block. Use Wrangler secrets instead.`);
  }
}

for (const file of ENV_FILES) {
  if (!existsSync(file)) continue;
  const body = readFileSync(file, "utf8");
  const lines = body.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    if (/^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(trimmed)) {
      errors.push(`${file}:${index + 1}: found plaintext env assignment (${trimmed.split("=")[0]}). Move to Wrangler secret.`);
    }
  }
}

if (errors.length > 0) {
  console.error("Wrangler secret policy check failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Wrangler secret policy check passed.");
