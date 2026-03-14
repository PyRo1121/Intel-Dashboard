export type CollectorControlState = {
  accountId: string;
  configured: boolean;
  missingConfig: string[];
  connected: boolean;
  connecting: boolean;
  watchedChannels: string[];
  joinedChannels: string[];
  missingChannels: string[];
  mappedChannelIds: number;
  lastEventAt: string | null;
  lastForwardAt: string | null;
  receivedMessages: number;
  matchedMessages: number;
  forwardedMessages: number;
  droppedMessages: number;
  unmatchedMessages: number;
  bufferSize: number;
  lastUnmatchedEvent: Record<string, unknown> | null;
  lastError: string | null;
  connectAttempts: number;
  lastConnectAttemptAt: string | null;
  lastConnectSuccessAt: string | null;
  controlSyncAttempts: number;
  lastControlSyncAt: string | null;
  lastControlSyncError: string | null;
  joinBlockedUntil: string | null;
  joinWaitSeconds: number;
  updatedAt: string;
};

export type CollectorControlStateSource = "stored" | "default";

export function normalizeCollectorWatchedChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const entries: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.replace(/^@+/, "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    entries.push(normalized);
  }
  entries.sort();
  return entries;
}

function sameWatchedSet(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function buildDefaultCollectorControlState(args: {
  configured: boolean;
  missingConfig: string[];
  watchedChannels: string[];
  accountId?: string;
}): CollectorControlState {
  return {
    accountId: typeof args.accountId === "string" && args.accountId.trim() ? args.accountId.trim() : "primary",
    configured: args.configured,
    missingConfig: [...args.missingConfig],
    connected: false,
    connecting: false,
    watchedChannels: normalizeCollectorWatchedChannels(args.watchedChannels),
    joinedChannels: [],
    missingChannels: [],
    mappedChannelIds: 0,
    lastEventAt: null,
    lastForwardAt: null,
    receivedMessages: 0,
    matchedMessages: 0,
    forwardedMessages: 0,
    droppedMessages: 0,
    unmatchedMessages: 0,
    bufferSize: 0,
    lastUnmatchedEvent: null,
    lastError: null,
    connectAttempts: 0,
    lastConnectAttemptAt: null,
    lastConnectSuccessAt: null,
    controlSyncAttempts: 0,
    lastControlSyncAt: null,
    lastControlSyncError: null,
    joinBlockedUntil: null,
    joinWaitSeconds: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeCollectorControlUpdate(value: unknown, fallback: CollectorControlState): CollectorControlState {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const stringOr = (key: string, fallbackValue: string | null) => {
    const raw = record[key];
    return typeof raw === "string" ? raw : fallbackValue;
  };
  const numberOr = (key: string, fallbackValue: number) => {
    const raw = record[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : fallbackValue;
  };
  const boolOr = (key: string, fallbackValue: boolean) => {
    const raw = record[key];
    return typeof raw === "boolean" ? raw : fallbackValue;
  };
  const stringListOr = (key: string, fallbackValue: string[]) => {
    const raw = record[key];
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : fallbackValue;
  };
  const normalizedChannelsOr = (key: string, fallbackValue: string[]) => {
    const raw = record[key];
    return Array.isArray(raw) ? normalizeCollectorWatchedChannels(raw) : fallbackValue;
  };
  return {
    accountId: stringOr("accountId", fallback.accountId) ?? fallback.accountId,
    configured: boolOr("configured", fallback.configured),
    missingConfig: stringListOr("missingConfig", fallback.missingConfig),
    connected: boolOr("connected", fallback.connected),
    connecting: boolOr("connecting", fallback.connecting),
    watchedChannels: normalizedChannelsOr("watchedChannels", fallback.watchedChannels),
    joinedChannels: normalizedChannelsOr("joinedChannels", fallback.joinedChannels),
    missingChannels: normalizedChannelsOr("missingChannels", fallback.missingChannels),
    mappedChannelIds: numberOr("mappedChannelIds", fallback.mappedChannelIds),
    lastEventAt: stringOr("lastEventAt", fallback.lastEventAt),
    lastForwardAt: stringOr("lastForwardAt", fallback.lastForwardAt),
    receivedMessages: numberOr("receivedMessages", fallback.receivedMessages),
    matchedMessages: numberOr("matchedMessages", fallback.matchedMessages),
    forwardedMessages: numberOr("forwardedMessages", fallback.forwardedMessages),
    droppedMessages: numberOr("droppedMessages", fallback.droppedMessages),
    unmatchedMessages: numberOr("unmatchedMessages", fallback.unmatchedMessages),
    bufferSize: numberOr("bufferSize", fallback.bufferSize),
    lastUnmatchedEvent: record.lastUnmatchedEvent && typeof record.lastUnmatchedEvent === "object"
      ? record.lastUnmatchedEvent as Record<string, unknown>
      : fallback.lastUnmatchedEvent,
    lastError: stringOr("lastError", fallback.lastError),
    connectAttempts: numberOr("connectAttempts", fallback.connectAttempts),
    lastConnectAttemptAt: stringOr("lastConnectAttemptAt", fallback.lastConnectAttemptAt),
    lastConnectSuccessAt: stringOr("lastConnectSuccessAt", fallback.lastConnectSuccessAt),
    controlSyncAttempts: numberOr("controlSyncAttempts", fallback.controlSyncAttempts),
    lastControlSyncAt: stringOr("lastControlSyncAt", fallback.lastControlSyncAt),
    lastControlSyncError: stringOr("lastControlSyncError", fallback.lastControlSyncError),
    joinBlockedUntil: stringOr("joinBlockedUntil", fallback.joinBlockedUntil),
    joinWaitSeconds: numberOr("joinWaitSeconds", fallback.joinWaitSeconds),
    updatedAt: typeof record.updatedAt === "string" && record.updatedAt.trim() ? record.updatedAt : new Date().toISOString(),
  };
}

export function isStoredCollectorControlState(value: unknown, fallback: CollectorControlState): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.accountId !== "string" || !Array.isArray(record.watchedChannels)) {
    return false;
  }
  const normalized = normalizeCollectorControlUpdate(value, fallback);
  return normalized.accountId === fallback.accountId &&
    sameWatchedSet(normalized.watchedChannels, fallback.watchedChannels);
}
