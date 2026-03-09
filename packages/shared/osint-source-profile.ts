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

