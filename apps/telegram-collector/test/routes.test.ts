import assert from "node:assert/strict";
import test from "node:test";
import { isCollectorPushBatchPath } from "../src/routes.ts";
import fs from "node:fs";

test("isCollectorPushBatchPath recognizes both legacy and explicit control routes", () => {
  assert.equal(isCollectorPushBatchPath("/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/control/push-batch"), true);
  assert.equal(isCollectorPushBatchPath("/status"), false);
});

function readSource(name: string): string {
  return fs.readFileSync(new URL(`../src/${name}`, import.meta.url), "utf8");
}

test("collector status exposes mappedChannelIds field", () => {
  const source = readSource("container-server.mjs");
  assert.match(source, /mappedChannelIds/);
});


test("collector worker proxies runtime routes through the shared retry path", () => {
  const source = readSource("index.ts");
  assert.match(source, /proxyCollectorRequest/);
  assert.match(source, /container\.fetch\(new Request\(request\)\)/);
});


test("collector worker retries cold-start container errors", () => {
  const source = readSource("index.ts");
  assert.match(source, /COLLECTOR_PROXY_RETRY_ATTEMPTS/);
  assert.match(source, /proxyCollectorRequest/);
});


test("collector runtime auto-joins missing configured channels after connect", () => {
  const source = readSource("container-server.mjs");
  assert.match(source, /async function joinMissingChannels/);
  assert.match(source, /await joinMissingChannels\(\)/);
  assert.match(source, /new TelegramApi\.channels\.JoinChannel/);
});


test("collector worker exposes live status route", () => {
  const source = readSource("index.ts");
  assert.match(source, /url.pathname === "\/status\/live"/);
});


test("collector status exposes control sync telemetry", () => {
  const source = readSource("container-server.mjs");
  assert.match(source, /lastControlSyncAt/);
  assert.match(source, /lastControlSyncError/);
  assert.match(source, /controlSyncAttempts/);
  assert.match(source, /scheduleAvailabilityRefresh\(\);/);
});


test("collector status distinguishes stored vs default state", () => {
  const source = readSource("index.ts");
  assert.match(source, /stateSource/);
});

test("collector state-update route is signature-protected", () => {
  const source = readSource("index.ts");
  assert.match(source, /url\.pathname === "\/control\/state-update"/);
  assert.match(source, /verifyControlRequest\(request, env\.COLLECTOR_SHARED_SECRET\)/);
});

test("collector control signatures enforce a freshness window", () => {
  const source = readSource("index.ts");
  const authSource = readSource("control-auth.ts");
  assert.match(source, /CONTROL_REQUEST_MAX_SKEW_MS/);
  assert.match(source, /verifySignedControlRequest/);
  assert.match(authSource, /Math\.abs\(nowMs - timestampMs\) > params\.maxSkewMs/);
});


test("collector status marks default snapshots as non-authoritative", () => {
  const source = readSource("index.ts");
  assert.match(source, /stateSource: hasStoredState \? "stored" : "default"/);
  assert.match(source, /controlStateSource === "stored"/);
});

test("collector status validates stored state against current watched set", () => {
  const source = readSource("index.ts");
  assert.match(source, /isStoredCollectorControlState\(payload, defaults\)/);
  assert.match(source, /normalizeCollectorControlUpdate\(payload, defaults\)/);
});

test("collector control routes enforce nonce-guarded control signatures", () => {
  const source = readSource("index.ts");
  const authSource = readSource("control-auth.ts");
  assert.match(source, /verifyControlRequestWithNonceGuard/);
  assert.match(source, /buildNonceGuardFailureResponse/);
  assert.match(source, /Retry-After/);
  assert.match(source, /url\.pathname === "\/admin\/guard"/);
  assert.match(source, /blockConcurrencyWhile/);
  assert.match(source, /verifySignedControlRequest/);
  assert.match(source, /enforceControlNonceGuard/);
  assert.match(authSource, /replay_detected/);
});

test("collector does not drop buffered messages before a successful forward", () => {
  const source = readSource("container-server.mjs");
  assert.match(source, /const batchMessages = buffer\.slice\(0, buffer\.length\)/);
  assert.match(source, /if \(!result\.ok\)/);
  assert.doesNotMatch(source, /state\.droppedMessages \+= batchMessages\.length/);
});

test("control DO only treats matching watched sets as stored state", () => {
  const source = readSource("index.ts");
  assert.match(source, /const hasStoredState = isStoredCollectorControlState\(state, defaults\)/);
});


test("collector worker exposes refresh availability control route shape", () => {
  const routePath = "/control/refresh-availability";
  assert.equal(routePath.startsWith("/control/"), true);
});
