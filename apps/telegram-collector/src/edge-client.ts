import type { TelegramCollectorBatch } from "@intel-dashboard/shared/telegram-collector.ts";

function trim(value: string | undefined | null): string {
  return (value || "").trim();
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function buildSignaturePayload(method: string, path: string, timestamp: string, nonce: string): string {
  return [method.toUpperCase(), path, timestamp, nonce].join("\n");
}

export async function signCollectorRequest(args: {
  method: string;
  path: string;
  secret: string;
  nonce?: string;
  timestampMs?: number;
}): Promise<Record<string, string>> {
  const secret = trim(args.secret);
  if (!secret) {
    throw new Error("collector_shared_secret_missing");
  }
  const timestamp = String(Math.floor(args.timestampMs ?? Date.now()));
  const nonce = trim(args.nonce) || crypto.randomUUID().replace(/-/g, "");
  const signature = await hmacSha256Hex(secret, buildSignaturePayload(args.method, args.path, timestamp, nonce));
  return {
    "X-Admin-Timestamp": timestamp,
    "X-Admin-Nonce": nonce,
    "X-Admin-Signature": signature,
  };
}

export async function forwardCollectorBatch(args: {
  edgeUrl: string;
  edgePath: string;
  secret: string;
  batch: TelegramCollectorBatch;
  asyncApply?: boolean;
}): Promise<Response> {
  const path = trim(args.edgePath) || "/api/telegram/collector-ingest";
  const url = new URL(path, args.edgeUrl);
  const headers = await signCollectorRequest({
    method: "POST",
    path: url.pathname,
    secret: args.secret,
  });
  return fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(args.asyncApply ? { "X-Collector-Async": "1" } : {}),
      ...headers,
    },
    body: JSON.stringify(args.batch),
  });
}
