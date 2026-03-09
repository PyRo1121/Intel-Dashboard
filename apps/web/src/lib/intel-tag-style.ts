const INTEL_TAG_COLORS: Record<string, string> = {
  drone: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  missile: "bg-red-500/15 text-red-300 border-red-500/25",
  "air-defense": "bg-purple-500/15 text-purple-300 border-purple-500/25",
  "naval-major": "bg-indigo-500/15 text-indigo-300 border-indigo-500/25",
  strike: "bg-orange-500/15 text-orange-300 border-orange-500/25",
};

export function getIntelTagStyle(tag: string): string | null {
  return INTEL_TAG_COLORS[tag] ?? null;
}
