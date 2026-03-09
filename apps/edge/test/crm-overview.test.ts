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
  const result = payload.result as unknown as {
    generatedAtMs: number;
    degraded: unknown;
    directory: { untrackedUsers: number; orphanTrackedUsers: number };
    dataQuality: { billingCoveragePct: number };
  };
  assert.equal(result.generatedAtMs, 123);
  assert.deepEqual(
    result.degraded,
    {
      partial: false,
      stale: true,
      accountsTruncated: false,
      activityTruncated: false,
      reasons: ["summary_stale"],
    },
  );
  assert.equal(result.directory.untrackedUsers, 1);
  assert.equal(result.directory.orphanTrackedUsers, 0);
  assert.equal(result.dataQuality.billingCoveragePct, 66.67);
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

  const result = payload.result as unknown as {
    generatedAtMs: number;
    directory: { totalUsers: number; orphanTrackedUsers: number };
    dataQuality: { billingCoveragePct: number };
  };
  assert.equal(result.generatedAtMs, 456);
  assert.equal(result.directory.totalUsers, 2);
  assert.equal(result.directory.orphanTrackedUsers, 0);
  assert.equal(result.dataQuality.billingCoveragePct, 50);
});
