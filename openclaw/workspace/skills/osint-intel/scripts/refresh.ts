import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import type { IntelItem } from "./utils/types";

const STATE_DIR = "/home/pyro1121/.openclaw/workspace/skills/osint-intel/state";
const OUTPUT_PATH = `${STATE_DIR}/latest-events.json`;
const META_PATH = `${STATE_DIR}/latest-meta.json`;
const MIN_ACCEPTABLE_ITEMS = 140;
const REFRESH_SCRIPTS = [
  "scripts/fetch-telegram.ts",
  "scripts/fetch-rss.ts",
  "scripts/fetch-gdelt.ts",
  "scripts/fetch-notams.ts",
  "scripts/fetch-military.ts",
  "scripts/fetch-sec.ts",
  "scripts/fetch-weather.ts",
  "scripts/fetch-acled.ts",
];

async function writeAtomically(path: string, content: string): Promise<void> {
  const tempPath = `${path}.tmp`;
  await writeFile(tempPath, content, "utf8");
  await rename(tempPath, path);
}

async function runJsonScript(scriptPath: string): Promise<IntelItem[]> {
  const proc = Bun.spawn(["bun", "run", scriptPath], {
    cwd: "/home/pyro1121/.openclaw/workspace/skills/osint-intel",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdoutText, stderrText, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (stderrText.trim()) process.stderr.write(stderrText);
  if (exitCode !== 0) return [];
  try {
    const parsed = JSON.parse(stdoutText) as unknown;
    return Array.isArray(parsed) ? (parsed as IntelItem[]) : [];
  } catch {
    return [];
  }
}

function dedupeByTitleAndSource(items: IntelItem[]): IntelItem[] {
  const seen = new Set<string>();
  const out: IntelItem[] = [];
  for (const item of items) {
    const key = `${item.title}||${item.source}`.toLowerCase().replace(/[^a-z0-9|]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export async function run(): Promise<void> {
  await mkdir(STATE_DIR, { recursive: true });
  const started = Date.now();
  const settled = await Promise.allSettled(REFRESH_SCRIPTS.map((scriptPath) => runJsonScript(scriptPath)));
  const fetched: IntelItem[] = [];
  const scriptStats: Record<string, number> = {};
  const scriptErrors: string[] = [];
  for (let i = 0; i < settled.length; i++) {
    const result = settled[i];
    const script = REFRESH_SCRIPTS[i];
    if (result.status === "fulfilled") {
      const count = result.value.length;
      scriptStats[script] = count;
      fetched.push(...result.value);
    } else {
      scriptStats[script] = 0;
      scriptErrors.push(`${script}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
    }
  }

  const merged = dedupeByTitleAndSource(fetched);
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  let items = merged.slice(0, 320);
  let fallbackUsed = false;

  if (items.length < MIN_ACCEPTABLE_ITEMS) {
    try {
      const previousRaw = await readFile(OUTPUT_PATH, "utf8");
      const previous = JSON.parse(previousRaw) as unknown;
      if (Array.isArray(previous) && previous.length > items.length) {
        items = previous as IntelItem[];
        fallbackUsed = true;
      }
    } catch {}
  }

  await writeAtomically(OUTPUT_PATH, JSON.stringify(items, null, 2));

  const meta = {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    itemCount: items.length,
    fallbackUsed,
    tgCount: items.filter((item) => String(item.source || "").includes("[tg:")).length,
    highOrCritical: items.filter(
      (item) => item.severity === "high" || item.severity === "critical",
    ).length,
    scriptStats,
    scriptErrors,
  };
  await writeAtomically(META_PATH, JSON.stringify(meta, null, 2));
  process.stdout.write(`${JSON.stringify(meta, null, 2)}\n`);
}

if (import.meta.main) {
  run().catch((error) => {
    process.stderr.write(
      `[osint-intel] refresh failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
