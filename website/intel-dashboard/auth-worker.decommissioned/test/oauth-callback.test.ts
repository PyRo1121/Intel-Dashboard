import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.ts";

type WorkerEnv = {
  AUTH_SECRET?: string;
  BASE_URL?: string;
  GITHUB_CLIENT_ID?: string;
  X_CLIENT_ID?: string;
};

const BASE_URL = "https://intel.pyro1121.com";

test("GitHub and X login routes are handled directly for /auth and /oauth aliases", async () => {
  const env: WorkerEnv = {
    AUTH_SECRET: "test-auth-secret",
    BASE_URL,
    GITHUB_CLIENT_ID: "github-client",
    X_CLIENT_ID: "x-client",
  };

  for (const path of ["/auth/login", "/auth/signup", "/oauth/login", "/oauth/signup"]) {
    const res = await worker.fetch(new Request(`${BASE_URL}${path}`), env);
    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") ?? "", /^https:\/\/github\.com\/login\/oauth\/authorize\?/);
  }

  for (const path of ["/auth/x/login", "/auth/x/signup", "/oauth/x/login", "/oauth/x/signup"]) {
    const res = await worker.fetch(new Request(`${BASE_URL}${path}`), env);
    assert.equal(res.status, 302);
    assert.match(res.headers.get("location") ?? "", /^https:\/\/x\.com\/i\/oauth2\/authorize\?/);
  }
});

test("GitHub and X callbacks reject missing state for both /auth and /oauth aliases", async () => {
  const env: WorkerEnv = {
    AUTH_SECRET: "test-auth-secret",
    BASE_URL,
    GITHUB_CLIENT_ID: "github-client",
    X_CLIENT_ID: "x-client",
  };

  for (const path of ["/auth/callback", "/oauth/callback"]) {
    const res = await worker.fetch(new Request(`${BASE_URL}${path}?code=abc&state=xyz`), env);
    assert.equal(res.status, 403);
    assert.match(await res.text(), /Invalid OAuth state/i);
  }

  for (const path of ["/auth/x/callback", "/oauth/x/callback"]) {
    const res = await worker.fetch(new Request(`${BASE_URL}${path}?code=abc&state=xyz`), env);
    assert.equal(res.status, 403);
    assert.match(await res.text(), /Invalid OAuth state/i);
  }
});
