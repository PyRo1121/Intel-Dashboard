import type {
  OsintSourceProfileItem,
  OsintSourceProfileOwnerDiagnostics,
  OsintSourceProfileResponse,
  OsintSourceProfileSource,
  OsintSourceProfileSummary,
} from "@intel-dashboard/shared/osint-source-profile.ts";

type IntelItemLike = {
  title: string;
  summary: string;
  source: string;
  url: string;
  timestamp: string;
  region: string;
  category: string;
  severity: string;
};

type OsintCatalogSourceLike = {
  id?: string;
  name?: string;
  trustTier?: string;
  latencyTier?: string;
  sourceType?: string;
  subscriberValueScore?: number;
  acquisitionMethod?: string;
  scrapeRisk?: string;
  mediaCapability?: string[];
  tags?: string[];
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeTier<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function normalizeScore(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0;
}

function summarizeVerdict(summary: {
  subscriberValueScore: number;
  criticalCount: number;
  highCount: number;
}): OsintSourceProfileSummary["verdict"] {
  if (summary.subscriberValueScore >= 86 || summary.criticalCount >= 1) {
    return "High-value rapid source";
  }
  if (summary.subscriberValueScore >= 72 || summary.highCount >= 2) {
    return "Reliable live source";
  }
  return "Watch source";
}

export function buildOsintSourceSlug(value: string): string {
  return normalizeSlug(value);
}

export function normalizeOsintSourceProfile(args: {
  providerSlug: string;
  items: IntelItemLike[];
  sourceMeta?: OsintCatalogSourceLike | null;
  owner: boolean;
  nowMs?: number;
}): OsintSourceProfileResponse | null {
  const sourceName =
    normalizeString(args.sourceMeta?.name) ||
    normalizeString(args.items[0]?.source) ||
    "";
  if (!sourceName) return null;

  const matchingItems = args.items.filter((item) => buildOsintSourceSlug(normalizeString(item.source)) === args.providerSlug);
  if (matchingItems.length < 1) return null;

  const criticalCount = matchingItems.filter((item) => normalizeString(item.severity) === "critical").length;
  const highCount = matchingItems.filter((item) => normalizeString(item.severity) === "high").length;
  const mediumCount = matchingItems.filter((item) => normalizeString(item.severity) === "medium").length;
  const lowCount = matchingItems.filter((item) => normalizeString(item.severity) === "low").length;
  const regions = Array.from(new Set(matchingItems.map((item) => normalizeString(item.region)).filter(Boolean))).slice(0, 8);
  const categories = Array.from(new Set(matchingItems.map((item) => normalizeString(item.category)).filter(Boolean))).slice(0, 8);

  const source: OsintSourceProfileSource = {
    id: normalizeString(args.sourceMeta?.id) || null,
    slug: args.providerSlug,
    name: sourceName,
    trustTier: normalizeTier(args.sourceMeta?.trustTier, ["core", "verified", "watch"] as const, "watch"),
    latencyTier: normalizeTier(args.sourceMeta?.latencyTier, ["instant", "fast", "monitor"] as const, "monitor"),
    sourceType: normalizeString(args.sourceMeta?.sourceType) || "unknown",
    subscriberValueScore: normalizeScore(args.sourceMeta?.subscriberValueScore),
  };

  const summary: OsintSourceProfileSummary = {
    currentItemCount: matchingItems.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    regions,
    categories,
    verdict: summarizeVerdict({
      subscriberValueScore: source.subscriberValueScore,
      criticalCount,
      highCount,
    }),
  };

  const recentItems: OsintSourceProfileItem[] = [...matchingItems]
    .sort((left, right) => Date.parse(right.timestamp || "") - Date.parse(left.timestamp || ""))
    .slice(0, 20)
    .map((item) => ({
      title: normalizeString(item.title),
      summary: normalizeString(item.summary),
      url: normalizeString(item.url),
      timestamp: normalizeString(item.timestamp),
      region: normalizeString(item.region),
      category: normalizeString(item.category),
      severity: normalizeString(item.severity),
    }));

  let ownerDiagnostics: OsintSourceProfileOwnerDiagnostics | undefined;
  if (args.owner) {
    ownerDiagnostics = {
      acquisitionMethod: normalizeString(args.sourceMeta?.acquisitionMethod) || undefined,
      scrapeRisk: normalizeString(args.sourceMeta?.scrapeRisk) || undefined,
      mediaCapability: Array.isArray(args.sourceMeta?.mediaCapability)
        ? args.sourceMeta.mediaCapability.filter((value): value is string => typeof value === "string")
        : [],
      catalogTags: Array.isArray(args.sourceMeta?.tags)
        ? args.sourceMeta.tags.filter((value): value is string => typeof value === "string")
        : [],
    };
  }

  return {
    generatedAt: new Date(args.nowMs ?? Date.now()).toISOString(),
    source,
    summary,
    recentItems,
    ...(ownerDiagnostics ? { ownerDiagnostics } : {}),
  };
}
