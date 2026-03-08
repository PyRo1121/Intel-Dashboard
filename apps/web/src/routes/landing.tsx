import { For } from "solid-js";
import { A } from "@solidjs/router";
import { Meta, Title } from "@solidjs/meta";
import { DASHBOARD_HOME_PATH } from "../../../../packages/shared/auth-next-routes.ts";
import { FREE_FEED_DELAY_MINUTES, formatDelayMinutesLong } from "../../../../packages/shared/access-offers.ts";
import {
  LANDING_CAPABILITIES,
  LANDING_CAPABILITIES_SECTION,
  LANDING_FINAL_CTA,
  LANDING_HEADER_LINKS,
  LANDING_HERO_CONTENT,
  LANDING_OPS_SNAPSHOT,
  LANDING_PRICING_COPY,
  LANDING_SUPPORTING_STATS,
  LANDING_SUPPORTING_STATS_COPY,
  LANDING_TESTIMONIALS,
  LANDING_TESTIMONIALS_SECTION,
} from "../../../../packages/shared/landing-content.ts";
import { APP_LANDING_DESCRIPTION, APP_LANDING_TITLE } from "../../../../packages/shared/route-meta.ts";

export default function LandingRoute() {
  return (
    <>
      <Title>{APP_LANDING_TITLE}</Title>
      <Meta name="description" content={APP_LANDING_DESCRIPTION} />

      <div class="intel-app-bg overflow-hidden text-zinc-100">
        <main class="relative mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
          <header class="intel-panel px-4 py-3 md:px-6">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="inline-flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-100">
                <span class="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.18)]" />
                SentinelStream
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <A href="/login" class="intel-btn intel-btn-ghost">{LANDING_HEADER_LINKS.login}</A>
                <A href="/signup" class="intel-btn intel-btn-primary">{LANDING_HEADER_LINKS.signup}</A>
              </div>
            </div>
          </header>

          <section class="intel-panel mt-4 grid gap-4 p-6 md:grid-cols-[1.12fr_0.88fr] md:p-10">
            <div>
              <div class="intel-badge">{LANDING_HERO_CONTENT.eyebrow}</div>
              <h1 class="mt-4 max-w-[16ch] text-4xl font-bold tracking-[-0.03em] text-white md:text-6xl">
                {LANDING_HERO_CONTENT.title}
              </h1>
              <p class="mt-5 max-w-2xl text-sm leading-7 text-zinc-300 md:text-base">
                {LANDING_HERO_CONTENT.lead}
              </p>

              <div class="mt-6 flex flex-wrap gap-3">
                <A href="/signup" class="intel-btn intel-btn-primary">{LANDING_HERO_CONTENT.primaryCta}</A>
                <A href="/login" class="intel-btn intel-btn-secondary">{LANDING_HERO_CONTENT.secondaryCta}</A>
                <A href={DASHBOARD_HOME_PATH} class="intel-btn intel-btn-ghost">{LANDING_HEADER_LINKS.dashboardLive}</A>
              </div>

              <div class="mt-6 flex flex-wrap gap-2 text-xs text-zinc-400">
                <span class="rounded-full border border-emerald-400/30 bg-emerald-500/12 px-3 py-1 font-medium text-emerald-200">{LANDING_HERO_CONTENT.oauthTag}</span>
                <span class="rounded-full border border-cyan-400/30 bg-cyan-500/12 px-3 py-1 font-medium text-cyan-200">Up to {formatDelayMinutesLong(FREE_FEED_DELAY_MINUTES)} delay + capped feed on free tier</span>
                <span class="rounded-full border border-sky-400/30 bg-sky-500/12 px-3 py-1 font-medium text-sky-200">{LANDING_HERO_CONTENT.premiumTag}</span>
              </div>
            </div>

            <aside class="rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-950 to-zinc-900 p-5 text-white shadow-[0_20px_48px_rgba(0,0,0,0.42)] md:p-6">
              <div class="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-zinc-500">
                <span>{LANDING_OPS_SNAPSHOT.heading}</span>
                <span class="rounded-full bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-300">{LANDING_OPS_SNAPSHOT.liveBadge}</span>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <For each={LANDING_OPS_SNAPSHOT.metrics}>
                  {(item) => (
                    <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <p class="text-lg font-bold">{item.value}</p>
                      <p class="mt-1 text-[11px] text-zinc-500">{item.label}</p>
                    </div>
                  )}
                </For>
              </div>
              <div class="mt-4 space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs leading-6 text-zinc-300">
                <For each={LANDING_OPS_SNAPSHOT.logs}>
                  {(item, index) => <p classList={{ "text-emerald-300": index() === LANDING_OPS_SNAPSHOT.logs.length - 1 }}>{item}</p>}
                </For>
              </div>
            </aside>
          </section>

          <section class="mt-4 grid gap-3 md:grid-cols-3">
            <For each={LANDING_SUPPORTING_STATS}>
              {(item) => (
                <div class="intel-panel p-4">
                  <p class="text-xs uppercase tracking-[0.12em] text-zinc-500">{item.label}</p>
                  <p class="mt-2 text-2xl font-bold tracking-tight text-white">{item.value}</p>
                  <p class="mt-1 text-sm text-zinc-400">{LANDING_SUPPORTING_STATS_COPY[item.label as keyof typeof LANDING_SUPPORTING_STATS_COPY]}</p>
                </div>
              )}
            </For>
          </section>

          <section class="intel-panel mt-6 p-6 md:p-8">
            <h2 class="text-2xl font-bold tracking-tight text-white md:text-3xl">{LANDING_CAPABILITIES_SECTION.heading}</h2>
            <p class="mt-2 max-w-3xl text-sm leading-7 text-zinc-400 md:text-base">
              {LANDING_CAPABILITIES_SECTION.intro}
            </p>
            <div class="mt-5 grid gap-3 md:grid-cols-3">
              {LANDING_CAPABILITIES.map((item) => (
                <article class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <h3 class="text-base font-semibold text-white">{item.title}</h3>
                  <p class="mt-2 text-sm leading-6 text-zinc-400">{item.copy}</p>
                </article>
              ))}
            </div>
          </section>

          <section class="intel-panel mt-6 p-6 md:p-8">
            <h2 class="text-2xl font-bold tracking-tight text-white md:text-3xl">{LANDING_TESTIMONIALS_SECTION.heading}</h2>
            <div class="mt-4 grid gap-3 md:grid-cols-3">
              {LANDING_TESTIMONIALS.map((item) => (
                <blockquote class="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <p class="text-sm leading-6 text-zinc-300">"{item.quote}"</p>
                  <footer class="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">{item.byline}</footer>
                </blockquote>
              ))}
            </div>
          </section>

          <section class="intel-panel mt-6 p-6 md:p-8">
            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 class="text-2xl font-bold tracking-tight text-white md:text-3xl">{LANDING_PRICING_COPY.heading}</h2>
                <p class="mt-2 text-sm leading-7 text-zinc-400 md:text-base">{LANDING_PRICING_COPY.summary}</p>
              </div>
              <A href="/signup" class="intel-btn intel-btn-primary">
                Activate Trial
              </A>
            </div>

            <div class="mt-5 grid gap-3 md:grid-cols-2">
              <article class="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 class="text-lg font-semibold text-white">{LANDING_PRICING_COPY.freePlanName}</h3>
                <p class="mt-1 text-sm text-zinc-400">{LANDING_PRICING_COPY.freePriceLabel}</p>
                <ul class="mt-3 space-y-2 text-sm text-zinc-300">
                  <For each={LANDING_PRICING_COPY.freeFeatures}>{(feature) => <li>- {feature}</li>}</For>
                </ul>
              </article>
              <article class="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5">
                <h3 class="text-lg font-semibold text-emerald-100">{LANDING_PRICING_COPY.premiumPlanName}</h3>
                <p class="mt-1 text-sm text-emerald-200">{LANDING_PRICING_COPY.premiumPriceLabel}</p>
                <ul class="mt-3 space-y-2 text-sm text-emerald-100">
                  <For each={LANDING_PRICING_COPY.premiumFeatures}>{(feature) => <li>- {feature}</li>}</For>
                </ul>
              </article>
            </div>
          </section>

          <section class="intel-panel mt-6 p-6 md:p-8">
            <div>
              <h2 class="text-2xl font-bold tracking-tight text-white md:text-3xl">{LANDING_FINAL_CTA.heading}</h2>
              <p class="mt-2 text-sm leading-7 text-zinc-400 md:text-base">{LANDING_FINAL_CTA.copy}</p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
