#!/usr/bin/env node

const API_BASE = "https://api.cloudflare.com/client/v4";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

async function cfFetch(token, path) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload };
}

async function resolveZoneId(token, zoneName) {
  const zones = await cfFetch(token, `/zones?name=${encodeURIComponent(zoneName)}`);
  if (!zones.ok || !zones.payload?.success) {
    throw new Error(`Failed to resolve zone '${zoneName}': ${JSON.stringify(zones.payload?.errors || [])}`);
  }
  const zone = zones.payload.result?.[0];
  if (!zone?.id) {
    throw new Error(`Zone '${zoneName}' not found`);
  }
  return zone.id;
}

function hasRuleByDescription(rules, description) {
  return (rules || []).some((rule) => rule?.description === description && rule?.enabled === true);
}

async function main() {
  const token = requiredEnv("CF_API_TOKEN");
  const zoneName = optionalEnv("CF_ZONE_NAME", "pyro1121.com");
  const expectedSecurityLevel = optionalEnv("CF_SECURITY_LEVEL", "high");

  const zoneId = await resolveZoneId(token, zoneName);

  const customId = "cd971ffa09dd489ba06b576dc7d45c17";
  const rateId = "2a822ca936c940df9ed5d74a3b0811a5";

  const [custom, rate, tls13, alwaysHttps, rewrites, browserCheck, securityLevel, securityHeader] = await Promise.all([
    cfFetch(token, `/zones/${zoneId}/rulesets/${customId}`),
    cfFetch(token, `/zones/${zoneId}/rulesets/${rateId}`),
    cfFetch(token, `/zones/${zoneId}/settings/tls_1_3`),
    cfFetch(token, `/zones/${zoneId}/settings/always_use_https`),
    cfFetch(token, `/zones/${zoneId}/settings/automatic_https_rewrites`),
    cfFetch(token, `/zones/${zoneId}/settings/browser_check`),
    cfFetch(token, `/zones/${zoneId}/settings/security_level`),
    cfFetch(token, `/zones/${zoneId}/settings/security_header`),
  ]);

  const checks = [
    {
      id: "waf_rule_auth_challenge",
      ok: custom.ok && hasRuleByDescription(custom.payload?.result?.rules, "INTEL_SEC_AUTH_ENTRY_MANAGED_CHALLENGE"),
    },
    {
      id: "ratelimit_sensitive_routes",
      ok: rate.ok && hasRuleByDescription(rate.payload?.result?.rules, "INTEL_SEC_RL_SENSITIVE_ROUTES_15REQ_10S"),
    },
    {
      id: "tls_1_3_on",
      ok: tls13.ok && tls13.payload?.result?.value === "on",
    },
    {
      id: "always_use_https_on",
      ok: alwaysHttps.ok && alwaysHttps.payload?.result?.value === "on",
    },
    {
      id: "automatic_https_rewrites_on",
      ok: rewrites.ok && rewrites.payload?.result?.value === "on",
    },
    {
      id: "browser_check_on",
      ok: browserCheck.ok && browserCheck.payload?.result?.value === "on",
    },
    {
      id: "security_level_expected",
      ok: securityLevel.ok && String(securityLevel.payload?.result?.value || "").toLowerCase() === expectedSecurityLevel.toLowerCase(),
    },
    {
      id: "hsts_enabled",
      ok: securityHeader.ok && securityHeader.payload?.result?.value?.strict_transport_security?.enabled === true,
    },
    {
      id: "hsts_max_age_1y",
      ok: securityHeader.ok && Number(securityHeader.payload?.result?.value?.strict_transport_security?.max_age) >= 31536000,
    },
  ];

  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.length - passed;
  const output = {
    zoneName,
    zoneId,
    summary: {
      total: checks.length,
      passed,
      failed,
    },
    checks,
    current: {
      tls_1_3: tls13.payload?.result?.value ?? null,
      always_use_https: alwaysHttps.payload?.result?.value ?? null,
      automatic_https_rewrites: rewrites.payload?.result?.value ?? null,
      browser_check: browserCheck.payload?.result?.value ?? null,
      security_level: securityLevel.payload?.result?.value ?? null,
      security_header: securityHeader.payload?.result?.value ?? null,
    },
  };

  console.log(JSON.stringify(output, null, 2));
  if (failed > 0) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`[cloudflare-security-verify] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});

