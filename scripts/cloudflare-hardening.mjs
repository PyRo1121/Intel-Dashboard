#!/usr/bin/env node

const API_BASE = "https://api.cloudflare.com/client/v4";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name, fallback) {
  const value = process.env[name]?.trim();
  return value || fallback;
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
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

async function patchZoneSetting(token, zoneId, settingId, value) {
  return cfFetch(token, `/zones/${zoneId}/settings/${settingId}`, {
    method: "PATCH",
    body: JSON.stringify({ value }),
  });
}

function findRuleByDescription(rules, description) {
  return (rules || []).find((rule) => rule?.description === description) || null;
}

async function resolveZoneId(token, zoneName) {
  const res = await cfFetch(token, `/zones?name=${encodeURIComponent(zoneName)}`);
  if (!res.ok || !res.payload?.success) {
    throw new Error(`Failed to resolve zone '${zoneName}': ${JSON.stringify(res.payload?.errors || [])}`);
  }
  const zone = res.payload?.result?.[0];
  if (!zone?.id) {
    throw new Error(`Zone '${zoneName}' not found for provided token.`);
  }
  return zone.id;
}

async function upsertCustomWafRule(token, zoneId) {
  const entrypoint = await cfFetch(token, `/zones/${zoneId}/rulesets/phases/http_request_firewall_custom/entrypoint`);
  if (!entrypoint.ok || !entrypoint.payload?.success) {
    throw new Error(`Failed to load custom firewall entrypoint: ${JSON.stringify(entrypoint.payload?.errors || [])}`);
  }
  const rulesetId = entrypoint.payload.result?.id;
  if (!rulesetId) {
    throw new Error("Custom firewall entrypoint returned no ruleset id.");
  }

  const description = "INTEL_SEC_AUTH_ENTRY_MANAGED_CHALLENGE";
  const rule = {
    action: "managed_challenge",
    description,
    enabled: true,
    expression:
      '(http.host eq "intel.pyro1121.com" and http.request.uri.path in {"/login" "/signup" "/auth/login" "/auth/signup" "/auth/x/login" "/auth/x/signup" "/oauth/login" "/oauth/signup" "/oauth/x/login" "/oauth/x/signup"})',
  };

  const payload = {
    name: "default",
    kind: "zone",
    phase: "http_request_firewall_custom",
    rules: [rule],
  };
  const updated = await cfFetch(token, `/zones/${zoneId}/rulesets/${rulesetId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!updated.ok || !updated.payload?.success) {
    throw new Error(`Failed to update custom firewall ruleset: ${JSON.stringify(updated.payload?.errors || [])}`);
  }

  const appliedRule = findRuleByDescription(updated.payload.result?.rules, description);
  return {
    rulesetId,
    ruleId: appliedRule?.id || null,
    description,
  };
}

async function ensureRateLimitEntrypoint(token, zoneId) {
  const entrypoint = await cfFetch(token, `/zones/${zoneId}/rulesets/phases/http_ratelimit/entrypoint`);
  if (entrypoint.ok && entrypoint.payload?.success && entrypoint.payload?.result?.id) {
    return entrypoint.payload.result.id;
  }
  const create = await cfFetch(token, `/zones/${zoneId}/rulesets`, {
    method: "POST",
    body: JSON.stringify({
      name: "default",
      kind: "zone",
      phase: "http_ratelimit",
      rules: [],
    }),
  });
  if (!create.ok || !create.payload?.success || !create.payload?.result?.id) {
    throw new Error(`Failed to create rate-limit entrypoint: ${JSON.stringify(create.payload?.errors || [])}`);
  }
  return create.payload.result.id;
}

async function upsertRateLimitRule(token, zoneId, requestsPerPeriod = 15) {
  const rulesetId = await ensureRateLimitEntrypoint(token, zoneId);
  const description = "INTEL_SEC_RL_SENSITIVE_ROUTES_15REQ_10S";
  const rule = {
    action: "block",
    description,
    enabled: true,
    expression:
      '(http.host eq "intel.pyro1121.com" and (http.request.uri.path in {"/login" "/signup" "/auth/login" "/auth/signup" "/auth/x/login" "/auth/x/signup"} or starts_with(http.request.uri.path, "/api/billing/") or http.request.uri.path eq "/api/telegram/dedupe-feedback"))',
    ratelimit: {
      characteristics: ["cf.colo.id", "ip.src"],
      period: 10,
      requests_per_period: requestsPerPeriod,
      mitigation_timeout: 10,
    },
  };

  const payload = {
    name: "default",
    kind: "zone",
    phase: "http_ratelimit",
    rules: [rule],
  };
  const updated = await cfFetch(token, `/zones/${zoneId}/rulesets/${rulesetId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  if (!updated.ok || !updated.payload?.success) {
    throw new Error(`Failed to update rate-limit ruleset: ${JSON.stringify(updated.payload?.errors || [])}`);
  }
  const appliedRule = findRuleByDescription(updated.payload.result?.rules, description);
  return {
    rulesetId,
    ruleId: appliedRule?.id || null,
    description,
  };
}

async function tryEnableBotFightMode(token, zoneId) {
  const modernApi = await cfFetch(token, `/zones/${zoneId}/bot_management`, {
    method: "PUT",
    body: JSON.stringify({ fight_mode: true }),
  });
  if (modernApi.ok && modernApi.payload?.success) {
    return {
      enabled: true,
      value: modernApi.payload?.result ?? { fight_mode: true },
      error: null,
      settingName: "bot_management.fight_mode",
      attempts: [],
    };
  }

  const candidates = [
    "bot_fight_mode",
    "super_bot_fight_mode",
  ];
  const modernMessage = (modernApi.payload?.errors || []).map((item) => item.message).join("; ") || null;
  const attempts = [{ settingName: "bot_management.fight_mode", success: Boolean(modernApi.payload?.success), message: modernMessage }];
  for (const settingName of candidates) {
    const updated = await cfFetch(token, `/zones/${zoneId}/settings/${settingName}`, {
      method: "PATCH",
      body: JSON.stringify({ value: "on" }),
    });
    const message = (updated.payload?.errors || []).map((item) => item.message).join("; ") || null;
    attempts.push({ settingName, success: Boolean(updated.payload?.success), message });
    if (updated.ok && updated.payload?.success) {
      return {
        enabled: true,
        value: updated.payload.result?.value ?? "on",
        error: null,
        settingName,
        attempts,
      };
    }
  }
  return {
    enabled: false,
    value: null,
    error: "Cloudflare Bot Fight setting endpoint unavailable or not permitted for this token/plan.",
    settingName: null,
    attempts,
  };
}

async function applyZoneBaselineSettings(token, zoneId) {
  const desiredSecurityLevel = optionalEnv("CF_SECURITY_LEVEL", "high");
  const changes = [
    {
      key: "tls13",
      settingId: "tls_1_3",
      value: "on",
    },
    {
      key: "alwaysUseHttps",
      settingId: "always_use_https",
      value: "on",
    },
    {
      key: "automaticHttpsRewrites",
      settingId: "automatic_https_rewrites",
      value: "on",
    },
    {
      key: "browserCheck",
      settingId: "browser_check",
      value: "on",
    },
    {
      key: "securityLevel",
      settingId: "security_level",
      value: desiredSecurityLevel,
    },
    {
      key: "securityHeader",
      settingId: "security_header",
      value: {
        strict_transport_security: {
          enabled: true,
          max_age: 31536000,
          include_subdomains: true,
          preload: true,
          nosniff: true,
        },
      },
    },
  ];

  const result = {};
  for (const change of changes) {
    const updated = await patchZoneSetting(token, zoneId, change.settingId, change.value);
    result[change.key] = {
      success: Boolean(updated.payload?.success),
      value: updated.payload?.result?.value ?? null,
      errors: updated.payload?.errors ?? [],
    };
  }
  return result;
}

async function main() {
  const token = requiredEnv("CF_API_TOKEN");
  const zoneName = optionalEnv("CF_ZONE_NAME", "pyro1121.com");
  const requestsPerPeriod = Number.parseInt(optionalEnv("CF_RL_REQUESTS_PER_10S", "15"), 10);
  if (!Number.isFinite(requestsPerPeriod) || requestsPerPeriod < 1 || requestsPerPeriod > 200) {
    throw new Error("CF_RL_REQUESTS_PER_10S must be between 1 and 200.");
  }

  const tokenVerify = await cfFetch(token, "/user/tokens/verify");
  if (!tokenVerify.ok || !tokenVerify.payload?.success) {
    throw new Error(`Cloudflare token verification failed: ${JSON.stringify(tokenVerify.payload?.errors || [])}`);
  }

  const zoneId = await resolveZoneId(token, zoneName);
  const waf = await upsertCustomWafRule(token, zoneId);
  const rateLimit = await upsertRateLimitRule(token, zoneId, requestsPerPeriod);
  const baseline = await applyZoneBaselineSettings(token, zoneId);
  const botFightMode = await tryEnableBotFightMode(token, zoneId);

  const output = {
    zoneName,
    zoneId,
    waf,
    rateLimit,
    baseline,
    botFightMode,
  };
  console.log(JSON.stringify(output, null, 2));

  const baselineFailed =
    Object.values(baseline).some((entry) => !entry.success);
  const botFailedForPermissions = !botFightMode.enabled && botFightMode.attempts?.some((a) =>
    (a.message || "").toLowerCase().includes("unauthorized")
  );
  if (baselineFailed || botFailedForPermissions) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(`[cloudflare-hardening] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
