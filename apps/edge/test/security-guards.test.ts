import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyDefaultSecurityHeaders,
  buildCorsHeaders,
  buildAdminSignaturePayload,
  decodeAndValidateMediaKey,
  DEFAULT_SECURITY_HEADERS,
  DEFAULT_APP_ORIGIN,
  isHeaderSecretAuthorized,
  isTrustedRequestOrigin,
  resolveAllowedCorsOrigin,
  signAdminRequest,
  verifySignedAdminRequest,
  verifySignedAdminRequestWithNonceGuard,
  verifyStripeWebhookSignature,
} from "../src/security-guards.ts";

describe("resolveAllowedCorsOrigin", () => {
  it("returns allowed localhost origin when present", () => {
    assert.equal(
      resolveAllowedCorsOrigin({
        origin: "http://localhost:3200",
      }),
      "http://localhost:3200",
    );
  });

  it("falls back to default origin for unknown or missing origins", () => {
    assert.equal(
      resolveAllowedCorsOrigin({
        origin: "https://evil.example.com",
      }),
      DEFAULT_APP_ORIGIN,
    );

    assert.equal(
      resolveAllowedCorsOrigin({
        origin: null,
      }),
      DEFAULT_APP_ORIGIN,
    );
  });
});

describe("buildCorsHeaders", () => {
  it("uses allowlisted origin and credentials policy", () => {
    const headers = buildCorsHeaders({ origin: "http://127.0.0.1:3200" });
    assert.equal(headers["Access-Control-Allow-Origin"], "http://127.0.0.1:3200");
    assert.equal(headers["Access-Control-Allow-Credentials"], "true");
    assert.ok(headers["Access-Control-Allow-Headers"]?.includes("X-Admin-Signature"));
    assert.equal(headers["X-Content-Type-Options"], "nosniff");
    assert.match(headers["Content-Security-Policy"] || "", /default-src 'self'/i);
    assert.match(headers["Content-Security-Policy"] || "", /frame-ancestors 'none'/i);
  });

  it("does not echo untrusted origin", () => {
    const headers = buildCorsHeaders({ origin: "https://attacker.example" });
    assert.equal(headers["Access-Control-Allow-Origin"], DEFAULT_APP_ORIGIN);
  });
});

describe("applyDefaultSecurityHeaders", () => {
  it("applies all defaults when missing", () => {
    const headers = applyDefaultSecurityHeaders(new Headers({ "Content-Type": "application/json" }));
    for (const [name, value] of Object.entries(DEFAULT_SECURITY_HEADERS)) {
      assert.equal(headers.get(name), value);
    }
  });

  it("does not override explicit security headers", () => {
    const headers = applyDefaultSecurityHeaders(new Headers({
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "default-src 'none'",
    }));
    assert.equal(headers.get("X-Frame-Options"), "SAMEORIGIN");
    assert.equal(headers.get("Content-Security-Policy"), "default-src 'none'");
    assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  });
});

describe("isHeaderSecretAuthorized", () => {
  it("authorizes only configured header secret", () => {
    const request = new Request("https://intel.pyro1121.com/api/cache-bust", {
      headers: {
        "x-admin-secret": "super-secret",
      },
    });

    assert.equal(
      isHeaderSecretAuthorized({
        request,
        configuredSecret: "super-secret",
      }),
      true,
    );
  });

  it("rejects query-string secret even when it matches", () => {
    const request = new Request(
      "https://intel.pyro1121.com/api/cache-bust?secret=super-secret",
    );

    assert.equal(
      isHeaderSecretAuthorized({
        request,
        configuredSecret: "super-secret",
      }),
      false,
    );
  });

  it("rejects missing or mismatched secrets", () => {
    const request = new Request("https://intel.pyro1121.com/api/cache-bust", {
      headers: {
        "x-admin-secret": "wrong-secret",
      },
    });

    assert.equal(
      isHeaderSecretAuthorized({
        request,
        configuredSecret: "super-secret",
      }),
      false,
    );

    assert.equal(
      isHeaderSecretAuthorized({
        request,
        configuredSecret: "",
      }),
      false,
    );
  });
});

