import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  selectStableTwitterFallbackIdentity,
  type StableTwitterFallbackRow,
} from "../src/auth-fallback-utils.ts";
import { buildDeterministicAvatarDataUrl } from "../src/avatar-fallback.ts";

describe("selectStableTwitterFallbackProfile", () => {
  it("reuses canonical non-synthetic identity when synthetic identities exist", () => {
    const profile = selectStableTwitterFallbackIdentity(
      [
        {
          accountId: "xid_deadbeef",
          userId: "u-synth-1",
          login: "x_deadbeef1234",
          name: "X User",
          image: null,
          updatedAtMs: Date.now() - 1_000,
        },
        {
          accountId: "xid_ownercanonical",
          userId: "u-owner",
          login: "PyRo1121",
          name: "PyRo1121",
          image: "https://pbs.twimg.com/profile_images/123/avatar_normal.jpg",
          updatedAtMs: Date.now(),
        },
      ] satisfies StableTwitterFallbackRow[],
      null,
    );

    assert.ok(profile);
    assert.equal(profile?.login, "PyRo1121");
    assert.equal(profile?.accountId, "xid_ownercanonical");
  });

  it("prefers hinted account/user id match when available", () => {
    const profile = selectStableTwitterFallbackIdentity(
      [
        {
          accountId: "xid_first",
          userId: "u-first",
          login: "AlphaUser",
          name: "AlphaUser",
          image: null,
          updatedAtMs: Date.now() - 10_000,
        },
        {
          accountId: "xid_target",
          userId: "u-target",
          login: "TargetUser",
          name: "TargetUser",
          image: null,
          updatedAtMs: Date.now() - 20_000,
        },
      ] satisfies StableTwitterFallbackRow[],
      "u-target",
    );

    assert.ok(profile);
    assert.equal(profile?.login, "TargetUser");
    assert.equal(profile?.accountId, "xid_target");
  });

  it("does not auto-fallback when multiple non-synthetic identities exist", () => {
    const profile = selectStableTwitterFallbackIdentity(
      [
        {
          accountId: "xid_a",
          userId: "u-a",
          login: "AnalystA",
          name: "Analyst A",
          image: null,
          updatedAtMs: Date.now() - 10_000,
        },
        {
          accountId: "xid_b",
          userId: "u-b",
          login: "AnalystB",
          name: "Analyst B",
          image: null,
          updatedAtMs: Date.now(),
        },
      ] satisfies StableTwitterFallbackRow[],
      null,
    );

    assert.equal(profile, null);
  });
});

describe("buildDeterministicAvatarDataUrl", () => {
  it("builds stable internal avatar data URLs", () => {
    const first = buildDeterministicAvatarDataUrl({
      login: "PyRo1121",
      name: "PyRo1121",
    });
    const second = buildDeterministicAvatarDataUrl({
      login: "PyRo1121",
      name: "PyRo1121",
    });

    assert.ok(first.startsWith("data:image/svg+xml;base64,"));
    assert.equal(first, second);
    assert.ok(first.length > 64);
  });
});
