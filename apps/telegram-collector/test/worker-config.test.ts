import assert from "node:assert/strict";
import test from "node:test";
import { resolveCollectorWorkerFallbackConfig } from "../src/worker-config.ts";

test("resolveCollectorWorkerFallbackConfig marks missing worker prerequisites", () => {
  const config = resolveCollectorWorkerFallbackConfig({
    TELEGRAM_API_ID: "12345",
    TELEGRAM_API_HASH: "hash",
    TELEGRAM_SESSION_STRING: "session",
    TELEGRAM_ACCOUNT_ID: "acct-1",
  });

  assert.equal(config.configured, false);
  assert.deepEqual(config.missingConfig, [
    "TELEGRAM_HOT_CHANNELS",
    "COLLECTOR_EDGE_URL",
    "COLLECTOR_SHARED_SECRET",
  ]);
  assert.equal(config.accountId, "acct-1");
  assert.deepEqual(config.watchedChannels, []);
});

test("resolveCollectorWorkerFallbackConfig normalizes watched channels and configured state", () => {
  const config = resolveCollectorWorkerFallbackConfig({
    TELEGRAM_API_ID: "12345",
    TELEGRAM_API_HASH: "hash",
    TELEGRAM_SESSION_STRING: "session",
    TELEGRAM_ACCOUNT_ID: " acct-1 ",
    TELEGRAM_HOT_CHANNELS: " @AbuAliExpress|Abu Ali Express|conflict,\nsepahcybery||cyber ",
    COLLECTOR_EDGE_URL: "https://intel.pyro1121.com",
    COLLECTOR_SHARED_SECRET: "secret",
  });

  assert.equal(config.configured, true);
  assert.deepEqual(config.missingConfig, []);
  assert.equal(config.accountId, "acct-1");
  assert.deepEqual(config.watchedChannels, ["abualiexpress", "sepahcybery"]);
});
