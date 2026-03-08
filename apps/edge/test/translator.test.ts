import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGatewayCacheKey,
  estimateImageTranslationMaxTokens,
  estimateTranslationMaxTokens,
  isGatewayTranslationEnabled,
} from "../src/translator.ts";

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

describe("translation token budgets", () => {
  it("keeps plain-text translation budgets compact for short strings and bounded for long ones", () => {
    assert.equal(estimateTranslationMaxTokens("Hello world"), 48);
    assert.ok(estimateTranslationMaxTokens("x".repeat(2500)) <= 800);
    assert.ok(estimateTranslationMaxTokens("x".repeat(2500)) >= 600);
  });

  it("keeps image OCR budgets bounded even with long context", () => {
    assert.equal(estimateImageTranslationMaxTokens(""), 96);
    assert.ok(estimateImageTranslationMaxTokens("x".repeat(2500)) <= 480);
  });
});
