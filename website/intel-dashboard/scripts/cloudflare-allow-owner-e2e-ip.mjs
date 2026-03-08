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

function isManagedOwnerE2eRule(rule) {
  return typeof rule?.notes === "string" && rule.notes.startsWith(`${NOTE_PREFIX}:`);
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

async function createAccessRule(token, zoneId, ip, note) {
  const payload = await cfFetch(token, `/zones/${zoneId}/firewall/access_rules/rules`, {
    method: "POST",
    body: JSON.stringify({
      mode: "whitelist",
      configuration: {
        target: "ip",
        value: ip,
      },
      notes: note,
    }),
  });
  return payload?.result ?? null;
}

const token = requiredEnv("CLOUDFLARE_API_TOKEN");
const zoneName = trim(process.env.CF_ZONE_NAME) || DEFAULT_ZONE_NAME;
const ip = await resolvePublicIp();
const zoneId = await resolveZoneId(token, zoneName);
const note = `${NOTE_PREFIX}:${ip}`;

const rules = await listZoneAccessRules(token, zoneId);
const matching = rules.filter((rule) => isManagedOwnerE2eRule(rule));
const current = matching.find((rule) => rule?.configuration?.target === "ip" && rule?.configuration?.value === ip && rule?.mode === "whitelist");

for (const stale of matching) {
  if (stale?.id && stale !== current) {
    await deleteAccessRule(token, zoneId, stale.id);
  }
}

let result = current;
if (!result) {
  result = await createAccessRule(token, zoneId, ip, note);
}

console.log(`Zone: ${zoneName}`);
console.log(`Zone ID: ${zoneId}`);
console.log(`Whitelisted owner e2e IP: ${ip}`);
console.log(`Rule ID: ${result?.id ?? "unknown"}`);
