import { filterRecentDuplicates } from "./utils/dedup";
import { jsonStdout, stderr, toIsoOrNow, type IntelItem } from "./utils/types";

const FETCHERS = [
  "scripts/fetch-gdelt.ts",
  "scripts/fetch-rss.ts",
  "scripts/fetch-acled.ts",
  "scripts/fetch-notams.ts",
  "scripts/fetch-military.ts",
  "scripts/fetch-sec.ts",
  "scripts/fetch-weather.ts",
  "scripts/fetch-telegram.ts",
];

async function runFetcher(scriptPath: string): Promise<IntelItem[]> {
  const proc = Bun.spawn(["bun", "run", scriptPath], {
    cwd: "/home/pyro1121/.openclaw/workspace/skills/osint-intel",
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdoutText, stderrText] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;
  if (stderrText.trim()) {
    process.stderr.write(stderrText);
  }

  if (exitCode !== 0) {
    throw new Error(`${scriptPath} exited with code ${exitCode}`);
  }

  const parsed = JSON.parse(stdoutText) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .filter((item): item is IntelItem => Boolean(item && typeof item === "object"))
    .map((item) => ({
      ...item,
      timestamp: toIsoOrNow(item.timestamp),
      raw_data: item.raw_data ?? null,
    }));
}

export async function run(): Promise<IntelItem[]> {
  const settled = await Promise.allSettled(FETCHERS.map((script) => runFetcher(script)));

  const merged: IntelItem[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      merged.push(...result.value);
    } else {
      stderr("Fetcher failed during aggregate", result.reason);
    }
  }

  const deduped = await filterRecentDuplicates(merged);
  deduped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return deduped;
}

if (import.meta.main) {
  run()
    .then((items) => jsonStdout(items))
    .catch((error) => {
      stderr("Fatal error in aggregate", error);
      jsonStdout([]);
    });
}
