type UsernameState = {
  username: string;
};

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function mergeLatestChannelStates<T extends UsernameState>(args: {
  latestChannels?: Iterable<T> | null;
  fallbackChannels?: Iterable<T> | null;
  scopedFallbackChannels?: Iterable<T> | null;
  scopedUsernames?: Iterable<string> | null;
  updatedChannels?: Iterable<T> | null;
}): Map<string, T> {
  const merged = new Map<string, T>();
  const seed = args.latestChannels ?? args.fallbackChannels ?? [];
  for (const channel of seed) {
    merged.set(channel.username, channel);
  }

  const scopedUsernames = args.scopedUsernames
    ? new Set(Array.from(args.scopedUsernames, normalizeUsername))
    : null;

  for (const channel of args.scopedFallbackChannels ?? []) {
    if (!scopedUsernames || scopedUsernames.has(normalizeUsername(channel.username))) {
      merged.set(channel.username, channel);
    }
  }

  for (const channel of args.updatedChannels ?? []) {
    merged.set(channel.username, channel);
  }

  return merged;
}
