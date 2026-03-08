import test from "node:test";
import assert from "node:assert/strict";
import { buildRobotsTxt, buildSitemapXml, PUBLIC_ROBOTS_DISALLOWS, PUBLIC_SITEMAP_ENTRIES } from "@intel-dashboard/shared/seo-assets.ts";

test("robots.txt is generated from shared disallow rules and sitemap origin", () => {
  const robots = buildRobotsTxt();

  assert.match(robots, /^User-agent: \*$/m);
  for (const path of PUBLIC_ROBOTS_DISALLOWS) {
    assert.match(robots, new RegExp(`^Disallow: ${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "m"));
  }
  assert.match(robots, /^Sitemap: https:\/\/intel\.pyro1121\.com\/sitemap\.xml$/m);
});

test("sitemap.xml is generated from shared route entries", () => {
  const lastmod = "2026-03-08T00:00:00.000Z";
  const sitemap = buildSitemapXml(lastmod);

  assert.match(sitemap, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  for (const { path, changefreq, priority } of PUBLIC_SITEMAP_ENTRIES) {
    assert.match(sitemap, new RegExp(`<loc>https://intel\\.pyro1121\\.com${path === "/" ? "/" : path}</loc>`));
    assert.match(sitemap, new RegExp(`<changefreq>${changefreq}</changefreq>`));
    assert.match(sitemap, new RegExp(`<priority>${priority}</priority>`));
  }
  assert.match(sitemap, new RegExp(`<lastmod>${lastmod}</lastmod>`));
});