describe("isTrustedRequestOrigin", () => {
  it("allows requests from trusted Origin header", () => {
    const request = new Request("https://intel.pyro1121.com/api/auth/me", {
      headers: {
        origin: DEFAULT_APP_ORIGIN,
      },
    });
    assert.equal(isTrustedRequestOrigin({ request }), true);
  });

  it("allows requests from trusted Referer origin", () => {
    const request = new Request("https://intel.pyro1121.com/api/auth/me", {
      headers: {
        referer: `${DEFAULT_APP_ORIGIN}/billing`,
      },
    });
    assert.equal(isTrustedRequestOrigin({ request }), true);
  });

  it("rejects untrusted Origin or malformed Referer", () => {
    const evilOrigin = new Request("https://intel.pyro1121.com/api/auth/me", {
      headers: {
        origin: "https://evil.example.com",
      },
    });
    assert.equal(isTrustedRequestOrigin({ request: evilOrigin }), false);

    const malformedReferer = new Request("https://intel.pyro1121.com/api/auth/me", {
      headers: {
        referer: "%%%not-a-url%%%",
      },
    });
    assert.equal(isTrustedRequestOrigin({ request: malformedReferer }), false);
  });

  it("rejects cross-site fetch metadata and accepts same-site metadata", () => {
    const crossSite = new Request("https://intel.pyro1121.com/api/auth/me", {
      headers: {
        "sec-fetch-site": "cross-site",
        origin: DEFAULT_APP_ORIGIN,
      },
    });
    assert.equal(isTrustedRequestOrigin({ request: crossSite }), false);

    const sameSite = new Request("https://intel.pyro1121.com/api/auth/me", {
      headers: {
        "sec-fetch-site": "same-site",
      },
    });
    assert.equal(isTrustedRequestOrigin({ request: sameSite }), true);
  });
});

