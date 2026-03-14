export type OsintSourceProfileSource = {
  id: string | null;
  slug: string;
  name: string;
  trustTier: "core" | "verified" | "watch";
  latencyTier: "instant" | "fast" | "monitor";
  sourceType: string;
  subscriberValueScore: number;
};

export type OsintSourceProfileSummary = {
  currentItemCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  regions: string[];
  categories: string[];
  verdict: "High-value rapid source" | "Reliable live source" | "Watch source";
};

export type OsintSourceProfileItem = {
  title: string;
  summary: string;
  url: string;
  timestamp: string;
  region: string;
  category: string;
  severity: string;
};

export type OsintSourceProfileOwnerDiagnostics = {
  acquisitionMethod?: string;
  scrapeRisk?: string;
  mediaCapability: string[];
  catalogTags: string[];
};

export type OsintSourceProfileResponse = {
  generatedAt: string;
  source: OsintSourceProfileSource;
  summary: OsintSourceProfileSummary;
  recentItems: OsintSourceProfileItem[];
  ownerDiagnostics?: OsintSourceProfileOwnerDiagnostics;
};

function normalizeSourceKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function buildOsintSourceSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveOsintSourcePreferenceAliases(source: {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
}): string[] {
  const aliases = new Set<string>();
  const id = normalizeSourceKey(source.id);
  const slug = normalizeSourceKey(source.slug) || buildOsintSourceSlug(source.name ?? "");
  const name = normalizeSourceKey(source.name);
  if (id) aliases.add(id);
  if (slug) aliases.add(slug);
  if (name) aliases.add(name);
  return [...aliases];
}

export function resolveOsintSourcePreferenceKey(source: {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
}): string {
  const aliases = resolveOsintSourcePreferenceAliases(source);
  return aliases[1] ?? aliases[0] ?? "";
}

export function matchesOsintSourcePreference(
  preferences: readonly string[] | null | undefined,
  source: {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
  },
): boolean {
  if (!preferences || preferences.length < 1) {
    return false;
  }
  const normalized = new Set(preferences.map((entry) => normalizeSourceKey(entry)).filter(Boolean));
  if (normalized.size < 1) {
    return false;
  }
  return resolveOsintSourcePreferenceAliases(source).some((alias) => normalized.has(alias));
}
