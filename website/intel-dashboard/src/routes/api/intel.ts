import type { APIEvent } from "@solidjs/start/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_PATH = join(
  homedir(),
  ".openclaw/workspace/skills/osint-intel/state/latest-events.json",
);

export async function GET(_event: APIEvent) {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const payload = Array.isArray(parsed) ? parsed : [];
    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=90",
      },
    });
  } catch {
    return new Response("[]", {
      headers: { "Content-Type": "application/json" },
    });
  }
}
