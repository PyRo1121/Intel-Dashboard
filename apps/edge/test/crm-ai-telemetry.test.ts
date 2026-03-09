import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOwnerCrmAiTelemetryFailureResponse } from "../src/crm-ai-telemetry-proxy.ts";

describe("buildOwnerCrmAiTelemetryFailureResponse", () => {
  it("normalizes backend availability failures into a non-network-error payload", async () => {
    const response = buildOwnerCrmAiTelemetryFailureResponse("https://intel.pyro1121.com", {
      ok: false,
      status: 503,
      error: "AI telemetry query credentials are not configured.",
    });

    assert.equal(response.status, 200);
    const payload = await response.json() as { ok?: boolean; error?: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "AI telemetry query credentials are not configured.");
  });

  it("preserves non-availability failures as real API errors", async () => {
    const response = buildOwnerCrmAiTelemetryFailureResponse("https://intel.pyro1121.com", {
      ok: false,
      status: 400,
      error: "Invalid AI telemetry window.",
    });

    assert.equal(response.status, 400);
    const payload = await response.json() as { ok?: boolean; error?: string };
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "Invalid AI telemetry window.");
  });
});
