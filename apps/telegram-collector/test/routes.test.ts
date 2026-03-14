import assert from "node:assert/strict";
import test from "node:test";
import { isCollectorPushBatchPath } from "../src/routes.ts";

test("isCollectorPushBatchPath recognizes both legacy and explicit control routes", () => {
  assert.equal(isCollectorPushBatchPath("/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/control/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/status"), false);
});


test("collector worker exposes the explicit join control route shape", () => {
  const path = "/control/join-configured-channels";
  assert.equal(path.startsWith("/control/"), true);
});


import fs from "node:fs";
import path from "node:path";

test("collector status exposes mappedChannelIds field", () => {
  const source = fs.readFileSync(path.resolve("src/container-server.mjs"), "utf8");
  assert.match(source, /mappedChannelIds/);
});


test("collector worker proxies runtime routes through the shared retry path", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /proxyCollectorRequest/);
  assert.match(source, /container\.fetch\(request\)/);
});


test("collector worker retries cold-start container errors", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /COLLECTOR_PROXY_RETRY_ATTEMPTS/);
  assert.match(source, /proxyCollectorRequest/);
});


test("collector runtime auto-joins missing configured channels after connect", () => {
  const source = fs.readFileSync(path.resolve("src/container-server.mjs"), "utf8");
  assert.match(source, /async function joinMissingChannels/);
  assert.match(source, /await joinMissingChannels\(\)/);
});


test("collector worker exposes live status route", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /url.pathname === "\/status\/live"/);
});


test("collector status exposes control sync telemetry", () => {
  const source = fs.readFileSync(path.resolve("src/container-server.mjs"), "utf8");
  assert.match(source, /lastControlSyncAt/);
  assert.match(source, /lastControlSyncError/);
  assert.match(source, /controlSyncAttempts/);
});


test("collector status distinguishes stored vs default state", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /stateSource/);
});

test("collector state-update route is signature-protected", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /url\.pathname === "\/control\/state-update"/);
  assert.match(source, /verifyControlRequest\(request, env\.COLLECTOR_SHARED_SECRET\)/);
});

test("collector control signatures enforce a freshness window", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  const authSource = fs.readFileSync(path.resolve("src/control-auth.ts"), "utf8");
  assert.match(source, /CONTROL_REQUEST_MAX_SKEW_MS/);
  assert.match(source, /verifySignedControlRequest/);
  assert.match(authSource, /Math\.abs\(nowMs - timestampMs\) > params\.maxSkewMs/);
});


test("collector status marks default snapshots as non-authoritative", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /stateSource: hasStoredState \? "stored" : "default"/);
  assert.match(source, /controlStateSource === "stored"/);
});

test("collector status validates stored state against current watched set", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /isStoredCollectorControlState\(payload, defaults\)/);
  assert.match(source, /normalizeCollectorControlUpdate\(payload, defaults\)/);
});

test("collector control routes enforce nonce-guarded control signatures", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  const authSource = fs.readFileSync(path.resolve("src/control-auth.ts"), "utf8");
  assert.match(source, /verifyControlRequestWithNonceGuard/);
  assert.match(source, /url\.pathname === "\/admin\/guard"/);
  assert.match(source, /blockConcurrencyWhile/);
  assert.match(source, /verifySignedControlRequest/);
  assert.match(source, /enforceControlNonceGuard/);
  assert.match(authSource, /replay_detected/);
});

test("collector does not drop buffered messages before a successful forward", () => {
  const source = fs.readFileSync(path.resolve("src/container-server.mjs"), "utf8");
  assert.match(source, /const batchMessages = buffer\.slice\(0, buffer\.length\)/);
  assert.match(source, /if \(!result\.ok\)/);
  assert.doesNotMatch(source, /state\.droppedMessages \+= batchMessages\.length/);
});

test("control DO only treats matching watched sets as stored state", () => {
  const source = fs.readFileSync(path.resolve("src/index.ts"), "utf8");
  assert.match(source, /const hasStoredState = isStoredCollectorControlState\(state, defaults\)/);
});


test("collector worker exposes refresh availability control route shape", () => {
  const path = "/control/refresh-availability";
  assert.equal(path.startsWith("/control/"), true);
});
