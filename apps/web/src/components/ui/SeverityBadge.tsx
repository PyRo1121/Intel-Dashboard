import type { Severity } from "~/lib/types";

const SEVERITY_STYLES: Record<string, { bg: string; dot: string }> = {
  critical: {
    bg: "bg-red-500/12 text-red-400 ring-1 ring-red-500/25",
    dot: "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.5)]",
  },
  high: {
    bg: "bg-amber-500/12 text-amber-400 ring-1 ring-amber-500/25",
    dot: "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]",
  },
  medium: {
    bg: "bg-blue-500/12 text-blue-400 ring-1 ring-blue-500/25",
    dot: "bg-blue-400",
  },
  low: {
    bg: "bg-zinc-500/12 text-zinc-400 ring-1 ring-zinc-500/25",
    dot: "bg-zinc-500",
  },
};

export default function SeverityBadge(props: { severity: Severity | "" }) {
  const style = () => SEVERITY_STYLES[props.severity] ?? SEVERITY_STYLES.low;

  return (
    <span
      class={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider ${style().bg}`}
    >
      <span class={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style().dot}`} />
      {props.severity || "unknown"}
    </span>
  );
}
