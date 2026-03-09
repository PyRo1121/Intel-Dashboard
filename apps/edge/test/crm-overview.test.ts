import test from "node:test";
import assert from "node:assert/strict";
import { buildOwnerCrmOverviewPayload } from "../src/crm-overview.ts";

test("buildOwnerCrmOverviewPayload preserves backend degraded state while adding directory quality", () => {
  const payload = buildOwnerCrmOverviewPayload({
    directory: {
      totalUsers: 3,
      activeSessions: 1,
      newUsers24h: 1,
      newUsers7d: 2,
      users: [
        {
          id: "u-1",
          login: "owner",
          name: "Owner",
          email: "owner@example.com",
          avatarUrl: "",
          providers: ["github"],
          createdAtMs: 10,
          updatedAtMs: 20,
        },
        {
          id: "u-2",
          login: "analyst",
          name: "Analyst",
          email: "analyst@example.com",
          avatarUrl: "",
          providers: [],
          createdAtMs: 10,
          updatedAtMs: 20,
        },
        {
          id: "u-3",
          login: "intel_bot",
          name: "X Account",
          email: "bot@example.com",
          avatarUrl: "",
          providers: ["x"],
          createdAtMs: 10,
          updatedAtMs: 20,
        },
      ],
    },
    backendSummary: {
      generatedAtMs: 123,
      degraded: {
        partial: false,
        stale: true,
        accountsTruncated: false,
        activityTruncated: false,
        reasons: ["summary_stale"],
      },
      billing: {
        trackedUsers: 2,
      },
    },
  });

  assert.equal(payload.ok, true);
  assert.equal((payload.result as { generatedAtMs: number }).generatedAtMs, 123);
  assert.deepEqual(
    (payload.result as { degraded: unknown }).degraded,
    {
      partial: false,
      stale: true,
      accountsTruncated: false,
      activityTruncated: false,
      reasons: ["summary_stale"],
    },
  );
  assert.equal((payload.result as { directory: { untrackedUsers: number } }).directory.untrackedUsers, 1);
  assert.equal((payload.result as { directory: { orphanTrackedUsers: number } }).directory.orphanTrackedUsers, 0);
  assert.equal((payload.result as { dataQuality: { billingCoveragePct: number } }).dataQuality.billingCoveragePct, 66.67);
});

test("buildOwnerCrmOverviewPayload keeps edge-derived directory and data quality authoritative", () => {
  const payload = buildOwnerCrmOverviewPayload({
    directory: {
      totalUsers: 2,
      activeSessions: 1,
      newUsers24h: 1,
      newUsers7d: 1,
      users: [
        {
          id: "u-1",
          login: "owner",
          name: "Owner",
          email: "owner@example.com",
          avatarUrl: "",
          providers: ["github"],
          createdAtMs: 10,
          updatedAtMs: 20,
        },
      ],
    },
    backendSummary: {
      generatedAtMs: 456,
      directory: {
        totalUsers: 999,
        orphanTrackedUsers: 999,
      },
      dataQuality: {
        billingCoveragePct: 0,
      },
      billing: {
        trackedUsers: 1,
      },
    },
  });

  assert.equal((payload.result as { generatedAtMs: number }).generatedAtMs, 456);
  assert.equal((payload.result as { directory: { totalUsers: number } }).directory.totalUsers, 2);
  assert.equal((payload.result as { directory: { orphanTrackedUsers: number } }).directory.orphanTrackedUsers, 0);
  assert.equal((payload.result as { dataQuality: { billingCoveragePct: number } }).dataQuality.billingCoveragePct, 50);
});
