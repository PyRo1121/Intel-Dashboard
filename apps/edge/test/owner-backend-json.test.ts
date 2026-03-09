import assert from "node:assert/strict";
import test from "node:test";
import { postOwnerBackendJson } from "../src/owner-backend-json.ts";

test("postOwnerBackendJson preserves backend error payloads", async () => {
  const result = await postOwnerBackendJson({
    backendToken: "token",
    url: "https://backend.example.com/api/test",
    userId: "owner-id",
    userLogin: "owner",
    errorPrefix: "Backend CRM summary",
    fetchImpl: (async () =>
      new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch,
  });

  assert.deepEqual(result, { ok: false, status: 403, error: "Forbidden" });
});

test("postOwnerBackendJson includes owner identity and extra body fields", async () => {
  let captured: string | null = null;
  const result = await postOwnerBackendJson({
    backendToken: "token",
    url: "https://backend.example.com/api/test",
    userId: "owner-id",
    userLogin: "owner",
    extraBody: { window: "24h" },
    errorPrefix: "Backend AI telemetry",
    fetchImpl: (async (input) => {
      const request = input as Request;
      captured = await request.text();
      return new Response(JSON.stringify({ result: { ok: true } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch,
  });

  assert.deepEqual(result, { ok: true, payload: { ok: true } });
  assert.equal(captured, JSON.stringify({ window: "24h", userId: "owner-id", userLogin: "owner" }));
});

test("postOwnerBackendJson normalizes transport failures", async () => {
  const result = await postOwnerBackendJson({
    backendToken: "token",
    url: "https://backend.example.com/api/test",
    userId: "owner-id",
    userLogin: "owner",
    errorPrefix: "Backend CRM summary",
    fetchImpl: (async () => {
      throw new Error("connect ECONNREFUSED");
    }) as typeof fetch,
  });

  assert.deepEqual(result, { ok: false, status: 502, error: "connect ECONNREFUSED" });
});

