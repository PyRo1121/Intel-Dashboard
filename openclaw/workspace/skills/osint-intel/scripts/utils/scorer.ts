import type { Severity } from "./types";

const ACLED_EVENT_SEVERITY: Record<string, Severity> = {
  Battles: "high",
  "Explosions/Remote violence": "high",
  "Violence against civilians": "critical",
  "Strategic developments": "medium",
  Protests: "low",
  Riots: "medium",
};

const NOTAM_MILITARY_KEYWORDS = [
  "MILITARY",
  "MIL EXERCISE",
  "LIVE FIRING",
  "MISSILE",
  "ROCKET",
  "AERIAL REFUELING",
  "UNMANNED",
  "DRONE",
  "UAS",
  "TFR",
  "GPS",
  "JAMMING",
  "SPOOFING",
  "GNSS",
  "NAVIGATION WARNING",
  "COMBAT",
  "RESTRICTED AREA",
  "DANGER AREA",
  "PROHIBITED",
  "NO-FLY",
  "AIRSPACE CLOSURE",
  "SAM",
  "AIR DEFENSE",
];

const NOTAM_CRITICAL_KEYWORDS = ["GPS", "JAMMING", "MISSILE", "COMBAT"];

const WATCH_AIRCRAFT: Record<string, Severity> = {
  "B-52H": "high",
  "B-1B": "high",
  "B-2A": "critical",
  "E-6B": "critical",
  "E-4B": "critical",
  "RC-135": "high",
  "RQ-4": "high",
  "MQ-9": "medium",
  "EP-3": "high",
  "E-8C": "high",
  "P-8A": "medium",
  "KC-135": "medium",
  "KC-46": "medium",
  "KC-10": "medium",
  "E-3": "high",
  "C-17": "medium",
  "C-5M": "medium",
};

const RSS_CRITICAL_KEYWORDS = [
  "nuclear",
  "missile strike",
  "chemical attack",
  "air defense failure",
  "strategic bomber",
  "carrier strike group",
  "martial law",
];

const RSS_HIGH_KEYWORDS = [
  "airstrike",
  "drone strike",
  "offensive",
  "invasion",
  "mobilization",
  "missile",
  "rocket",
  "combat",
  "troop",
  "tanker",
  "awacs",
  "refueling",
  "notam",
  "gps jamming",
];

export function scoreGdeltTone(tone: unknown): Severity {
  const numericTone = parseTone(tone);
  if (numericTone < -5) return "high";
  if (numericTone < -2) return "medium";
  return "low";
}

export function scoreAcledEvent(eventType: string, fatalities: unknown): Severity {
  const fatalityCount = Number(fatalities ?? 0);
  if (fatalityCount > 10) return "critical";
  if (fatalityCount > 0) return "high";
  return ACLED_EVENT_SEVERITY[eventType] ?? "medium";
}

export function scoreNotamText(text: string): Severity {
  const upper = text.toUpperCase();
  if (NOTAM_CRITICAL_KEYWORDS.some((keyword) => upper.includes(keyword))) {
    return "critical";
  }
  if (NOTAM_MILITARY_KEYWORDS.some((keyword) => upper.includes(keyword))) {
    return "high";
  }
  return "low";
}

export function scoreMilitaryAircraft(text: string): Severity {
  const upper = text.toUpperCase();
  for (const [aircraft, severity] of Object.entries(WATCH_AIRCRAFT)) {
    if (upper.includes(aircraft)) {
      return severity;
    }
  }
  if (/RCH|REACH|DOOM|DEATH|JAKE|NUKE|EPIC|IRON|NATO|FORTE/.test(upper)) {
    return "medium";
  }
  return "low";
}

export function scoreRssText(text: string): Severity {
  const lower = text.toLowerCase();
  if (RSS_CRITICAL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "critical";
  }
  if (RSS_HIGH_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return "high";
  }
  return "medium";
}

function parseTone(input: unknown): number {
  if (typeof input === "number") {
    return input;
  }
  if (typeof input === "string") {
    const first = input.split(",")[0]?.trim();
    const parsed = Number(first);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return 0;
}
