function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBoundedInt(value, fallback, min, max) {
  const raw = trim(value);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export function parseCollectorChannelSpecs(raw) {
  const text = trim(raw);
  if (!text) return [];
  const seen = new Set();
  const entries = [];

  for (const part of text.split(/[\n,]+/)) {
    const compact = trim(part);
    if (!compact) continue;
    const [usernameRaw, labelRaw, categoryRaw] = compact.split("|");
    const username = trim(usernameRaw).replace(/^@+/, "").toLowerCase();
    if (!username || seen.has(username)) continue;
    seen.add(username);
    entries.push({
      username,
      label: trim(labelRaw) || username,
      category: trim(categoryRaw).toLowerCase() || "telegram",
    });
  }

  return entries;
}

export function readTelegramCollectorRuntimeConfig(env) {
  const apiIdRaw = trim(env.TELEGRAM_API_ID);
  const apiIdParsed = apiIdRaw ? Number.parseInt(apiIdRaw, 10) : Number.NaN;
  const config = {
    apiId: Number.isFinite(apiIdParsed) && apiIdParsed > 0 ? apiIdParsed : null,
    apiHash: trim(env.TELEGRAM_API_HASH),
    sessionString: trim(env.TELEGRAM_SESSION_STRING),
    accountId: trim(env.TELEGRAM_ACCOUNT_ID) || "primary",
    selfUrl: trim(env.COLLECTOR_SELF_URL),
    edgeUrl: trim(env.COLLECTOR_EDGE_URL),
    edgePath: trim(env.COLLECTOR_EDGE_PATH) || "/api/telegram/collector-ingest",
    sharedSecret: trim(env.COLLECTOR_SHARED_SECRET),
    flushIntervalMs: normalizeBoundedInt(env.COLLECTOR_FLUSH_INTERVAL_MS, 1500, 250, 10000),
    channels: parseCollectorChannelSpecs(env.TELEGRAM_HOT_CHANNELS),
    missingConfig: [],
  };
  if (!config.apiId) config.missingConfig.push("TELEGRAM_API_ID");
  if (!config.apiHash) config.missingConfig.push("TELEGRAM_API_HASH");
  if (!config.sessionString) config.missingConfig.push("TELEGRAM_SESSION_STRING");
  if (!config.channels.length) config.missingConfig.push("TELEGRAM_HOT_CHANNELS");
  if (!config.edgeUrl) config.missingConfig.push("COLLECTOR_EDGE_URL");
  if (!config.sharedSecret) config.missingConfig.push("COLLECTOR_SHARED_SECRET");
  return config;
}
