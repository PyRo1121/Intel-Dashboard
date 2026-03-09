import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSecurityHeaders,
  fetchWithRetry,
  readJson,
  requireBackendBaseUrl,
  requireBackendToken,
  USER_ID,
  NON_OWNER_USER_ID,
} from "./backend-api-helpers.mjs";

test("backend billing status and activity return authenticated owner payloads with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireBackendToken(t);
  if (!token) return;

  const [statusResponse, activityResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/status`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/activity`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
  ]);

  assert.equal(statusResponse.status, 200);
  assert.equal(activityResponse.status, 200);
  assertSecurityHeaders(statusResponse, "backend billing status");
  assertSecurityHeaders(activityResponse, "backend billing activity");

  const statusPayload = await readJson(statusResponse);
  const activityPayload = await readJson(activityResponse);

  assert.equal(statusPayload?.ok, true);
  assert.equal(typeof statusPayload?.result?.role, "string");
  assert.equal(typeof statusPayload?.result?.policy?.rateLimitPerMinute, "number");
  assert.equal(typeof statusPayload?.result?.rateLimit?.remaining, "number");

  assert.equal(activityPayload?.ok, true);
  assert.ok(Array.isArray(activityPayload?.result?.events));
  assert.equal(typeof activityPayload?.result?.total, "number");
});

test("backend billing owner actions return bypass semantics with bearer token", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireBackendToken(t);
  if (!token) return;

  const [trialResponse, checkoutResponse, portalResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/start-trial`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/checkout`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/billing/portal`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
  ]);

  assert.equal(trialResponse.status, 200);
  assert.equal(checkoutResponse.status, 200);
  assert.equal(portalResponse.status, 200);
  assertSecurityHeaders(trialResponse, "backend billing start-trial");
  assertSecurityHeaders(checkoutResponse, "backend billing checkout");
  assertSecurityHeaders(portalResponse, "backend billing portal");

  const [trialPayload, checkoutPayload, portalPayload] = await Promise.all([
    readJson(trialResponse),
    readJson(checkoutResponse),
    readJson(portalResponse),
  ]);

  assert.equal(trialPayload?.ok, true);
  assert.equal(trialPayload?.result?.owner, true);
  assert.equal(trialPayload?.result?.trialStarted, false);

  assert.equal(checkoutPayload?.ok, true);
  assert.equal(checkoutPayload?.result?.owner, true);
  assert.equal(checkoutPayload?.result?.bypassCheckout, true);

  assert.equal(portalPayload?.ok, true);
  assert.equal(portalPayload?.result?.owner, true);
  assert.equal(portalPayload?.result?.bypassPortal, true);
});

test("backend admin CRM summary enforces owner role and returns owner schema", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireBackendToken(t);
  if (!token) return;

  const [nonOwnerResponse, ownerResponse] = await Promise.all([
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: NON_OWNER_USER_ID }),
    }),
    fetchWithRetry(`${backendBaseUrl}/api/intel-dashboard/admin/crm/summary`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID }),
    }),
  ]);

  assert.equal(nonOwnerResponse.status, 403);
  assert.equal(ownerResponse.status, 200);
  assertSecurityHeaders(nonOwnerResponse, "backend admin crm summary non-owner");
  assertSecurityHeaders(ownerResponse, "backend admin crm summary owner");

  const ownerPayload = await readJson(ownerResponse);
  assert.equal(ownerPayload?.ok, true);
  assert.equal(typeof ownerPayload?.result?.billing?.trackedUsers, "number");
  assert.equal(typeof ownerPayload?.result?.telemetry?.events24h, "number");
  assert.equal(typeof ownerPayload?.result?.commandCenter?.revenue?.arpuActiveUsd, "number");
});

test("backend owner CRM operation routes return missing-account semantics for unmapped target", async (t) => {
  const backendBaseUrl = requireBackendBaseUrl(t);
  if (!backendBaseUrl) return;
  const token = requireBackendToken(t);
  if (!token) return;

  const requests = [
    ["customer", "/api/intel-dashboard/admin/crm/customer"],
    ["cancel-subscription", "/api/intel-dashboard/admin/crm/cancel-subscription"],
    ["refund", "/api/intel-dashboard/admin/crm/refund"],
  ];

  for (const [label, path] of requests) {
    const response = await fetchWithRetry(`${backendBaseUrl}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ userId: USER_ID, targetUserId: "missing-account-user" }),
    });
    assert.equal(response.status, 404, `${label} should return missing billing account`);
    assertSecurityHeaders(response, `backend admin crm ${label}`);
    const payload = await readJson(response);
    assert.equal(payload?.error, "Billing account not found for target user.");
  }
});
