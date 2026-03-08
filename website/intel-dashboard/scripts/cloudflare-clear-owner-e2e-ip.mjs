import { execFileSync } from "node:child_process";

const API_BASE = "https://api.cloudflare.com/client/v4";
const DEFAULT_ZONE_NAME = "pyro1121.com";
const NOTE_PREFIX = "owner-e2e-auth";

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function requiredEnv(name) {
  const value = trim(process.env[name]);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function cfFetch(token, path, init = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new Error(`${response.status} ${path} ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function resolvePublicIp() {
  const explicit = trim(process.env.E2E_OWNER_IP);
  if (explicit) return explicit;
  return execFileSync("curl", ["-fsS", "https://api.ipify.org"], {
    encoding: "utf8",
  }).trim();
}

async function resolveZoneId(token, zoneName) {
  const payload = await cfFetch(token, `/zones?name=${encodeURIComponent(zoneName)}`);
  const zone = payload?.result?.[0];
  if (!zone?.id) {
    throw new Error(`Zone not found for ${zoneName}`);
  }
  return zone.id;
}

async function listZoneAccessRules(token, zoneId) {
  const payload = await cfFetch(token, `/zones/${zoneId}/firewall/access_rules/rules?per_page=100`);
  return Array.isArray(payload?.result) ? payload.result : [];
}

async function deleteAccessRule(token, zoneId, ruleId) {
  await cfFetch(token, `/zones/${zoneId}/firewall/access_rules/rules/${ruleId}`, {
    method: "DELETE",
  });
}

const token = requiredEnv("CLOUDFLARE_API_TOKEN");
const zoneName = trim(process.env.CF_ZONE_NAME) || DEFAULT_ZONE_NAME;
const zoneId = await resolveZoneId(token, zoneName);
const deleteAll = trim(process.env.CF_E2E_CLEAR_ALL) === "1";
const ip = deleteAll ? null : await resolvePublicIp();

const rules = await listZoneAccessRules(token, zoneId);
const matches = rules.filter((rule) => {
  const notes = typeof rule?.notes === "string" ? rule.notes : "";
  if (!notes.startsWith(`${NOTE_PREFIX}:`)) return false;
  if (deleteAll) return true;
  return rule?.configuration?.target === "ip" && rule?.configuration?.value === ip;
});

for (const match of matches) {
  if (match?.id) {
    await deleteAccessRule(token, zoneId, match.id);
  }
}

console.log(`Zone: ${zoneName}`);
console.log(`Zone ID: ${zoneId}`);
console.log(`Removed owner e2e allowlist rules: ${matches.length}`);
if (!deleteAll) {
  console.log(`Target IP: ${ip}`);
}
