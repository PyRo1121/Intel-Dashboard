import { describe, expect, it } from "vitest";
import { isFastLaneOsintSource, splitOsintFeedSources } from "./osint-fast-lane.js";
import type { OsintSource } from "./osint-sources.js";

const baseSource: OsintSource = {
  id: "base",
  name: "Base",
  category: "newsroom",
  description: "base",
  url: "https://example.com",
  feedUrl: "https://example.com/rss.xml",
  region: "global",
  language: "en",
  reliability: "high",
  tags: [],
  acquisitionMethod: "rss",
  trustTier: "verified",
  latencyTier: "fast",
  sourceType: "newsroom",
  mediaCapability: ["text"],
  scrapeRisk: "low",
  subscriberValueScore: 82,
};

describe("OSINT fast lane", () => {
  it("includes explicit priority feeds", () => {
    expect(isFastLaneOsintSource(baseSource, new Set(["base"]))).toBe(true);
  });

  it("includes instant feeds and strong core feeds", () => {
    expect(
      isFastLaneOsintSource({ ...baseSource, id: "instant", latencyTier: "instant" }, new Set()),
    ).toBe(true);
    expect(
      isFastLaneOsintSource(
        { ...baseSource, id: "core", trustTier: "core", subscriberValueScore: 90 },
        new Set(),
      ),
    ).toBe(true);
  });

  it("splits feed sources into fast lane and rotating groups", () => {
    const fast: OsintSource = { ...baseSource, id: "fast", latencyTier: "instant" };
    const rotating: OsintSource = {
      ...baseSource,
      id: "rotate",
      latencyTier: "monitor",
      trustTier: "watch",
      subscriberValueScore: 68,
    };
    const split = splitOsintFeedSources([fast, rotating], new Set());
    expect(split.fastLane.map((item) => item.id)).toEqual(["fast"]);
    expect(split.rotating.map((item) => item.id)).toEqual(["rotate"]);
  });
});
