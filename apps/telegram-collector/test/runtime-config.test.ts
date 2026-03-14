import assert from "node:assert/strict";
import test from "node:test";
import { parseCollectorChannelSpecs, readTelegramCollectorRuntimeConfig } from "../src/runtime-config.ts";

test("parseCollectorChannelSpecs trims, deduplicates, and defaults label/category", () => {
  const parsed = parseCollectorChannelSpecs(`
    @AbuAliExpress|Abu Ali Express|conflict
    sepahcybery||cyber
    @AbuAliExpress|Duplicate|ignored
  `);

  assert.deepEqual(parsed, [
    { username: "abualiexpress", label: "Abu Ali Express", category: "conflict" },
    { username: "sepahcybery", label: "sepahcybery", category: "cyber" },
  ]);
});

test("readTelegramCollectorRuntimeConfig normalizes env values", () => {
  const config = readTelegramCollectorRuntimeConfig({
    TELEGRAM_API_ID: "12345",
    TELEGRAM_API_HASH: "hash",
    TELEGRAM_SESSION_STRING: "session",
    TELEGRAM_ACCOUNT_ID: "acct-1",
    COLLECTOR_EDGE_URL: "https://intel.pyro1121.com",
    COLLECTOR_SHARED_SECRET: "secret",
    COLLECTOR_FLUSH_INTERVAL_MS: "900",
    TELEGRAM_HOT_CHANNELS: "channel-a|Channel A|conflict",
  } as NodeJS.ProcessEnv);

  assert.equal(config.apiId, 12345);
  assert.equal(config.accountId, "acct-1");
  assert.equal(config.flushIntervalMs, 900);
  assert.deepEqual(config.channels, [
    { username: "channel-a", label: "Channel A", category: "conflict" },
  ]);
  assert.deepEqual(config.missingConfig, []);
});
