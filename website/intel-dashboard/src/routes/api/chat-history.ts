import type { APIEvent } from "@solidjs/start/server";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const SESSIONS_DIR = join(homedir(), ".openclaw/agents/main/sessions");
const SESSIONS_INDEX_PATH = join(SESSIONS_DIR, "sessions.json");
const DEFAULT_SESSION_LIMIT = 6;
const MAX_SESSION_LIMIT = 20;
const DEFAULT_MESSAGES_PER_SESSION = 25;
const MAX_MESSAGES_PER_SESSION = 80;
const MAX_MESSAGE_TEXT = 1200;

interface SessionSummary {
  sessionId: string;
  updatedAt: number;
}

interface ChatHistoryMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  model?: string;
  provider?: string;
}

interface ChatHistorySession {
  sessionId: string;
  updatedAt: string;
  messageCount: number;
  messages: ChatHistoryMessage[];
}

interface ChatHistoryResponse {
  generatedAt: string;
  totalSessions: number;
  returnedSessions: number;
  sessions: ChatHistorySession[];
}

function clampPositiveInt(value: string | null, fallback: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function normalizeSessionId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed.endsWith(".jsonl") && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    return null;
  }
  return trimmed.replace(/\.jsonl$/i, "");
}

async function loadSessionIndexFromManifest(): Promise<SessionSummary[]> {
  try {
    const raw = await readFile(SESSIONS_INDEX_PATH, "utf-8");
    const data = JSON.parse(raw) as Record<string, unknown>;
    const sessions: SessionSummary[] = [];

    for (const value of Object.values(data)) {
      if (!value || typeof value !== "object") continue;
      const candidate = value as Record<string, unknown>;
      const sessionId = normalizeSessionId(candidate.sessionId);
      if (!sessionId) continue;

      const updatedAtRaw = candidate.updatedAt;
      const updatedAt = typeof updatedAtRaw === "number" && Number.isFinite(updatedAtRaw)
        ? updatedAtRaw
        : Date.now();

      sessions.push({ sessionId, updatedAt });
    }

    return sessions;
  } catch {
    return [];
  }
}

async function loadSessionIndexFromDirectory(): Promise<SessionSummary[]> {
  try {
    const entries = await readdir(SESSIONS_DIR);
    const jsonlFiles = entries.filter((entry) => entry.endsWith(".jsonl"));
    const summaries: SessionSummary[] = [];

    for (const fileName of jsonlFiles) {
      const sessionId = normalizeSessionId(fileName);
      if (!sessionId) continue;
      const filePath = join(SESSIONS_DIR, fileName);
      try {
        const fileStat = await stat(filePath);
        summaries.push({
          sessionId,
          updatedAt: fileStat.mtimeMs,
        });
      } catch {
        continue;
      }
    }

    return summaries;
  } catch {
    return [];
  }
}

function extractText(content: unknown): string {
  if (typeof content === "string") {
    return content.slice(0, MAX_MESSAGE_TEXT);
  }

  if (!Array.isArray(content)) return "";

  const chunks: string[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const entry = part as Record<string, unknown>;
    if (entry.type !== "text") continue;
    const text = entry.text;
    if (typeof text === "string" && text.trim()) {
      chunks.push(text.trim());
    }
  }

  return chunks.join("\n").slice(0, MAX_MESSAGE_TEXT);
}

function parseHistoryMessages(rawJsonl: string, limit: number): ChatHistoryMessage[] {
  const lines = rawJsonl.split("\n");
  const parsed: ChatHistoryMessage[] = [];

  for (let idx = lines.length - 1; idx >= 0 && parsed.length < limit; idx--) {
    const line = lines[idx]?.trim();
    if (!line) continue;

    try {
      const row = JSON.parse(line) as Record<string, unknown>;
      if (row.type !== "message") continue;

      const envelope = row.message;
      if (!envelope || typeof envelope !== "object") continue;
      const message = envelope as Record<string, unknown>;
      const role = message.role;
      if (role !== "user" && role !== "assistant" && role !== "system") continue;

      const text = extractText(message.content);
      if (!text) continue;

      const timestamp = typeof row.timestamp === "string"
        ? row.timestamp
        : (typeof message.timestamp === "number" ? new Date(message.timestamp).toISOString() : new Date().toISOString());

      const model = typeof message.model === "string" ? message.model : undefined;
      const provider = typeof message.provider === "string" ? message.provider : undefined;

      parsed.push({
        id: typeof row.id === "string" ? row.id : crypto.randomUUID(),
        role,
        text,
        timestamp,
        model,
        provider,
      });
    } catch {
      continue;
    }
  }

  return parsed.reverse();
}

async function loadChatHistory(sessionLimit: number, messageLimit: number): Promise<ChatHistoryResponse> {
  const fromManifest = await loadSessionIndexFromManifest();
  const fromDirectory = await loadSessionIndexFromDirectory();

  const merged = new Map<string, number>();
  for (const item of [...fromManifest, ...fromDirectory]) {
    const current = merged.get(item.sessionId) ?? 0;
    if (item.updatedAt > current) {
      merged.set(item.sessionId, item.updatedAt);
    }
  }

  const sorted = [...merged.entries()]
    .map(([sessionId, updatedAt]) => ({ sessionId, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const selected = sorted.slice(0, sessionLimit);
  const sessions: ChatHistorySession[] = [];

  for (const item of selected) {
    const filePath = join(SESSIONS_DIR, `${item.sessionId}.jsonl`);
    try {
      const raw = await readFile(filePath, "utf-8");
      const messages = parseHistoryMessages(raw, messageLimit);
      sessions.push({
        sessionId: item.sessionId,
        updatedAt: new Date(item.updatedAt).toISOString(),
        messageCount: messages.length,
        messages,
      });
    } catch {
      continue;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    totalSessions: sorted.length,
    returnedSessions: sessions.length,
    sessions,
  };
}

export async function GET(event: APIEvent): Promise<Response> {
  const url = new URL(event.request.url);
  const sessionLimit = clampPositiveInt(
    url.searchParams.get("sessions"),
    DEFAULT_SESSION_LIMIT,
    MAX_SESSION_LIMIT,
  );
  const messageLimit = clampPositiveInt(
    url.searchParams.get("messages"),
    DEFAULT_MESSAGES_PER_SESSION,
    MAX_MESSAGES_PER_SESSION,
  );

  try {
    const payload = await loadChatHistory(sessionLimit, messageLimit);
    return new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    const fallback: ChatHistoryResponse = {
      generatedAt: new Date().toISOString(),
      totalSessions: 0,
      returnedSessions: 0,
      sessions: [],
    };
    return new Response(JSON.stringify(fallback), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}
