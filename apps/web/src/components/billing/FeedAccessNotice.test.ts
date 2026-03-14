import test from "node:test";
import assert from "node:assert/strict";
import { resolveFeedAccessNoticeAuth } from "./feed-access-notice-auth.ts";

test("resolveFeedAccessNoticeAuth falls back to anonymous entitlement state when auth context is missing", () => {
  const auth = resolveFeedAccessNoticeAuth(() => {
    throw new Error("missing auth provider");
  });

  assert.equal(auth.user(), null);
  assert.equal(auth.loading(), false);
});

test("resolveFeedAccessNoticeAuth preserves the real auth context when available", () => {
  const expected = {
    user: () => ({ login: "intelops", name: "Intel Ops", avatar_url: "", id: 1 }),
    loading: () => true,
    logout: () => {},
  };

  const auth = resolveFeedAccessNoticeAuth(() => expected);

  assert.equal(auth.user()?.login, "intelops");
  assert.equal(auth.loading(), true);
});
