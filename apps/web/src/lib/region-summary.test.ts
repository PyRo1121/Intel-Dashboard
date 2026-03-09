import test from "node:test";
import assert from "node:assert/strict";
import { REGION_ORDER, buildRegionSummaries } from "./region-summary.ts";

test("buildRegionSummaries groups intel items by region and preserves region order", () => {
  const items = [
    {
      title: "Event 1",
      summary: "",
      source: "Source A",
      url: "https://example.com/1",
      timestamp: "2026-03-09T12:00:00.000Z",
      region: "ukraine" as const,
      category: "news" as const,
      severity: "critical" as const,
    },
    {
      title: "Event 2",
      summary: "",
      source: "Source B",
      url: "https://example.com/2",
      timestamp: "2026-03-09T11:00:00.000Z",
      region: "ukraine" as const,
      category: "news" as const,
      severity: "high" as const,
    },
    {
      title: "Event 3",
      summary: "",
      source: "Source C",
      url: "https://example.com/3",
      timestamp: "2026-03-09T10:00:00.000Z",
      region: "" as const,
      category: "news" as const,
      severity: "low" as const,
    },
  ];

  const summaries = buildRegionSummaries(items);
  assert.deepEqual(
    summaries.map((item) => item.region),
    REGION_ORDER,
  );

  const ukraine = summaries.find((item) => item.region === "ukraine");
  assert.deepEqual(ukraine, {
    region: "ukraine",
    eventCount: 2,
    critical: 1,
    high: 1,
    medium: 0,
    low: 0,
    topItems: items.slice(0, 2),
    lastUpdate: "2026-03-09T12:00:00.000Z",
  });

  const global = summaries.find((item) => item.region === "global");
  assert.equal(global?.eventCount, 1);
  assert.equal(global?.low, 1);
});
