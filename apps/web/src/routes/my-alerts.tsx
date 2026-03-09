import { createResource, createSignal, For, Show } from "solid-js";
import { Link, Meta, Title } from "@solidjs/meta";
import { Bell, Clock, ExternalLink, MessageSquare, Radio } from "lucide-solid";
import type { SubscriberAlertState } from "@intel-dashboard/shared/subscriber-alerts.ts";
import { MY_ALERTS_DESCRIPTION, MY_ALERTS_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";
import { useAuth } from "~/lib/auth";
import { resolveAuthUserEntitlementView } from "~/lib/auth-user";
import { useWallClock } from "~/lib/live-refresh";
import { fetchSubscriberAlerts, markAllSubscriberAlertsRead, markSubscriberAlertsRead } from "~/lib/my-alerts-client";
import { formatRelativeTimeAt, isInitialResourceLoading } from "~/lib/utils";

const STATES: SubscriberAlertState[] = ["unread", "all"];

export default function MyAlertsPage() {
  const auth = useAuth();
  const entitlement = () => resolveAuthUserEntitlementView(auth.user());
  const entitled = () => entitlement().entitled;
  const [state, setState] = createSignal<SubscriberAlertState>("unread");
  const [busyId, setBusyId] = createSignal("");
  const [busyAll, setBusyAll] = createSignal(false);
  const nowMs = useWallClock(1000);

  const [alerts, { refetch }] = createResource(
    () => (entitled() ? state() : null),
    (nextState) => fetchSubscriberAlerts(nextState),
  );

  const items = () => alerts()?.items ?? [];
  const unreadCount = () => alerts()?.unreadCount ?? 0;
  const loadingInitial = () => isInitialResourceLoading(alerts.state, items().length);

  const markRead = async (alertId: string) => {
    setBusyId(alertId);
    try {
      if (await markSubscriberAlertsRead([alertId])) {
        await refetch();
      }
    } finally {
      setBusyId("");
    }
  };

  const markAll = async () => {
    setBusyAll(true);
    try {
      if (await markAllSubscriberAlertsRead()) {
        await refetch();
      }
    } finally {
      setBusyAll(false);
    }
  };

  return (
    <>
      <Title>{MY_ALERTS_TITLE}</Title>
      <Meta name="description" content={MY_ALERTS_DESCRIPTION} />
      <Link rel="canonical" href={siteUrl("/my-alerts")} />
      <Meta property="og:title" content={MY_ALERTS_TITLE} />
      <Meta property="og:description" content={MY_ALERTS_DESCRIPTION} />
      <Meta property="og:url" content={siteUrl("/my-alerts")} />

      <div class="intel-page">
        <header class="intel-page-header">
          <div>
            <div class="intel-badge mb-2">
              <Bell size={11} class="text-amber-300" />
              Subscriber Alerts
            </div>
            <h1 class="intel-heading">My Alerts</h1>
            <p class="intel-subheading">Important Telegram and OSINT matches derived from your watched regions and favorite sources.</p>
          </div>
        </header>

        <Show
          when={entitled()}
          fallback={
            <div class="surface-card p-10">
              <h2 class="text-lg font-semibold text-white">Subscriber access required</h2>
              <p class="mt-2 text-sm text-zinc-400">My Alerts is only available for owner and subscriber accounts.</p>
            </div>
          }
        >
          <section class="surface-card mb-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <div class="flex items-center gap-3">
              <span class="rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-200">
                Unread {unreadCount()}
              </span>
              <div class="flex flex-wrap gap-2">
                <For each={STATES}>
                  {(entryState) => (
                    <button
                      type="button"
                      aria-pressed={state() === entryState}
                      onClick={() => setState(entryState)}
                      class={`rounded-xl border px-3 py-1.5 text-[12px] ${state() === entryState ? "border-blue-400/40 bg-blue-500/15 text-blue-200" : "border-white/[0.08] bg-black/20 text-zinc-500"}`}
                    >
                      {entryState}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <button
              type="button"
              disabled={busyAll() || unreadCount() < 1}
              onClick={() => void markAll()}
              class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-sm text-zinc-300 disabled:opacity-50"
            >
              {busyAll() ? "Marking..." : "Mark all read"}
            </button>
          </section>

          <Show when={!loadingInitial()} fallback={<div class="surface-card p-6 text-sm text-zinc-400">Loading My Alerts...</div>}>
            <div class="space-y-2">
              <For each={items()}>
                {(item) => (
                  <article class="surface-card p-4">
                    <div class="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
                      <span class="rounded-full border border-white/[0.08] bg-black/20 px-2 py-0.5">
                        {item.sourceSurface === "telegram" ? <MessageSquare size={12} class="mr-1 inline" /> : <Radio size={12} class="mr-1 inline" />}
                        {item.sourceSurface}
                      </span>
                      <span class="rounded-full border border-amber-400/20 bg-amber-500/10 px-2 py-0.5 text-amber-200">{item.type}</span>
                      <Show when={item.signalGrade}>
                        <span class="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-violet-200">
                          {item.signalGrade} · {item.signalScore}
                        </span>
                      </Show>
                      <span class="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-200">{item.matchedPreference}</span>
                      <span class="text-zinc-500"><Clock size={12} class="mr-1 inline" />{formatRelativeTimeAt(item.createdAt, nowMs())}</span>
                    </div>
                    <h2 class="text-sm font-medium text-white">{item.title}</h2>
                    <p class="mt-1 text-[12px] text-zinc-400 line-clamp-2">{item.summary}</p>
                    <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                      <span>{item.sourceLabel}</span>
                      <span>·</span>
                      <span>{item.channelOrProvider}</span>
                      <span>·</span>
                      <span>{item.region || "global"}</span>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <a href={item.link} target="_blank" rel="noopener noreferrer" class="rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200 no-underline">
                        Open source <ExternalLink size={12} class="ml-1 inline" />
                      </a>
                      <Show when={!item.readAt}>
                        <button
                          type="button"
                          disabled={busyId() === item.id}
                          onClick={() => void markRead(item.id)}
                          class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-xs text-zinc-300 disabled:opacity-50"
                        >
                          {busyId() === item.id ? "Marking..." : "Mark read"}
                        </button>
                      </Show>
                    </div>
                  </article>
                )}
              </For>
              <Show when={items().length === 0}>
                <div class="surface-card p-6 text-sm text-zinc-400">No alerts match your current subscriber inbox filters yet.</div>
              </Show>
            </div>
          </Show>
        </Show>
      </div>
    </>
  );
}
