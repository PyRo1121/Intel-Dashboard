import { readFile } from "node:fs/promises";
import { toIsoOrNow, type IntelItem } from "./utils/types";

const PROMPTS_PATH = "/home/pyro1121/.openclaw/workspace/references/moltbot-ported/ai-prompts.json";

interface PromptData {
  prompts?: Record<string, { template?: string; focus_areas?: string[]; sections?: string[] }>;
}

async function readStdin(): Promise<string> {
  return new Response(Bun.stdin.stream()).text();
}

function parseItems(input: string): IntelItem[] {
  if (!input.trim()) return [];
  try {
    const parsed = JSON.parse(input) as unknown;
    return Array.isArray(parsed) ? (parsed as IntelItem[]) : [];
  } catch {
    return [];
  }
}

function sectionCount(items: IntelItem[], predicate: (item: IntelItem) => boolean): number {
  return items.filter(predicate).length;
}

function topItems(items: IntelItem[], limit = 3): IntelItem[] {
  return [...items]
    .sort((a, b) => {
      const severityRank = { critical: 4, high: 3, medium: 2, low: 1, "": 0 } as const;
      const bySeverity = severityRank[b.severity] - severityRank[a.severity];
      if (bySeverity !== 0) return bySeverity;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    })
    .slice(0, limit);
}

async function loadPromptData(): Promise<PromptData> {
  try {
    const raw = await readFile(PROMPTS_PATH, "utf8");
    return JSON.parse(raw) as PromptData;
  } catch {
    return {};
  }
}

export async function run(): Promise<string> {
  const [input, promptData] = await Promise.all([readStdin(), loadPromptData()]);
  const items = parseItems(input);
  const now = toIsoOrNow(Date.now());

  const byMiddleEast = sectionCount(items, (item) => item.region === "middle_east");
  const byUkraine = sectionCount(items, (item) => item.region === "ukraine");
  const byNotam = sectionCount(items, (item) => item.category === "notam");
  const byMilitary = sectionCount(items, (item) => item.category === "military_movement");
  const highOrCritical = sectionCount(items, (item) => item.severity === "high" || item.severity === "critical");

  const top = topItems(items, 5);

  const briefingTemplate =
    promptData.prompts?.daily_briefing?.template ??
    "Generate a comprehensive daily intelligence briefing with situation overview, regional updates, airspace signals, military posture, watch list, and BLUF.";
  const middleEastTemplate = promptData.prompts?.middle_east?.template ?? "";
  const ukraineTemplate = promptData.prompts?.ukraine?.template ?? "";
  const notamTemplate = promptData.prompts?.notams?.template ?? "";
  const movementTemplate = promptData.prompts?.military_movements?.template ?? "";

  const middleEastFocus = promptData.prompts?.middle_east?.focus_areas ?? [];
  const ukraineFocus = promptData.prompts?.ukraine?.focus_areas ?? [];
  const notamFocus = promptData.prompts?.notams?.focus_areas ?? [];
  const movementFocus = promptData.prompts?.military_movements?.focus_areas ?? [];

  const templateSections = [
    ...(middleEastTemplate ? ["", "MIDDLE EAST ANALYSIS TEMPLATE", middleEastTemplate] : []),
    ...(middleEastFocus.length
      ? ["Focus areas:", ...middleEastFocus.map((item) => `- ${item}`)]
      : []),
    ...(ukraineTemplate ? ["", "UKRAINE ANALYSIS TEMPLATE", ukraineTemplate] : []),
    ...(ukraineFocus.length ? ["Focus areas:", ...ukraineFocus.map((item) => `- ${item}`)] : []),
    ...(notamTemplate ? ["", "NOTAM ANALYSIS TEMPLATE", notamTemplate] : []),
    ...(notamFocus.length ? ["Focus areas:", ...notamFocus.map((item) => `- ${item}`)] : []),
    ...(movementTemplate ? ["", "MILITARY MOVEMENT ANALYSIS TEMPLATE", movementTemplate] : []),
    ...(movementFocus.length
      ? ["Focus areas:", ...movementFocus.map((item) => `- ${item}`)]
      : []),
  ];

  const lines = [
    "INTELLIGENCE BRIEFING",
    `Generated: ${now}`,
    "",
    "SITUATION OVERVIEW",
    `- Total tracked items: ${items.length}`,
    `- High/Critical signals: ${highOrCritical}`,
    `- Middle East items: ${byMiddleEast}`,
    `- Ukraine items: ${byUkraine}`,
    `- NOTAM items: ${byNotam}`,
    `- Military movement items: ${byMilitary}`,
    "",
    "WATCH LIST",
    ...(top.length
      ? top.map(
          (item, idx) =>
            `${idx + 1}. [${item.severity || "unknown"}] [${item.source}] ${item.title} (${item.region || "unknown region"}, ${item.timestamp})`,
        )
      : ["1. No items available from stdin payload."]),
    "",
    "ANALYST PROMPT TEMPLATE",
    briefingTemplate,
    ...templateSections,
  ];

  return `${lines.join("\n")}\n`;
}

if (import.meta.main) {
  run()
    .then((briefing) => {
      process.stdout.write(briefing);
    })
    .catch((error) => {
      process.stderr.write(`[osint-intel] analyze failed: ${error instanceof Error ? error.message : String(error)}\n`);
      process.stdout.write("INTELLIGENCE BRIEFING\nNo data available.\n");
    });
}
