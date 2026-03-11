import crypto from "node:crypto";

function trim(value) {
  return (value || "").trim();
}

function buildSignaturePayload(method, path, timestamp, nonce) {
  return [method.toUpperCase(), path, timestamp, nonce].join("\n");
}

function hmacSha256Hex(secret, payload) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function signCollectorRequest({ method, path, secret, nonce, timestampMs }) {
  const cleanSecret = trim(secret);
  if (!cleanSecret) {
    throw new Error("collector_shared_secret_missing");
  }
  const timestamp = String(Math.floor(timestampMs ?? Date.now()));
  const resolvedNonce = trim(nonce) || crypto.randomUUID().replace(/-/g, "");
  const signature = hmacSha256Hex(cleanSecret, buildSignaturePayload(method, path, timestamp, resolvedNonce));
  return {
    "X-Admin-Timestamp": timestamp,
    "X-Admin-Nonce": resolvedNonce,
    "X-Admin-Signature": signature,
  };
}

export async function forwardCollectorBatch({ edgeUrl, edgePath, secret, batch, asyncApply }) {
  const path = trim(edgePath) || "/api/telegram/collector-ingest";
  const url = new URL(path, edgeUrl);
  const headers = signCollectorRequest({
    method: "POST",
    path: url.pathname,
    secret,
  });
  return fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(asyncApply ? { "X-Collector-Async": "1" } : {}),
      ...headers,
    },
    body: JSON.stringify(batch),
  });
}
