import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeHtmlEntities,
  normalizeIntelItem,
  normalizeIntelSummary,
  sanitizeIntelText,
  trimSmart,
} from "./intel-text.ts";

test("decodeHtmlEntities handles named and numeric entities", () => {
  assert.equal(decodeHtmlEntities("Tom &amp; Jerry &#33; &#x1F680;"), "Tom & Jerry ! 🚀");
});

test("sanitizeIntelText decodes nested entities and strips tags", () => {
  assert.equal(
    sanitizeIntelText("&amp;lt;strong&amp;gt;Alert&amp;lt;/strong&amp;gt; &amp; update"),
    "Alert & update",
  );
});

test("trimSmart trims on word boundaries when possible", () => {
  assert.equal(trimSmart("alpha beta gamma delta", 14), "alpha beta...");
});

test("normalizeIntelSummary strips boilerplate and title duplication", () => {
  const title = "Strike update";
  const summary = normalizeIntelSummary(
    "Strike update - The post filing appeared first on Example. Latest Updates more text",
    title,
  );
  assert.equal(summary, "Example.");
});

test("normalizeIntelItem sanitizes title, source, and summary fields", () => {
  const item = normalizeIntelItem({
    title: "<b>Alert</b> &amp; update",
    summary: "Alert &amp; update: <i>details</i>",
    source: "Example&nbsp;Feed",
    url: "https://example.com",
    timestamp: "2026-03-09T12:00:00.000Z",
    region: "global",
    category: "news",
    severity: "high",
  });

  assert.equal(item.title, "Alert & update");
  assert.equal(item.source, "Example Feed");
  assert.equal(item.summary, "details");
});
