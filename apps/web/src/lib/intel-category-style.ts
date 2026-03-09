export type IntelCategoryStyle = {
  bg: string;
  border: string;
  text: string;
};

const DEFAULT_STYLE: IntelCategoryStyle = {
  bg: "bg-zinc-500/10",
  border: "border-zinc-500/20",
  text: "text-zinc-300",
};

const CATEGORY_STYLES: Record<string, IntelCategoryStyle> = {
  ua_official: { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-300" },
  ua_osint: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-300" },
  ua_intel: { bg: "bg-sky-500/10", border: "border-sky-500/20", text: "text-sky-300" },
  ua_frontline: { bg: "bg-yellow-500/10", border: "border-yellow-500/20", text: "text-yellow-300" },
  ua_journalism: { bg: "bg-teal-500/10", border: "border-teal-500/20", text: "text-teal-300" },
  ru_official: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-300" },
  ru_milblog: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-300" },
  en_analysis: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-300" },
  en_osint: { bg: "bg-lime-500/10", border: "border-lime-500/20", text: "text-lime-300" },
  weapons: { bg: "bg-orange-500/10", border: "border-orange-500/20", text: "text-orange-300" },
  mapping: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-300" },
  cyber: { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-300" },
  naval: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-300" },
  air_defense: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-300" },
  casualties: { bg: "bg-stone-500/10", border: "border-stone-500/20", text: "text-stone-300" },
  satellite: { bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/20", text: "text-fuchsia-300" },
  drone: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-300" },
  foreign_vol: { bg: "bg-pink-500/10", border: "border-pink-500/20", text: "text-pink-300" },
  think_tank: { bg: "bg-slate-500/10", border: "border-slate-500/20", text: "text-slate-300" },
  israel_milblog: { bg: "bg-blue-400/10", border: "border-blue-400/20", text: "text-blue-200" },
  iran_milblog: { bg: "bg-emerald-600/10", border: "border-emerald-600/20", text: "text-emerald-200" },
  global_osint: { bg: "bg-zinc-400/10", border: "border-zinc-400/20", text: "text-zinc-200" },
  middle_east_osint: { bg: "bg-amber-600/10", border: "border-amber-600/20", text: "text-amber-200" },
  africa_osint: { bg: "bg-yellow-600/10", border: "border-yellow-600/20", text: "text-yellow-200" },
  asia_pacific_osint: { bg: "bg-sky-600/10", border: "border-sky-600/20", text: "text-sky-200" },
  latam_security: { bg: "bg-lime-600/10", border: "border-lime-600/20", text: "text-lime-200" },
  nato_tracking: { bg: "bg-blue-600/10", border: "border-blue-600/20", text: "text-blue-200" },
  nuclear_monitoring: { bg: "bg-red-600/10", border: "border-red-600/20", text: "text-red-200" },
  weibo_satellite: { bg: "bg-rose-600/10", border: "border-rose-600/20", text: "text-rose-200" },
  syria_osint: { bg: "bg-orange-600/10", border: "border-orange-600/20", text: "text-orange-200" },
  sudan_conflict: { bg: "bg-red-700/10", border: "border-red-700/20", text: "text-red-200" },
  south_asia_osint: { bg: "bg-teal-600/10", border: "border-teal-600/20", text: "text-teal-200" },
  cartel_osint: { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-200" },
  south_america_osint: { bg: "bg-lime-700/10", border: "border-lime-700/20", text: "text-lime-200" },
};

export function getIntelCategoryStyle(category: string): IntelCategoryStyle {
  return CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
}
