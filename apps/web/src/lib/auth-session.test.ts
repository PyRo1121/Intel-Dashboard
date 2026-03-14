import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_SESSION_TIMEOUT_MS,
  buildAuthSessionRequestInit,
  fetchAuthSession,
  fetchAuthSessionState,
  normalizeAuthSessionPayload,
} from "./auth-session.ts";

test("normalizeAuthSessionPayload returns normalized authenticated user", () => {
  const result = normalizeAuthSessionPayload({
    authenticated: true,
    user: {
      login: " PyRo1121 ",
      name: " PyRo1121 ",
      avatar_url: "",
      id: "owner-1",
      provider: "x",
    },
    entitlement: {
      role: "owner",
      entitled: true,
    },
  });

  assert.deepEqual(result, {
    login: "PyRo1121",
    name: "PyRo1121",
    avatar_url: "",
    id: "owner-1",
    provider: "x",
    entitlement: {
      role: "owner",
      entitled: true,
    },
  });
});

test("normalizeAuthSessionPayload rejects malformed or unauthenticated payloads", () => {
  assert.equal(normalizeAuthSessionPayload(null), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: false }), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: true, user: { login: "", name: "X", id: "1" } }), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: true, user: { login: "x", name: "", id: "1" } }), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: true, user: { login: "x", name: "X", id: null } }), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: true, user: { login: "x", name: "X", id: "   " } }), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: true, user: { login: "x", name: "X", id: Number.NaN } }), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: true, user: { login: "x", name: "X", id: 1.5 } }), null);
  assert.equal(normalizeAuthSessionPayload({ authenticated: true, user: { login: "x", name: "X", id: Number.MAX_SAFE_INTEGER + 1 } }), null);
});

test("normalizeAuthSessionPayload preserves shared entitlement limits payloads", () => {
  const result = normalizeAuthSessionPayload({
    authenticated: true,
    user: {
      login: "PyRo1121",
      name: "PyRo1121",
      avatar_url: "",
      id: "owner-1",
    },
    entitlement: {
      role: "owner",
      entitled: true,
      limits: {
        intelMaxItems: 25,
        telegramTotalMessagesMax: 200,
      },
    },
  });

  assert.deepEqual(result?.entitlement?.limits, {
    intelMaxItems: 25,
    telegramTotalMessagesMax: 200,
  });
});

test("normalizeAuthSessionPayload normalizes nested entitlement fields", () => {
  const result = normalizeAuthSessionPayload({
    authenticated: true,
    user: {
      login: "PyRo1121",
      name: "PyRo1121",
      avatar_url: "",
      id: "owner-1",
    },
    entitlement: {
      tier: " owner ",
      role: " owner ",
      entitled: true,
      delayMinutes: "15",
      limits: {
        intelMaxItems: "25",
        briefingsMaxItems: null,
        telegramChannelMessagesMax: " 50 ",
        airSeaMaxItems: "not-a-number",
      },
    },
  });

  assert.deepEqual(result?.entitlement, {
    tier: "owner",
    role: "owner",
    entitled: true,
    delayMinutes: 15,
    limits: {
      intelMaxItems: 25,
      briefingsMaxItems: null,
      telegramChannelMessagesMax: 50,
    },
  });
});

test("buildAuthSessionRequestInit sets no-store, credentials, and timeout signal", async () => {
  const init = buildAuthSessionRequestInit(undefined, 5);
  assert.equal(init.credentials, "include");
  assert.equal(init.cache, "no-store");
  assert.ok(init.signal instanceof AbortSignal);

  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(init.signal.aborted, true);
});

test("buildAuthSessionRequestInit respects caller abort signal", () => {
  const controller = new AbortController();
  const init = buildAuthSessionRequestInit(controller.signal, AUTH_SESSION_TIMEOUT_MS);
  assert.ok(init.signal instanceof AbortSignal);
  controller.abort();
  assert.equal(init.signal.aborted, true);
});

test("fetchAuthSession uses canonical request shape and returns normalized session", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchMock = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init || {} });
    return new Response(JSON.stringify({
      authenticated: true,
      user: {
        login: "PyRo1121",
        name: "PyRo1121",
        avatar_url: "",
        id: "owner-1",
      },
      entitlement: {
        role: "owner",
        entitled: true,
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  const result = await fetchAuthSession(fetchMock);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "/api/auth/me");
  assert.equal(calls[0].init.credentials, "include");
  assert.equal(calls[0].init.cache, "no-store");
  assert.equal(result?.login, "PyRo1121");
  assert.equal(result?.entitlement?.role, "owner");
});

test("fetchAuthSession returns null on non-ok or invalid JSON payloads", async () => {
  const notOkFetch = (async () => new Response("nope", { status: 401 })) as typeof fetch;
  const invalidJsonFetch = (async () => new Response("{", {
    status: 200,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;

  assert.equal(await fetchAuthSession(notOkFetch), null);
  assert.equal(await fetchAuthSession(invalidJsonFetch), null);
});

test("fetchAuthSessionState distinguishes unauthenticated from unavailable states", async () => {
  const unauthenticatedFetch = (async () => new Response("nope", { status: 401 })) as typeof fetch;
  const unavailableFetch = (async () => new Response("down", { status: 503 })) as typeof fetch;
  const networkErrorFetch = (async () => {
    throw new TypeError("network down");
  }) as typeof fetch;
  const invalidJsonFetch = (async () => new Response("{", {
    status: 200,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;

  assert.deepEqual(await fetchAuthSessionState(unauthenticatedFetch), { status: "unauthenticated" });
  assert.deepEqual(await fetchAuthSessionState(unavailableFetch), { status: "unavailable", reason: "http_503" });
  assert.deepEqual(await fetchAuthSessionState(networkErrorFetch), { status: "unavailable", reason: "network" });
  assert.deepEqual(await fetchAuthSessionState(invalidJsonFetch), { status: "unavailable", reason: "invalid_payload" });
});
