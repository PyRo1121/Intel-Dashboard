import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGatewayCacheKey, isGatewayTranslationEnabled } from "../src/translator.ts";

describe("isGatewayTranslationEnabled", () => {
  it("requires token, account id, and gateway name", () => {
    assert.equal(
      isGatewayTranslationEnabled({
        gatewayToken: "token",
        gatewayAccountId: "account",
        gatewayName: "gateway",
      }),
      true,
    );
    assert.equal(
      isGatewayTranslationEnabled({
        gatewayToken: "token",
        gatewayAccountId: "account",
      }),
      false,
    );
    assert.equal(
      isGatewayTranslationEnabled({
        gatewayToken: "token",
        gatewayName: "gateway",
      }),
      false,
    );
    assert.equal(
      isGatewayTranslationEnabled({
        gatewayAccountId: "account",
        gatewayName: "gateway",
      }),
      false,
    );
  });
});

describe("buildGatewayCacheKey", () => {
  it("builds stable sha256-based cache keys", async () => {
    const first = await buildGatewayCacheKey("text", "hello world");
    const second = await buildGatewayCacheKey("text", "hello   world");
    assert.equal(first, second);
    assert.match(first, /^telegram:text:\d+:[a-f0-9]{64}$/);
  });
});
