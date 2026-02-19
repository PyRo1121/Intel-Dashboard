import type { APIEvent } from "@solidjs/start/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_PATH = join(homedir(), ".openclaw/workspace/skills/telegram-intel/state/latest-telegram-intel.json");

const DEFAULT_CATEGORIES: Record<string, string> = {
  ua_official: "Ukrainian Official",
  ua_osint: "Ukrainian OSINT",
  ua_intel: "Ukrainian Intelligence",
  ua_frontline: "Ukrainian Frontline Units",
  ua_journalism: "Ukrainian Journalism",
  ru_official: "Russian Official",
  ru_milblog: "Russian Milbloggers",
  en_analysis: "English Analysis",
  en_osint: "English OSINT",
  weapons: "Weapons & Equipment",
  mapping: "Mapping & Geolocation",
  cyber: "Cyber Warfare",
  naval: "Naval / Black Sea",
  air_defense: "Air Defense & Monitoring",
  casualties: "Casualties & Equipment Losses",
  satellite: "Satellite & Geospatial OSINT",
  drone: "Drone Warfare",
  foreign_vol: "Foreign Volunteer Units",
  think_tank: "Think Tanks & Analysis",
  israel_milblog: "Israel / Mideast Intel",
  iran_milblog: "Iran / Resistance Axis",
  global_osint: "Global OSINT",
};

export async function GET(_event: APIEvent) {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const data = JSON.parse(raw);
    data.categories = { ...DEFAULT_CATEGORIES, ...(data.categories || {}) };
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return new Response(JSON.stringify({ channels: [], total_messages: 0, timestamp: "", categories: DEFAULT_CATEGORIES }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}
