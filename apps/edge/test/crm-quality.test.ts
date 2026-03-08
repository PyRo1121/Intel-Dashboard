import test from "node:test";
import assert from "node:assert/strict";
import { summarizeCrmDataQuality } from "../src/crm-quality.ts";

test("summarizeCrmDataQuality calculates coverage and profile quality", () => {
  const result = summarizeCrmDataQuality({
    totalUsers: 4,
    trackedUsers: 3,
    users: [
      { name: "X Account", login: "xacct_abc123", avatarUrl: "", providers: ["x"] },
      { name: "Operator One", login: "operator1", avatarUrl: "https://img/a.png", providers: ["github"] },
      { name: "User", login: "user_fallback_42", avatarUrl: "", providers: [] },
      { name: "Intel Analyst", login: "intel_analyst", avatarUrl: "https://img/b.png", providers: ["x", "github"] },
    ],
  });

  assert.equal(result.untrackedUsers, 1);
  assert.equal(result.orphanTrackedUsers, 0);
  assert.equal(result.mappedBillingUsers, 3);
  assert.equal(result.missingAvatarUsers, 2);
  assert.equal(result.placeholderNameUsers, 2);
  assert.equal(result.syntheticLoginUsers, 2);
  assert.equal(result.providerCoveragePct, 75);
  assert.equal(result.billingCoveragePct, 75);
});

test("summarizeCrmDataQuality remains safe with empty totals and orphan billing", () => {
  const result = summarizeCrmDataQuality({
    totalUsers: 0,
    trackedUsers: 2,
    users: [],
  });

  assert.equal(result.untrackedUsers, 0);
  assert.equal(result.orphanTrackedUsers, 2);
  assert.equal(result.mappedBillingUsers, 0);
  assert.equal(result.missingAvatarUsers, 0);
  assert.equal(result.placeholderNameUsers, 0);
  assert.equal(result.syntheticLoginUsers, 0);
  assert.equal(result.providerCoveragePct, 0);
  assert.equal(result.billingCoveragePct, 0);
});
