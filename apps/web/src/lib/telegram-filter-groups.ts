import { hasUsefulImageText } from "./telegram-entry.ts";
import type { TelegramFilterGroup } from "./telegram-types.ts";

export const TELEGRAM_FILTER_GROUPS: TelegramFilterGroup[] = [
  { id: "all", label: "Show all" },
  { id: "ukraine", label: "Ukraine", categories: ["ua_official", "ua_osint", "ua_intel", "ua_frontline", "ua_journalism"] },
  { id: "russia", label: "Russia", categories: ["ru_official", "ru_milblog"] },
  { id: "middle-east", label: "Middle East", categories: ["israel_milblog", "iran_milblog", "syria_osint", "middle_east_osint"] },
  { id: "africa", label: "Africa", categories: ["sudan_conflict", "africa_osint"] },
  { id: "asia-pacific", label: "Asia-Pacific", categories: ["asia_pacific_osint", "south_asia_osint", "weibo_satellite"] },
  { id: "americas", label: "Americas", categories: ["latam_security", "cartel_osint", "south_america_osint"] },
  {
    id: "osint-cyber",
    label: "OSINT Cyber",
    categories: ["cyber", "global_osint", "en_osint", "nuclear_monitoring"],
  },
  {
    id: "official",
    label: "Official",
    categories: ["ua_official", "ru_official"],
  },
  { id: "analysis", label: "Analysis & OSINT", categories: ["global_osint", "en_analysis", "en_osint", "think_tank", "nato_tracking"] },
  {
    id: "media-heavy",
    label: "Media-heavy",
    predicate: (entry) => entry.message.media.length > 0 || hasUsefulImageText(entry.message.image_text_en),
  },
  {
    id: "strategic",
    label: "Air / Sea / Strategic",
    categories: ["naval", "air_defense", "satellite", "weapons", "mapping", "drone", "nuclear_monitoring"],
  },
  {
    id: "military",
    label: "Military Ops",
    categories: ["weapons", "mapping", "cyber", "naval", "air_defense", "casualties", "satellite", "drone", "foreign_vol", "nuclear_monitoring"],
  },
];

export const TELEGRAM_FILTER_GROUP_BY_ID = new Map(
  TELEGRAM_FILTER_GROUPS.map((group) => [group.id, group] as const),
);

export function resolveTelegramFilterGroup(id: string | null | undefined): TelegramFilterGroup {
  return (id ? TELEGRAM_FILTER_GROUP_BY_ID.get(id) : undefined) ?? TELEGRAM_FILTER_GROUPS[0];
}
