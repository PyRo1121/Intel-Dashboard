import { siteUrl } from "./site-config.ts";

export type SitemapEntry = {
  path: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
};

export const PUBLIC_SITEMAP_ENTRIES: readonly SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/overview", changefreq: "hourly", priority: "0.8" },
  { path: "/osint", changefreq: "hourly", priority: "0.9" },
  { path: "/telegram", changefreq: "hourly", priority: "0.9" },
  { path: "/map", changefreq: "hourly", priority: "0.8" },
  { path: "/air-sea", changefreq: "hourly", priority: "0.8" },
  { path: "/briefings", changefreq: "hourly", priority: "0.7" },
] as const;

export const PUBLIC_ROBOTS_DISALLOWS: readonly string[] = [
  "/api/",
  "/auth/",
  "/oauth/",
  "/login",
  "/signup",
  "/chat-history",
] as const;

export function buildRobotsTxt(): string {
  return [
    "User-agent: *",
    "Allow: /",
    ...PUBLIC_ROBOTS_DISALLOWS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${siteUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
}

export function buildSitemapXml(lastmod: string): string {
  const entries = PUBLIC_SITEMAP_ENTRIES.map(
    ({ path, changefreq, priority }) => `  <url>\n    <loc>${siteUrl(path)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}
