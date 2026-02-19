import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { IntelItem } from "./types";

const MEMORY_DIR = "/home/pyro1121/.openclaw/workspace/memory";
const MEMORY_PATH = `${MEMORY_DIR}/osint-seen.json`;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

type SeenMap = Record<string, number>;

export function makeFingerprint(item: Pick<IntelItem, "title" | "source" | "category">): string {
  const key = `${item.title}||${item.source}||${item.category}`.toLowerCase().trim();
  return createHash("sha256").update(key).digest("hex");
}

export async function filterRecentDuplicates(items: IntelItem[]): Promise<IntelItem[]> {
  const seen = await loadSeen();
  const now = Date.now();
  const filtered: IntelItem[] = [];

  for (const item of items) {
    const fingerprint = makeFingerprint(item);
    const lastSeenAt = seen[fingerprint];
    if (lastSeenAt && now - lastSeenAt < FOUR_HOURS_MS) {
      continue;
    }

    seen[fingerprint] = now;
    filtered.push(item);
  }

  await saveSeen(cleanExpired(seen, now));
  return filtered;
}

async function loadSeen(): Promise<SeenMap> {
  if (!existsSync(MEMORY_PATH)) {
    return {};
  }

  try {
    const raw = await readFile(MEMORY_PATH, "utf8");
    const parsed = JSON.parse(raw) as SeenMap;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function cleanExpired(seen: SeenMap, now: number): SeenMap {
  const pruned: SeenMap = {};
  for (const [hash, ts] of Object.entries(seen)) {
    if (now - ts < FOUR_HOURS_MS) {
      pruned[hash] = ts;
    }
  }
  return pruned;
}

async function saveSeen(seen: SeenMap): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
  await writeFile(MEMORY_PATH, JSON.stringify(seen, null, 2), "utf8");
}
