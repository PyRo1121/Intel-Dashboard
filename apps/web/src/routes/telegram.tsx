import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import { Title, Meta, Link } from "@solidjs/meta";
import { Clock, Image, LoaderCircle, MessageSquare, Radio, Video } from "lucide-solid";
import TelegramMessageCard from "~/components/telegram/TelegramMessageCard";
import {
  freshnessBannerTone,
  freshnessPillTone,
  freshnessTooltip,
  STANDARD_FEED_FRESHNESS_THRESHOLDS,
  useFeedFreshness,
} from "~/lib/freshness";
import { fastHash } from "~/lib/telegram-dedupe";
import { dedupeTelegramEntries } from "~/lib/telegram-dedupe-run";
import { TELEGRAM_FILTER_GROUP_BY_ID, TELEGRAM_FILTER_GROUPS } from "~/lib/telegram-filter-groups";
import {
  doesTelegramGroupMatchEntry,
  getTelegramEntryKey,
  getTelegramEntrySourceSignatures,
  toTelegramSafeDomId,
} from "~/lib/telegram-entry-meta";
import {
  isVerifiedEntry,
  messageText,
} from "~/lib/telegram-entry";
import { useLiveRefresh, useWallClock } from "~/lib/live-refresh";
import { getLatestTelegramMessageTimestamp, sortTelegramChannelsByMessageTime } from "~/lib/telegram-feed";
import { fetchTelegramDedupeFeedbackStatus, fetchTelegramFeed, postTelegramDedupeFeedback } from "~/lib/telegram-client";
import { reconcileTelegramData } from "~/lib/telegram-reconcile";
import type {
  TelegramAgeWindow as AgeWindow,
  TelegramCanonicalEvent,
  TelegramData,
  TelegramEntry,
  TelegramFeedMode as FeedMode,
  TelegramMessage,
} from "~/lib/telegram-types";
import { isTelegramMessageVisible } from "~/lib/telegram-visibility";
import { parseTimestampMs as parseTs } from "~/lib/utils";
import FeedAccessNotice from "~/components/billing/FeedAccessNotice";
import { TELEGRAM_DESCRIPTION, TELEGRAM_TITLE } from "@intel-dashboard/shared/route-meta.ts";
import { siteUrl } from "@intel-dashboard/shared/site-config.ts";

