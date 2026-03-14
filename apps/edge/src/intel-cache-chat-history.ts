const CHAT_HISTORY_PATH = "/api/chat-history";

export function buildChatHistoryCacheKeyFromLimits(sessions: number, messages: number): string {
  const params = new URLSearchParams({
    sessions: String(sessions),
    messages: String(messages),
  });
  return `${CHAT_HISTORY_PATH}?${params.toString()}`;
}

export function normalizeChunkStorageBaseKey(key: string): string {
  return key.replace(/:(meta|chunks|\d+)$/, "");
}

export function collectPersistedChatHistoryEndpoints(storageKeys: Iterable<unknown>): string[] {
  const endpoints = new Set<string>();
  for (const rawKey of storageKeys) {
    const key = normalizeChunkStorageBaseKey(String(rawKey));
    if (!key.startsWith(`cache:${CHAT_HISTORY_PATH}`)) continue;
    endpoints.add(key.replace(/^cache:/, ""));
  }
  return [...endpoints];
}
