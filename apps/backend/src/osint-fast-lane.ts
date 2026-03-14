import type { OsintSource } from "./osint-sources.js";

export function isFastLaneOsintSource(source: OsintSource, priorityIds: ReadonlySet<string>): boolean {
  if (!source.feedUrl) return false;
  if (priorityIds.has(source.id)) return true;
  if (source.latencyTier === "instant") return true;
  if (source.trustTier === "core" && source.subscriberValueScore >= 88) return true;
  return false;
}

export function splitOsintFeedSources(
  sources: OsintSource[],
  priorityIds: ReadonlySet<string>,
): {
  fastLane: OsintSource[];
  rotating: OsintSource[];
} {
  const fastLane: OsintSource[] = [];
  const rotating: OsintSource[] = [];
  for (const source of sources) {
    if (isFastLaneOsintSource(source, priorityIds)) {
      fastLane.push(source);
    } else {
      rotating.push(source);
    }
  }
  return { fastLane, rotating };
}
