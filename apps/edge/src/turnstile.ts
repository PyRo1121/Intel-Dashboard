export type TurnstileMode = "login" | "signup";

type TurnstileGatePayload = {
  mode: TurnstileMode;
  iat: number;
  exp: number;
};

const DEFAULT_GATE_TTL_MS = 8 * 60_000;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeHexEqual(a: string, b: string): boolean {
  const aa = a.trim().toLowerCase();
  const bb = b.trim().toLowerCase();
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i += 1) {
    diff |= aa.charCodeAt(i) ^ bb.charCodeAt(i);
  }
  return diff === 0;
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input: string): string | null {
  if (!input || /[^A-Za-z0-9\-_]/.test(input)) return null;
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(new TextEncoder().encode(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    toArrayBuffer(new TextEncoder().encode(payload)),
  );
  return bytesToHex(new Uint8Array(digest));
}

function parsePayload(raw: string): TurnstileGatePayload | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const mode = parsed.mode;
    const iat = parsed.iat;
    const exp = parsed.exp;
    if (mode !== "login" && mode !== "signup") return null;
    if (typeof iat !== "number" || !Number.isFinite(iat) || iat <= 0) return null;
    if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0 || exp <= iat) return null;
    return { mode, iat, exp };
  } catch {
    return null;
  }
}

export async function createTurnstileGateToken(params: {
  secret: string;
  mode: TurnstileMode;
  nowMs?: number;
  ttlMs?: number;
}): Promise<string> {
  const secret = params.secret.trim();
  if (!secret) {
    throw new Error("turnstile_gate_secret_missing");
  }
  const nowMs = params.nowMs ?? Date.now();
  const ttlMs = Math.max(10_000, Math.floor(params.ttlMs ?? DEFAULT_GATE_TTL_MS));
  const payload: TurnstileGatePayload = {
    mode: params.mode,
    iat: nowMs,
    exp: nowMs + ttlMs,
  };
  const encoded = toBase64Url(JSON.stringify(payload));
  const signature = await signPayload(secret, encoded);
  return `${encoded}.${signature}`;
}

export async function verifyTurnstileGateToken(params: {
  secret: string;
  token: string;
  expectedMode: TurnstileMode;
  nowMs?: number;
}): Promise<boolean> {
  const secret = params.secret.trim();
  const token = params.token.trim();
  if (!secret || !token) return false;
  const split = token.split(".");
  if (split.length !== 2) return false;
  const [encoded, signature] = split;
  if (!encoded || !signature || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  const expectedSignature = await signPayload(secret, encoded);
  if (!timingSafeHexEqual(signature, expectedSignature)) return false;
  const decoded = fromBase64Url(encoded);
  if (!decoded) return false;
  const payload = parsePayload(decoded);
  if (!payload) return false;
  if (payload.mode !== params.expectedMode) return false;
  const nowMs = params.nowMs ?? Date.now();
  if (payload.exp <= nowMs) return false;
  return true;
}

