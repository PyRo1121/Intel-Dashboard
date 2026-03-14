import { normalizeWatchedChannels } from "./control-state.ts";

type WorkerConfigEnv = {
  COLLECTOR_EDGE_URL?: string;
  COLLECTOR_SHARED_SECRET?: string;
  TELEGRAM_HOT_CHANNELS?: string;
  TELEGRAM_API_ID?: string;
  TELEGRAM_API_HASH?: string;
  TELEGRAM_SESSION_STRING?: string;
  TELEGRAM_ACCOUNT_ID?: string;
};

type CollectorWorkerFallbackConfig = {
  accountId: string;
  configured: boolean;
  missingConfig: string[];
  watchedChannels: string[];
};

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveCollectorWorkerFallbackConfig(env: WorkerConfigEnv): CollectorWorkerFallbackConfig {
  const watchedChannels = normalizeWatchedChannels(
    (env.TELEGRAM_HOT_CHANNELS || "").split(/[\n,]+/).map((part) => part.split("|")[0]),
  );

  const missingConfig: string[] = [];
  if (!trim(env.TELEGRAM_API_ID)) missingConfig.push("TELEGRAM_API_ID");
  if (!trim(env.TELEGRAM_API_HASH)) missingConfig.push("TELEGRAM_API_HASH");
  if (!trim(env.TELEGRAM_SESSION_STRING)) missingConfig.push("TELEGRAM_SESSION_STRING");
  if (watchedChannels.length === 0) missingConfig.push("TELEGRAM_HOT_CHANNELS");
  if (!trim(env.COLLECTOR_EDGE_URL)) missingConfig.push("COLLECTOR_EDGE_URL");
  if (!trim(env.COLLECTOR_SHARED_SECRET)) missingConfig.push("COLLECTOR_SHARED_SECRET");

  return {
    accountId: trim(env.TELEGRAM_ACCOUNT_ID) || "primary",
    configured: missingConfig.length === 0,
    missingConfig,
    watchedChannels,
  };
}
