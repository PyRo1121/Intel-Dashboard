import type { APIEvent } from "@solidjs/start/server";
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const BRIEFINGS_DIR = join(homedir(), ".openclaw/workspace/skills/osint-intel/state/briefings");
const INTEL_PATH = join(homedir(), ".openclaw/workspace/skills/osint-intel/state/latest-events.json");
const CACHE_TTL = 60_000;

let cache: { data: unknown[]; ts: number } | null = null;
let inFlight: Promise<unknown[]> | null = null;

interface IntelItem {
  title: string;
  severity: string;
  region: string;
  source: string;
  timestamp: string;
}

interface Briefing {
  id: string;
  timestamp: string;
  content: string;
  severity_summary: { critical: number; high: number; medium: number; low: number };
}

function generateBriefing(items: IntelItem[], timestamp: string): Briefing {
  const critical = items.filter((i) => i.severity === "critical");
  const high = items.filter((i) => i.severity === "high");
  const medium = items.filter((i) => i.severity === "medium");
  const low = items.filter((i) => i.severity === "low");

  const regions: Record<string, IntelItem[]> = {};
  for (const item of items) {
    const r = item.region || "global";
    if (!regions[r]) regions[r] = [];
    regions[r].push(item);
  }

  const regionLabels: Record<string, string> = {
    middle_east: "Middle East", ukraine: "Ukraine/Russia", europe: "Europe",
    pacific: "Indo-Pacific", us: "United States", global: "Global",
  };

  const lines: string[] = [];

  let overallThreat = "LOW";
  if (critical.length >= 3) overallThreat = "CRITICAL";
  else if (critical.length >= 1 || high.length >= 5) overallThreat = "HIGH";
  else if (high.length >= 1 || medium.length >= 3) overallThreat = "ELEVATED";

  lines.push(`INTELLIGENCE BRIEFING — ${new Date(timestamp).toUTCString()}`);
  lines.push(`Overall Threat Level: ${overallThreat}`);
  lines.push(`Total Events: ${items.length} | Critical: ${critical.length} | High: ${high.length} | Medium: ${medium.length} | Low: ${low.length}`);
  lines.push("");

  if (critical.length > 0) {
    lines.push("CRITICAL ALERTS:");
    for (const item of critical.slice(0, 5)) {
      lines.push(`  [${(item.region || "global").replace("_", " ").toUpperCase()}] ${item.title} (${item.source})`);
    }
    lines.push("");
  }

  lines.push("REGIONAL ASSESSMENT:");
  for (const [region, label] of Object.entries(regionLabels)) {
    const regionItems = regions[region];
    if (!regionItems || regionItems.length === 0) continue;
    const rc = regionItems.filter((i) => i.severity === "critical").length;
    const rh = regionItems.filter((i) => i.severity === "high").length;
    lines.push(`  ${label} (${regionItems.length} events${rc > 0 ? `, ${rc} critical` : ""}${rh > 0 ? `, ${rh} high` : ""}):`);
    for (const item of regionItems.filter((i) => i.severity === "critical" || i.severity === "high").slice(0, 3)) {
      lines.push(`    - ${item.title}`);
    }
  }

  lines.push("");
  lines.push(`Sources: ${[...new Set(items.map((i) => i.source))].join(", ")}`);

  return {
    id: `briefing-${Date.now()}`,
    timestamp,
    content: lines.join("\n"),
    severity_summary: { critical: critical.length, high: high.length, medium: medium.length, low: low.length },
  };
}

async function loadBriefings(): Promise<Briefing[]> {
  const briefings: Briefing[] = [];

  try {
    await mkdir(BRIEFINGS_DIR, { recursive: true });
    const files = await readdir(BRIEFINGS_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort().reverse().slice(0, 20);
    for (const file of jsonFiles) {
      try {
        const raw = await readFile(join(BRIEFINGS_DIR, file), "utf-8");
        const data = JSON.parse(raw) as Briefing;
        if (data.id && data.content) briefings.push(data);
      } catch { /* skip */ }
    }
  } catch { /* dir may not exist yet */ }

  try {
    const raw = await readFile(INTEL_PATH, "utf-8");
    const items = JSON.parse(raw) as IntelItem[];
    if (Array.isArray(items) && items.length > 0) {
      const now = new Date().toISOString();
      const latest = generateBriefing(items, now);

      if (briefings.length === 0 || briefings[0].timestamp < new Date(Date.now() - 4 * 3600 * 1000).toISOString()) {
        briefings.unshift(latest);
        try {
          const filename = `briefing-${Date.now()}.json`;
          await writeFile(join(BRIEFINGS_DIR, filename), JSON.stringify(latest, null, 2));
        } catch { /* non-critical */ }
      } else {
        latest.id = "live-snapshot";
        latest.content = `LIVE SNAPSHOT (not a scheduled briefing)\n\n${latest.content}`;
        briefings.unshift(latest);
      }
    }
  } catch { /* no intel data yet */ }

  return briefings;
}

export async function GET(_event: APIEvent) {
  try {
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return new Response(JSON.stringify(cache.data), { headers: { "Content-Type": "application/json" } });
    }
    
    if (inFlight) {
      const data = await inFlight;
      return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    }
    
    inFlight = loadBriefings();
    try {
      const data = await inFlight;
      cache = { data, ts: Date.now() };
      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=60" },
      });
    } finally {
      inFlight = null;
    }
  } catch (e) {
    console.error("[briefings] error:", e);
    return new Response("[]", { headers: { "Content-Type": "application/json" } });
  }
}
