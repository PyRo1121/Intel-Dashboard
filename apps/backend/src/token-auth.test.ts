import { describe, expect, it } from "vitest";
import { matchesBearerToken, timingSafeStringEqual } from "./token-auth.js";

describe("token-auth", () => {
  it("matches only equal bearer tokens", () => {
    expect(matchesBearerToken("abc123", "abc123")).toBe(true);
    expect(matchesBearerToken("abc123", "abc124")).toBe(false);
    expect(matchesBearerToken(undefined, "abc123")).toBe(false);
    expect(matchesBearerToken("abc123", undefined)).toBe(false);
  });

  it("compares strings with exact length equality", () => {
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
    expect(timingSafeStringEqual("abc", "ab")).toBe(false);
    expect(timingSafeStringEqual("abc", "abd")).toBe(false);
  });
});
