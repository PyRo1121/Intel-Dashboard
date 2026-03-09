import { A } from "@solidjs/router";
import { Show } from "solid-js";
import { useAuth } from "~/lib/auth";
import { formatDelayMinutesShortLabel, UPGRADE_INSTANT_FEED_LABEL } from "@intel-dashboard/shared/access-offers.ts";
import {
  formatEntitlementLimit,
  resolveEntitlementView,
  resolveFeedSurfaceLimit,
} from "@intel-dashboard/shared/entitlement.ts";

export default function FeedAccessNotice(props: { surface: string }) {
  let auth: ReturnType<typeof useAuth>;
  try {
    auth = useAuth();
  } catch {
    return null;
  }

  const user = () => auth.user();
  const entitlement = () => user()?.entitlement;
  const entitlementView = () => resolveEntitlementView(entitlement());
  const limits = () => entitlement()?.limits;
  const primaryCap = () => resolveFeedSurfaceLimit(props.surface, limits());

  return (
    <Show when={!entitlementView().entitled}>
      <section class="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-emerald-500/10 px-4 py-3">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-300">
              {entitlementView().planLabel} Access
            </p>
            <p class="mt-1 text-sm text-zinc-200">
              {props.surface} feed is delayed by {formatDelayMinutesShortLabel(entitlementView().delayMinutes)} and capped at {formatEntitlementLimit(primaryCap())} visible items.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <A
              href="/billing"
              class="inline-flex min-h-10 items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/15 px-3 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
            >
              {UPGRADE_INSTANT_FEED_LABEL}
            </A>
          </div>
        </div>
      </section>
    </Show>
  );
}
