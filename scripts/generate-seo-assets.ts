import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRobotsTxt, buildSitemapXml } from "@intel-dashboard/shared/seo-assets.ts";

const rootDir = path.resolve(import.meta.dirname, "..");
const publicDir = path.join(rootDir, "apps", "web", "public");
const now = new Date().toISOString();

await mkdir(publicDir, { recursive: true });
await writeFile(path.join(publicDir, "robots.txt"), buildRobotsTxt(), "utf8");
await writeFile(path.join(publicDir, "sitemap.xml"), buildSitemapXml(now), "utf8");
