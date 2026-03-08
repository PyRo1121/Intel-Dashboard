import type { JSX } from "solid-js";
import { Show } from "solid-js";

interface StatCardProps {
  icon: JSX.Element;
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  accentColor?: "emerald" | "amber" | "red" | "blue" | "purple";
  delay?: number;
}

const ACCENT_MAP = {
  emerald: {
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-400",
    glow: "shadow-emerald-500/5",
  },
  amber: {
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-400",
    glow: "shadow-amber-500/5",
  },
  red: {
    iconBg: "bg-red-500/10",
    iconText: "text-red-400",
    glow: "shadow-red-500/5",
  },
  blue: {
    iconBg: "bg-blue-500/10",
    iconText: "text-blue-400",
    glow: "shadow-blue-500/5",
  },
  purple: {
    iconBg: "bg-cyan-500/10",
    iconText: "text-cyan-400",
    glow: "shadow-cyan-500/5",
  },
};

export default function StatCard(props: StatCardProps) {
  const accent = () => ACCENT_MAP[props.accentColor ?? "emerald"];

  return (
    <div
      class="surface-card surface-card-hover p-5 relative overflow-hidden group"
      style={`animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${(props.delay ?? 0) * 60}ms`}
    >
      {/* Subtle top accent line */}
      <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div class="flex items-start justify-between">
        <div class={`p-2.5 rounded-xl ${accent().iconBg} ${accent().iconText} transition-all duration-300 group-hover:scale-110`}>
          {props.icon}
        </div>
        <Show when={props.trend}>
          {(t) => (
            <span
              class={`text-xs font-semibold font-mono-data px-2 py-0.5 rounded-lg ${
                t().value >= 0
                  ? "text-emerald-400 bg-emerald-500/10"
                  : "text-red-400 bg-red-500/10"
              }`}
            >
              {t().value >= 0 ? "+" : ""}
              {t().value}% {t().label}
            </span>
          )}
        </Show>
      </div>
      <div class="mt-4">
        <p class="text-2xl font-bold font-mono-data text-[var(--color-text-primary)] tracking-tight">
          {props.value}
        </p>
        <p class="text-[12px] text-[var(--color-text-secondary)] mt-1 font-medium">
          {props.label}
        </p>
      </div>
    </div>
  );
}
