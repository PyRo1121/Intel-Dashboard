import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAiGatewayToken } from "../src/gateway-token.ts";

describe("resolveAiGatewayToken", () => {
  it("prefers explicit AI gateway token", () => {
    const token = resolveAiGatewayToken({
      AI_GATEWAY_TOKEN: " gateway-token ",
      CF_API_TOKEN: "cf-token",
      ALLOW_CF_API_TOKEN_AS_AIG: "true",
    });
    assert.equal(token, "gateway-token");
  });

  it("does not fall back to CF API token by default", () => {
    const token = resolveAiGatewayToken({
      AI_GATEWAY_TOKEN: "",
      CF_API_TOKEN: "cf-token",
      ALLOW_CF_API_TOKEN_AS_AIG: "false",
    });
    assert.equal(token, undefined);
  });

  it("supports explicit fallback opt-in for legacy environments", () => {
    const token = resolveAiGatewayToken({
      AI_GATEWAY_TOKEN: "   ",
      CF_API_TOKEN: " cf-token ",
      ALLOW_CF_API_TOKEN_AS_AIG: "1",
    });
    assert.equal(token, "cf-token");
  });
});