export default function TelegramPage() {
  const [data, setData] = createSignal<TelegramData | null>(null);
  const [loadingInitial, setLoadingInitial] = createSignal(true);
  const [refreshing, setRefreshing] = createSignal(false);
  const clockNow = useWallClock(1000);
  const [groupFilter, setGroupFilter] = createSignal("all");
  const [ageWindow, setAgeWindow] = createSignal<AgeWindow>("all");
  const [feedMode, setFeedMode] = createSignal<FeedMode>("deduped");
  const [mediaOnly, setMediaOnly] = createSignal(false);
  const [focusKey, setFocusKey] = createSignal("");
  const [ownerDedupeEnabled, setOwnerDedupeEnabled] = createSignal(false);
  const [dedupeFeedbackCount, setDedupeFeedbackCount] = createSignal(0);
  const [selectedClusterKeys, setSelectedClusterKeys] = createSignal<string[]>([]);
  const [adminBusy, setAdminBusy] = createSignal(false);
  const [adminStatus, setAdminStatus] = createSignal("");
  const [streamConnected, setStreamConnected] = createSignal(false);
  const feedThresholds = STANDARD_FEED_FRESHNESS_THRESHOLDS;
  let lastTimestamp = "";

  const refreshDedupeFeedbackStatus = async (): Promise<void> => {
    const status = await fetchTelegramDedupeFeedbackStatus(AbortSignal.timeout(8_000));
    if (!status) {
      return;
    }
    setOwnerDedupeEnabled(status.ownerEnabled);
    setDedupeFeedbackCount(status.count);
  };

  const refreshTelegram = async (): Promise<boolean> => {
    if (refreshing()) return false;
    setRefreshing(true);
    try {
      const next = await fetchTelegramFeed<TelegramData>(AbortSignal.timeout(15_000));
      if (!next) return false;

      const prev = data();
      if (prev) {
        const prevSnapshotTs = parseTs(prev.timestamp);
        const nextSnapshotTs = parseTs(next.timestamp);
        if (
          (prevSnapshotTs > 0 && nextSnapshotTs > 0 && nextSnapshotTs < prevSnapshotTs) ||
          (prevSnapshotTs > 0 && nextSnapshotTs <= 0)
        ) {
          return false;
        }
      }
      const merged = prev ? reconcileTelegramData(prev, next) : next;
      const changed = !prev || next.timestamp !== lastTimestamp || next.total_messages !== prev.total_messages;
      if (changed) {
        setData(merged);
        lastTimestamp = next.timestamp;
      }
      return changed;
    } catch {
      return false;
    } finally {
      setRefreshing(false);
      if (loadingInitial()) setLoadingInitial(false);
    }
  };

  onMount(() => {
    const focus = new URL(window.location.href).searchParams.get("focus");
    if (focus) {
      setFocusKey(focus);
      setGroupFilter("all");
    }
    void refreshTelegram();
    void refreshDedupeFeedbackStatus();

    if (typeof window !== "undefined") {
      let socket: WebSocket | null = null;
      let reconnectTimer: number | null = null;
      let reconnectDelayMs = 2_000;
      let closed = false;

      const clearReconnect = () => {
        if (reconnectTimer !== null) {
          window.clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
      };

      const scheduleReconnect = () => {
        if (closed) return;
        clearReconnect();
        reconnectTimer = window.setTimeout(() => {
          connect();
        }, reconnectDelayMs);
        reconnectDelayMs = Math.min(30_000, Math.floor(reconnectDelayMs * 1.6));
      };

      const connect = () => {
        clearReconnect();
        try {
          const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
          socket = new WebSocket(`${protocol}//${window.location.host}/api/telegram/stream`);
        } catch {
          setStreamConnected(false);
          scheduleReconnect();
          return;
        }

        socket.addEventListener("open", () => {
          setStreamConnected(true);
          reconnectDelayMs = 2_000;
          try {
            socket?.send("state");
          } catch {
            // best effort
          }
        });

        socket.addEventListener("message", (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as { type?: string; timestamp?: string | null };
            if (payload.type === "state_updated" || payload.type === "state" || payload.type === "hello") {
              if (payload.timestamp && payload.timestamp !== lastTimestamp) {
                void refreshTelegram();
              }
            }
          } catch {
            // ignore malformed stream events
          }
        });

        socket.addEventListener("close", () => {
          setStreamConnected(false);
          scheduleReconnect();
        });

        socket.addEventListener("error", () => {
          setStreamConnected(false);
          try {
            socket?.close();
          } catch {
            // ignore
          }
        });
      };

      connect();

      onCleanup(() => {
        closed = true;
        clearReconnect();
        setStreamConnected(false);
        try {
          socket?.close();
        } catch {
          // ignore close errors
        }
      });
    }
  });

  useLiveRefresh(refreshTelegram, 60_000, { runImmediately: false, jitterRatio: 0.15 });

  const categories = () => data()?.categories ?? {};
  const channels = () => data()?.channels ?? [];
  const timestamp = () => data()?.timestamp ?? "";

  const normalizedChannels = createMemo(() => sortTelegramChannelsByMessageTime(channels()));
  const latestMessageTimestamp = createMemo(() => getLatestTelegramMessageTimestamp(normalizedChannels()));

  const latestFeedTs = createMemo(() => latestMessageTimestamp() || parseTs(timestamp()));
  const freshness = useFeedFreshness({
    nowMs: clockNow,
    latestTimestampMs: latestFeedTs,
    thresholds: feedThresholds,
    subject: "Telegram feed",
    labels: {
      noData: "No recent data",
      live: "Live flow",
      delayed: "Delayed",
      stale: "Stale feed",
    },
  });

  const mergeDuplicates = createMemo(() => feedMode() !== "raw");
  const verifiedOnly = createMemo(() => feedMode() === "verified");

  const rawEntries = createMemo<TelegramEntry[]>((prev) => {
    const previous = prev ?? [];
    const prevMap = new Map(previous.map((entry) => [getTelegramEntryKey(entry), entry]));
    const out: TelegramEntry[] = [];

    for (const channel of normalizedChannels()) {
      for (const msg of channel.messages) {
        if (!isTelegramMessageVisible({ message: msg, ageWindow: ageWindow(), mediaOnly: mediaOnly(), nowMs: clockNow() })) continue;
        const key = msg.link || `${channel.category}:${msg.datetime}:${msg.text_original.slice(0, 48)}`;
        const existing = prevMap.get(key);
        if (existing && existing.message === msg && existing.category === channel.category) {
          out.push(existing);
        } else {
          out.push({
            category: channel.category,
            channelLabel: channel.label || channel.username || "Telegram source",
            channelUsername: channel.username || "",
            message: msg,
          });
        }
      }
    }

    out.sort((a, b) => parseTs(b.message.datetime) - parseTs(a.message.datetime));
    return out;
  }, []);

  const entries = createMemo<TelegramEntry[]>(() => {
    const snapshot = data();
    if (mergeDuplicates() && Array.isArray(snapshot?.canonical_events) && snapshot.canonical_events.length > 0) {
      const canonicalEntries: TelegramEntry[] = [];
      for (const event of snapshot.canonical_events) {
        const message: TelegramMessage = {
          text_original: event.text_original || event.text_en || "",
          text_en: event.text_en || event.text_original || "",
          image_text_en: event.image_text_en || "",
          datetime: event.datetime,
          link: event.sources?.[0]?.link || "",
          views: event.sources?.[0]?.views || "",
          media: Array.isArray(event.media) ? event.media : [],
          has_video: Boolean(event.has_video),
          has_photo: Boolean(event.has_photo),
          language: event.language || "unknown",
        };
        if (!isTelegramMessageVisible({ message, ageWindow: ageWindow(), mediaOnly: mediaOnly(), nowMs: clockNow() })) continue;
        canonicalEntries.push({
          category: event.category,
          channelLabel: event.source_labels?.[0] || event.sources?.[0]?.label || "Telegram source",
          channelUsername: event.source_channels?.[0] || event.sources?.[0]?.channel || "",
          message,
          dedupe: {
            clusterKey: event.event_key || event.event_id,
            sourceCount: Math.max(1, Number(event.source_count) || 1),
            duplicateCount: Math.max(0, Number(event.duplicate_count) || 0),
            sourceLabels: Array.isArray(event.source_labels) ? event.source_labels : [],
            categorySet: Array.isArray(event.categories) ? event.categories : [event.category],
            domainTags: Array.isArray(event.domain_tags) ? event.domain_tags : [],
            trustTier: event.trust_tier,
            latencyTier: event.latency_tier,
            sourceType: event.source_type,
            acquisitionMethod: event.acquisition_method,
            subscriberValueScore: typeof event.subscriber_value_score === "number" ? event.subscriber_value_score : undefined,
            freshnessTier: event.freshness_tier,
            verificationState: event.verification_state,
            rankScore: typeof event.rank_score === "number" ? event.rank_score : undefined,
            sources: Array.isArray(event.sources) ? event.sources : [],
            sourceSignatures: Array.isArray(event.sources)
              ? event.sources
                .map((source) => source?.signature)
                .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
              : [],
          },
        });
      }
      canonicalEntries.sort((left, right) => parseTs(right.message.datetime) - parseTs(left.message.datetime));
      return canonicalEntries;
    }

    const base = rawEntries();
    return mergeDuplicates() ? dedupeTelegramEntries(base) : base;
  });

  const dedupeSavedCount = createMemo(() => Math.max(0, rawEntries().length - entries().length));

  const categoryCounts = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries()) {
      const categoriesForCount = entry.dedupe?.categorySet?.length
        ? entry.dedupe.categorySet
        : [entry.category];
      for (const category of categoriesForCount) {
        counts[category] = (counts[category] || 0) + 1;
      }
    }
    return counts;
  });

  const groupCounts = createMemo(() => {
    const counts: Record<string, number> = {};
    for (const group of TELEGRAM_FILTER_GROUPS) {
      if (group.id === "all") {
        counts[group.id] = entries().length;
        continue;
      }
      counts[group.id] = entries().filter((entry) => doesTelegramGroupMatchEntry(group, entry)).length;
    }
    return counts;
  });

  const activeFilterGroups = createMemo(() => {
    return TELEGRAM_FILTER_GROUPS.filter((group) => group.id === "all" || (groupCounts()[group.id] || 0) > 0);
  });

  const filteredEntries = createMemo(() => {
    const activeGroupId = groupFilter();
    const group = TELEGRAM_FILTER_GROUP_BY_ID.get(activeGroupId) ?? TELEGRAM_FILTER_GROUPS[0];
    return entries().filter((entry) => {
      if (activeGroupId !== "all" && !doesTelegramGroupMatchEntry(group, entry)) {
        return false;
      }
      if (verifiedOnly() && !isVerifiedEntry(entry)) {
        return false;
      }
      return true;
    });
  });

  const activeGroup = createMemo(() => TELEGRAM_FILTER_GROUP_BY_ID.get(groupFilter()) ?? TELEGRAM_FILTER_GROUPS[0]);
  const activeGroupCount = createMemo(() => {
    return TELEGRAM_FILTER_GROUPS.filter((group) => group.id !== "all" && (groupCounts()[group.id] || 0) > 0).length;
  });
  const verifiedCount = createMemo(() => entries().filter((entry) => isVerifiedEntry(entry)).length);
  const mediaCount = createMemo(() => entries().filter((entry) => entry.message.media.length > 0).length);
  const selectedSignatures = createMemo(() => {
    const map = new Map(filteredEntries().map((entry) => [entry.dedupe?.clusterKey ?? "", entry] as const));
    const signatureSet = new Set<string>();
    for (const key of selectedClusterKeys()) {
      const entry = map.get(key);
      if (!entry) continue;
      for (const signature of getTelegramEntrySourceSignatures(entry)) {
        signatureSet.add(signature);
      }
    }
    return Array.from(signatureSet);
  });
  const showCategoryPill = createMemo(() => {
    if (groupFilter() === "all") return true;
    return (activeGroup().categories?.length ?? 0) > 1;
  });

  createEffect(() => {
    if (!mergeDuplicates()) {
      setSelectedClusterKeys([]);
      return;
    }
    const visibleKeys = new Set(
      filteredEntries()
        .map((entry) => entry.dedupe?.clusterKey ?? "")
        .filter((value) => value.length > 0),
    );
    setSelectedClusterKeys((prev) => prev.filter((key) => visibleKeys.has(key)));
  });

  const toggleClusterSelection = (entry: TelegramEntry) => {
    const clusterKey = entry.dedupe?.clusterKey ?? "";
    if (!clusterKey || getTelegramEntrySourceSignatures(entry).length === 0) return;
    setSelectedClusterKeys((prev) => {
      if (prev.includes(clusterKey)) {
        return prev.filter((value) => value !== clusterKey);
      }
      return [...prev, clusterKey];
    });
  };

  const applyDedupeFeedback = async (args: { action: "merge" | "split" | "clear"; signatures: string[]; targetCluster?: string }) => {
    if (args.signatures.length === 0 || adminBusy()) return;
    setAdminBusy(true);
    setAdminStatus("");
    try {
      const result = await postTelegramDedupeFeedback(args);
      if (!result.ok) {
        setAdminStatus(`Dedupe action failed (${result.status ?? "?"}) ${result.error.slice(0, 120)}`);
        return;
      }
      setAdminStatus(`${args.action} applied to ${args.signatures.length} signatures`);
      setSelectedClusterKeys([]);
      await refreshDedupeFeedbackStatus();
      await refreshTelegram();
    } catch {
      setAdminStatus("Dedupe action failed due to network/runtime error");
    } finally {
      setAdminBusy(false);
    }
  };

  const mergeSelectedClusters = async () => {
    const signatures = selectedSignatures();
    if (signatures.length < 2) {
      setAdminStatus("Select at least 2 source signatures to merge.");
      return;
    }
    const clusterSeed = selectedClusterKeys().sort().join("|");
    const targetCluster = `owner_manual_${fastHash(clusterSeed)}_${Math.floor(Date.now() / 1000)}`;
    await applyDedupeFeedback({ action: "merge", signatures, targetCluster });
  };

  const splitCluster = async (entry: TelegramEntry) => {
    const signatures = getTelegramEntrySourceSignatures(entry);
    await applyDedupeFeedback({ action: "split", signatures });
  };

  const clearClusterRule = async (entry: TelegramEntry) => {
    const signatures = getTelegramEntrySourceSignatures(entry);
    await applyDedupeFeedback({ action: "clear", signatures });
  };

  createEffect(() => {
    const key = focusKey();
    if (!key || filteredEntries().length === 0) return;
    const node = document.getElementById(`msg-${toTelegramSafeDomId(key)}`);
    if (!node) return;
    window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  const shareFromSite = async (entry: TelegramEntry) => {
    const target = new URL(window.location.href);
    target.searchParams.set("focus", getTelegramEntryKey(entry));
    const shareUrl = target.toString();
    const shareTitle = `${entry.channelLabel} intel update`;
    const shareText = messageText(entry.message).slice(0, 160);
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch {
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
    }
  };

  const showInitialLoading = () => loadingInitial() && !data();
  const showEmpty = () => !showInitialLoading() && filteredEntries().length === 0;

  return (
    <>
      <Title>{TELEGRAM_TITLE}</Title>
      <Meta name="description" content={TELEGRAM_DESCRIPTION} />
      <Meta property="og:title" content={TELEGRAM_TITLE} />
      <Meta property="og:description" content={TELEGRAM_DESCRIPTION} />
      <Meta property="og:url" content={siteUrl("/telegram")} />
      <Meta property="og:type" content="website" />
      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={TELEGRAM_TITLE} />
      <Meta name="twitter:description" content={TELEGRAM_DESCRIPTION} />
      <Link rel="canonical" href={siteUrl("/telegram")} />
      <div class="intel-page">
      <header class="intel-panel p-6 sm:p-8">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div class="intel-badge mb-2">
              <div class="h-1.5 w-1.5 rounded-full bg-blue-300" />
              Telegram Monitoring
            </div>
            <h1 class="intel-heading">Telegram Intel</h1>
            <p class="intel-subheading">Unified analyst rail for conflict, OSINT Cyber, strategic monitoring, and media-backed event triage.</p>
          </div>

          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-white">{filteredEntries().length}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Visible Msgs</p>
              <Show when={mergeDuplicates() && dedupeSavedCount() > 0}>
                <p class="text-[10px] text-emerald-300/80">-{dedupeSavedCount()} dupes</p>
              </Show>
            </div>
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-emerald-300">{verifiedCount()}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Verified</p>
            </div>
            <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-center">
              <p class="font-mono-data text-lg font-bold text-cyan-300">{channels().length}</p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Channels Monitored</p>
            </div>
            <div class={`rounded-xl border px-3 py-2 text-center ${freshnessPillTone(freshness.feedFreshness().state)}`} title={freshnessTooltip(feedThresholds)}>
              <p
                class={`font-mono-data text-lg font-bold ${
                  freshness.feedFreshness().state === "live"
                    ? "text-emerald-300"
                    : freshness.feedFreshness().state === "delayed"
                      ? "text-amber-300"
                      : "text-red-300"
                }`}
              >
                {freshness.latestFeedAgeLabel()}
              </p>
              <p class="text-[10px] uppercase tracking-wider text-zinc-500">Latest Msg Age</p>
            </div>
          </div>
        </div>
      </header>

      <FeedAccessNotice surface="Telegram" />

      <section class="surface-card space-y-3 p-3 sm:p-4">
        <div class="flex flex-wrap items-center gap-2" role="tablist" aria-label="Telegram filter groups">
          <For each={activeFilterGroups()}>
            {(group) => (
              <button
                type="button"
                onClick={() => setGroupFilter(group.id)}
                aria-pressed={groupFilter() === group.id}
                class={`min-h-11 cursor-pointer rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
                  groupFilter() === group.id
                    ? "border-blue-400/40 bg-blue-500/15 text-blue-200"
                    : "border-white/[0.06] text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
                }`}
              >
                {group.label}
                <span class="ml-1 text-[10px] opacity-60">({groupCounts()[group.id] || 0})</span>
              </button>
            )}
          </For>

          <Show when={timestamp()}>
            <span class="ml-auto inline-flex items-center gap-1.5 text-[11px] text-zinc-500" aria-live="polite">
              <Show when={refreshing()}>
                <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
              </Show>
                <span
                  class={`h-1.5 w-1.5 rounded-full ${
                  freshness.feedFreshness().state === "live"
                    ? "bg-emerald-300"
                    : freshness.feedFreshness().state === "delayed"
                      ? "bg-amber-300"
                      : "bg-red-300"
                }`}
              />
              <Clock size={12} /> Updated {timestamp()}
              <span class="text-zinc-600">•</span>
              <span class={streamConnected() ? "text-emerald-300" : "text-zinc-500"}>
                {streamConnected() ? "Live stream" : "Polling fallback"}
              </span>
              <span class="text-zinc-600">•</span>
              <span class="text-zinc-400">
                {freshness.feedFreshness().label}
                <Show when={freshness.latestFeedAgeMs() !== null}> ({freshness.latestFeedAgeLabel()})</Show>
              </span>
            </span>
          </Show>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setFeedMode("deduped")}
              aria-pressed={feedMode() === "deduped"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${feedMode() === "deduped" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Deduped
            </button>
            <button
              type="button"
              onClick={() => setFeedMode("raw")}
              aria-pressed={feedMode() === "raw"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${feedMode() === "raw" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Raw
            </button>
            <button
              type="button"
              onClick={() => setFeedMode("verified")}
              aria-pressed={feedMode() === "verified"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${feedMode() === "verified" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Verified
            </button>
          </div>

          <div class="inline-flex rounded-xl border border-white/[0.08] bg-black/20 p-1">
            <button
              type="button"
              onClick={() => setAgeWindow("all")}
              aria-pressed={ageWindow() === "all"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${ageWindow() === "all" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Full history
            </button>
            <button
              type="button"
              onClick={() => setAgeWindow("24h")}
              aria-pressed={ageWindow() === "24h"}
              class={`min-h-11 cursor-pointer rounded-lg px-2.5 py-1 text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${ageWindow() === "24h" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              Last 24h
            </button>
          </div>

          <button
            type="button"
            onClick={() => setMediaOnly(!mediaOnly())}
            aria-pressed={mediaOnly()}
            class={`min-h-11 cursor-pointer rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 ${
              mediaOnly() ? "border-amber-400/30 bg-amber-500/10 text-amber-300" : "border-white/[0.08] bg-black/20 text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Media only
          </button>
          <div class="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[11px] text-zinc-400">
            {feedMode() === "raw"
              ? "Raw view shows single-source flow for operator triage."
              : feedMode() === "verified"
                ? "Verified view biases toward multi-source and media-backed clusters."
                : "Deduped view collapses near-duplicates into a cleaner timeline."}
          </div>
        </div>

        <Show when={ownerDedupeEnabled() && mergeDuplicates()}>
          <div class="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3">
            <div class="flex flex-wrap items-center gap-2">
              <p class="text-[12px] font-semibold text-emerald-200">Owner Dedupe Controls</p>
              <span class="rounded-full border border-emerald-400/25 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-200">
                Rules: {dedupeFeedbackCount()}
              </span>
              <span class="rounded-full border border-white/[0.1] bg-black/20 px-2 py-0.5 text-[10px] text-zinc-300">
                Selected events: {selectedClusterKeys().length}
              </span>
              <span class="rounded-full border border-white/[0.1] bg-black/20 px-2 py-0.5 text-[10px] text-zinc-300">
                Selected signatures: {selectedSignatures().length}
              </span>
              <button
                type="button"
                disabled={adminBusy()}
                onClick={() => { void mergeSelectedClusters(); }}
                class="cursor-pointer rounded-md border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-medium text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Merge selected
              </button>
              <button
                type="button"
                disabled={adminBusy()}
                onClick={() => setSelectedClusterKeys([])}
                class="cursor-pointer rounded-md border border-white/[0.15] bg-black/20 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear selection
              </button>
              <button
                type="button"
                disabled={adminBusy()}
                onClick={() => { void refreshDedupeFeedbackStatus(); }}
                class="cursor-pointer rounded-md border border-white/[0.15] bg-black/20 px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Refresh rules
              </button>
              <Show when={adminBusy()}>
                <span class="inline-flex items-center gap-1 text-[11px] text-emerald-100">
                  <LoaderCircle class="h-3.5 w-3.5 animate-spin" /> Applying...
                </span>
              </Show>
            </div>
            <Show when={adminStatus().trim().length > 0}>
              <p class="mt-2 text-[11px] text-emerald-100/90">{adminStatus()}</p>
            </Show>
          </div>
        </Show>
      </section>

      <Show when={freshness.freshnessNotice()}>
        {(notice) => (
          <section
            class={`freshness-transition-banner rounded-2xl border px-4 py-3 text-xs ${freshnessBannerTone(notice().state)} ${notice().phase === "exit" ? "freshness-transition-banner--exit" : ""}`}
            role="status"
            aria-live="polite"
          >
            {notice().message}
          </section>
        )}
      </Show>

      <Show when={showInitialLoading()}>
        <div>
          <For each={[1, 2, 3, 4]}>
            {(i) => (
              <div class="telegram-skeleton-card" style={{ "animation-delay": `${(i - 1) * 150}ms` }}>
                <div class="telegram-skeleton-avatar" />
                <div class="flex flex-col gap-2 flex-1">
                  <div class="telegram-skeleton-line telegram-skeleton-line--header" />
                  <div class="telegram-skeleton-line telegram-skeleton-line--long" />
                  <div class="telegram-skeleton-line telegram-skeleton-line--medium" />
                  <div class="telegram-skeleton-line telegram-skeleton-line--short" />
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      <Show when={!showInitialLoading() && filteredEntries().length > 0}>
        <section class="space-y-3">
          <div class="flex items-center gap-3 border-b border-white/[0.06] pb-2">
            <div class="h-5 w-1 rounded-full bg-blue-500" />
            <h2 class="text-base font-semibold text-white">{groupFilter() === "all" ? "All Messages" : `${activeGroup().label} Messages`}</h2>
            <span class="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] font-mono-data text-zinc-300">
              {filteredEntries().length} msgs
            </span>
          </div>
          <div class="space-y-0">
            <For each={filteredEntries()}>
              {(entry) => (
                <TelegramMessageCard
                  entry={entry}
                  categoryLabel={categories()[entry.category] || entry.category}
                  showCategory={showCategoryPill()}
                  nowMs={clockNow()}
                  focusKey={focusKey()}
                  onShare={shareFromSite}
                  ownerToolsEnabled={ownerDedupeEnabled() && mergeDuplicates()}
                  selectedForMerge={selectedClusterKeys().includes(entry.dedupe?.clusterKey ?? "")}
                  adminBusy={adminBusy()}
                  onToggleMergeSelect={toggleClusterSelection}
                  onSplitEvent={(item) => { void splitCluster(item); }}
                  onClearRule={(item) => { void clearClusterRule(item); }}
                />
              )}
            </For>
          </div>
        </section>
      </Show>

      <Show when={showEmpty()}>
        <div class="surface-card p-14 text-center">
          <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.06] bg-zinc-800/40">
            <Radio size={24} class="text-zinc-500" />
          </div>
          <h3 class="text-sm font-medium text-zinc-400">No Telegram messages match the current filters</h3>
          <p class="mt-1 text-[12px] text-zinc-600">Use Show all, switch to Full history, change Deduped/Raw/Verified mode, or disable Media only.</p>
        </div>
      </Show>

      <Show when={!showInitialLoading() && filteredEntries().length > 0}>
        <div class="grid gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-zinc-500 sm:grid-cols-3">
          <div class="flex items-center gap-2"><MessageSquare size={12} /> Raw, deduped, and verified modes let operators pivot without leaving the page</div>
          <div class="flex items-center gap-2"><Image size={12} /> Media-only mode isolates visual posts and OCR-backed entries</div>
          <div class="flex items-center gap-2"><Video size={12} /> Source matrix panels expose cluster provenance before merge or escalation</div>
        </div>
      </Show>
      </div>
    </>
  );
}