describe("verifySignedAdminRequest", () => {
  async function sign(secret: string, payload: string): Promise<string> {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  it("accepts valid signed admin request", async () => {
    const secret = "super-secret";
    const timestamp = String(Date.now());
    const nonce = "nonce-1234567890abcd";
    const payload = buildAdminSignaturePayload({
      method: "POST",
      path: "/api/cache-bust",
      timestamp,
      nonce,
    });
    const signature = await sign(secret, payload);
    const headers = new Headers({
      "x-admin-timestamp": timestamp,
      "x-admin-nonce": nonce,
      "x-admin-signature": signature,
    });
    const result = await verifySignedAdminRequest({
      method: "POST",
      path: "/api/cache-bust",
      headers,
      configuredSecret: secret,
    });
    assert.equal(result.ok, true);
  });

  it("rejects stale or invalid signatures", async () => {
    const secret = "super-secret";
    const oldTimestamp = String(Date.now() - 20 * 60 * 1000);
    const nonce = "nonce-1234567890abcd";
    const payload = buildAdminSignaturePayload({
      method: "POST",
      path: "/api/cache-bust",
      timestamp: oldTimestamp,
      nonce,
    });
    const signature = await sign(secret, payload);
    const staleHeaders = new Headers({
      "x-admin-timestamp": oldTimestamp,
      "x-admin-nonce": nonce,
      "x-admin-signature": signature,
    });
    const stale = await verifySignedAdminRequest({
      method: "POST",
      path: "/api/cache-bust",
      headers: staleHeaders,
      configuredSecret: secret,
    });
    assert.equal(stale.ok, false);

    const badHeaders = new Headers({
      "x-admin-timestamp": String(Date.now()),
      "x-admin-nonce": nonce,
      "x-admin-signature": "0".repeat(64),
    });
    const invalid = await verifySignedAdminRequest({
      method: "POST",
      path: "/api/cache-bust",
      headers: badHeaders,
      configuredSecret: secret,
    });
    assert.equal(invalid.ok, false);
  });
});

describe("signAdminRequest", () => {
  it("builds signed headers that verify", async () => {
    const secret = "super-secret";
    const signed = await signAdminRequest({
      method: "POST",
      path: "/api/cache-bust",
      configuredSecret: secret,
      timestampMs: 1_730_000_000_000,
      nonce: "nonce-1234567890abcd",
    });
    assert.equal(signed.timestamp, "1730000000000");
    assert.equal(signed.nonce, "nonce-1234567890abcd");
    assert.equal(signed.signature.length, 64);

    const verified = await verifySignedAdminRequest({
      method: "POST",
      path: "/api/cache-bust",
      headers: new Headers(signed.headers),
      configuredSecret: secret,
      nowMs: 1_730_000_000_000,
    });
    assert.equal(verified.ok, true);
  });

  it("throws when secret is missing", async () => {
    await assert.rejects(
      signAdminRequest({
        method: "POST",
        path: "/api/cache-bust",
        configuredSecret: "",
      }),
      /secret_not_configured/,
    );
  });
});

describe("verifySignedAdminRequestWithNonceGuard", () => {
  async function buildSignedHeaders(secret: string, path: string): Promise<Headers> {
    const signed = await signAdminRequest({
      method: "POST",
      path,
      configuredSecret: secret,
      timestampMs: 1_730_000_000_000,
      nonce: "collector-nonce-123456",
    });
    return new Headers(signed.headers);
  }

  it("accepts valid signed requests after nonce guard approval", async () => {
    const seenBodies: string[] = [];
    const headers = await buildSignedHeaders("collector-secret", "/api/telegram/collector-ingest");
    const result = await verifySignedAdminRequestWithNonceGuard({
      method: "POST",
      path: "/api/telegram/collector-ingest",
      headers,
      configuredSecret: "collector-secret",
      nowMs: 1_730_000_000_000,
      clientIp: "203.0.113.9",
      nonceGuardNamespace: {
        idFromName: () => "main",
        get: () => ({
          async fetch(request: Request) {
            seenBodies.push(await request.text());
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          },
        }),
      },
    });

    assert.equal(result.ok, true);
    assert.equal(seenBodies.length, 1);
    assert.match(seenBodies[0] || "", /collector-nonce-123456/);
    assert.match(seenBodies[0] || "", /203\.0\.113\.9/);
  });

  it("rejects replayed nonces when the guard durable object blocks them", async () => {
    const headers = await buildSignedHeaders("collector-secret", "/api/telegram/collector-ingest");
    const result = await verifySignedAdminRequestWithNonceGuard({
      method: "POST",
      path: "/api/telegram/collector-ingest",
      headers,
      configuredSecret: "collector-secret",
      nowMs: 1_730_000_000_000,
      nonceGuardNamespace: {
        idFromName: () => "main",
        get: () => ({
          async fetch() {
            return new Response(JSON.stringify({ error: "nonce_reused" }), { status: 409 });
          },
        }),
      },
    });

    assert.deepEqual(result, {
      ok: false,
      reason: "nonce_reused",
      status: 409,
    });
  });
});

describe("decodeAndValidateMediaKey", () => {
  it("accepts safe media keys", () => {
    assert.equal(
      decodeAndValidateMediaKey("telegram/channel-1/post-1/image.jpg"),
      "telegram/channel-1/post-1/image.jpg",
    );
    assert.equal(
      decodeAndValidateMediaKey("nested%2Fsafe%2Fclip.mp4"),
      "nested/safe/clip.mp4",
    );
  });

  it("rejects traversal or malformed keys", () => {
    assert.equal(decodeAndValidateMediaKey("..%2Fsecrets.txt"), null);
    assert.equal(decodeAndValidateMediaKey("/absolute/path.txt"), null);
    assert.equal(decodeAndValidateMediaKey("bad\\path"), null);
    assert.equal(decodeAndValidateMediaKey("%E0%A4%A"), null);
  });
});

describe("verifyStripeWebhookSignature", () => {
  async function stripeHeader(secret: string, timestamp: number, body: string): Promise<string> {
    const signedPayload = `${timestamp}.${body}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
    const signature = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    return `t=${timestamp},v1=${signature}`;
  }

  it("accepts valid stripe signature", async () => {
    const secret = "whsec_test_secret";
    const body = JSON.stringify({ id: "evt_123" });
    const timestamp = Math.floor(Date.now() / 1000);
    const header = await stripeHeader(secret, timestamp, body);
    const result = await verifyStripeWebhookSignature({
      rawBody: body,
      signatureHeader: header,
      configuredSecret: secret,
    });
    assert.deepEqual(result, { ok: true });
  });

  it("rejects invalid stripe signature", async () => {
    const result = await verifyStripeWebhookSignature({
      rawBody: JSON.stringify({ id: "evt_bad" }),
      signatureHeader: "t=1,v1=deadbeef",
      configuredSecret: "whsec_test_secret",
      nowMs: Date.now(),
    });
    assert.equal(result.ok, false);
  });
});
