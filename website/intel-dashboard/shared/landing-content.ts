import {
  FREE_FEED_DELAY_MINUTES,
  FREE_PLAN_NAME,
  PREMIUM_PLAN_NAME,
  PREMIUM_PRICE_USD,
  TRIAL_DAYS,
  formatDelayMinutesLong,
  formatTrialDaysLabel,
  formatUsdMonthlyCompact,
  formatUsdMonthlySpaced,
} from "./access-offers.ts";
import { SITE_NAME } from "./site-config.ts";

export type MarketingCard = {
  title: string;
  copy: string;
};

export type StatTile = {
  label: string;
  value: string;
};

export type ActionLabel = {
  id: string;
  label: string;
};

export type Testimonial = {
  quote: string;
  byline: string;
};

export type WorkflowStep = {
  step: string;
  title: string;
  copy: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export const LANDING_CAPABILITIES: readonly MarketingCard[] = [
  {
    title: "Signal Prioritization",
    copy: "Ranks events by material impact so teams see escalations before noise floods analyst queues.",
  },
  {
    title: "Cross-Source Correlation",
    copy: "Links Telegram, RSS, and open-source streams into one timeline with dedupe and confidence scoring.",
  },
  {
    title: "Actionable Intelligence Handoff",
    copy: "Transforms raw updates into analyst-ready summaries that can be escalated in minutes, not hours.",
  },
] as const;

export const LANDING_TESTIMONIALS: readonly Testimonial[] = [
  {
    quote: `${SITE_NAME} cut our conflict triage cycle from 48 minutes to under 12.`,
    byline: "Intelligence Ops Lead, Regional Media Desk",
  },
  {
    quote: "We replaced three monitoring tools with one feed our analysts actually trust.",
    byline: "Director, Crisis Monitoring Team",
  },
  {
    quote: "The premium stream paid for itself in the first week during a live incident window.",
    byline: "Security Program Manager, Infrastructure Group",
  },
] as const;

export const LANDING_WORKFLOW_STEPS: readonly WorkflowStep[] = [
  {
    step: "01",
    title: "Ingest",
    copy: "Capture conflict and geopolitical signals from structured OSINT channels.",
  },
  {
    step: "02",
    title: "Prioritize",
    copy: "Apply severity and relevance logic so responders see what changes outcomes first.",
  },
  {
    step: "03",
    title: "Verify",
    copy: "Cross-check summaries against source context to reduce false confidence during escalation.",
  },
  {
    step: "04",
    title: "Act",
    copy: "Move from event detection to stakeholder communication without losing timeline integrity.",
  },
] as const;

export const LANDING_PLATFORM_CARDS: readonly MarketingCard[] = [
  {
    title: "Source graph",
    copy: "Curated global conflict sources with reliability metadata and regional slicing for scraper strategy.",
  },
  {
    title: "Shard-safe ingest",
    copy: "Durable Object sharding plus hot overlays keep updates near-instant under multi-scraper load.",
  },
  {
    title: "Paid intelligence",
    copy: `${FREE_FEED_DELAY_MINUTES}-minute non-subscriber delay, subscriber immediacy, and owner permanent entitlement.`,
  },
  {
    title: "AI pipelines",
    copy: "Routed AI lanes send text dedupe, translation, and classification through Cerebras while reserving Groq Scout only for rare media-aware dedupe.",
  },
] as const;

export const LANDING_FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: `What does ${SITE_NAME} monitor?`,
    answer: `${SITE_NAME} monitors open-source intelligence sources including conflict channels, public feeds, and geopolitical events, then normalizes those signals into one operational dashboard.`,
  },
  {
    question: "How does free vs premium access work?",
    answer: `Free access provides delayed updates for baseline visibility, while premium enables instant feed delivery and priority processing speed, with up to ${FREE_FEED_DELAY_MINUTES} minutes of delay on the free tier.`,
  },
  {
    question: "How do users authenticate?",
    answer: "Authentication is OAuth-only with GitHub or X. This avoids password reset friction and keeps access flows clean.",
  },
  {
    question: "Can I test before committing?",
    answer: `Yes. Every premium account starts with a ${formatTrialDaysLabel(TRIAL_DAYS)} so teams can validate fit during real operational usage.`,
  },
] as const;

export const LANDING_HERO_BULLETS: readonly string[] = [
  "Unified conflict and threat timeline from multiple open-source feeds",
  "Severity-aware triage designed for decision velocity",
  `Subscriber instant delivery with up to a ${formatDelayMinutesLong(FREE_FEED_DELAY_MINUTES)} free-tier delay`,
] as const;

export const LANDING_HEADER_LINKS = {
  platform: "Platform",
  workflow: "Workflow",
  pricing: "Pricing",
  faq: "FAQ",
  login: "Login",
  signup: `Start ${formatTrialDaysLabel(TRIAL_DAYS)}`,
  dashboard: "Open Dashboard",
  dashboardLive: "Open Live Dashboard",
} as const;

export const LANDING_HERO_CONTENT = {
  eyebrow: "Live conflict intelligence pipeline",
  title: "Serious intelligence for teams that can’t miss shifts.",
  lead: `${SITE_NAME} converts fragmented OSINT streams into decision-ready timelines with edge-speed delivery and AI deduplication. Start free, then upgrade for instant feeds and priority processing.`,
  primaryCta: "Start Trial with OAuth",
  secondaryCta: "Sign In",
  oauthTag: "OAuth-only onboarding",
  premiumTag: "Instant premium feed",
  note: "OAuth-only authentication via GitHub or X. No password management required.",
  workerEyebrow: "Real-time geopolitical OSINT",
  workerTitle: "World-class intelligence speed without enterprise complexity.",
  workerLead: `${SITE_NAME} is a real-time OSINT dashboard for security teams, media desks, and analysts who need fast geopolitical signal detection, clear prioritization, and operationally clean handoff.`,
} as const;

export const LANDING_OPS_SNAPSHOT = {
  heading: "Ops Snapshot",
  liveBadge: "Live",
  metrics: [
    { value: "412", label: "Events normalized" },
    { value: "94.7%", label: "Noise removed" },
    { value: "2.8s", label: "Priority sync" },
  ] satisfies readonly StatTile[],
  logs: [
    "[feed] conflict intelligence stream active",
    "[ai] Severity ranking recalculated across active incidents",
    "[alert] Premium channel issued escalation bulletin",
  ] as const,
} as const;

export const LANDING_SUPPORTING_STATS: readonly StatTile[] = [
  { label: "Response Time", value: "4x Faster" },
  { label: "Analyst Confidence", value: "High" },
  { label: "Deployment Model", value: "Cloudflare Edge" },
] as const;

export const LANDING_SUPPORTING_STATS_COPY = {
  "Response Time": "Average triage acceleration during live escalation windows.",
  "Analyst Confidence": "Cross-source timeline stitching reduces false positives and duplicate escalation.",
  "Deployment Model": "Global distribution with low-latency request paths and hardened auth workflows.",
} as const satisfies Record<StatTile["label"], string>;

export const LANDING_CAPABILITIES_SECTION = {
  heading: "Built for high-accountability teams",
  intro: `${SITE_NAME} is designed for operational decision-makers who need speed, context, and credibility under pressure.`,
  workerHeading: "Built for teams that operate inside time-critical intelligence windows",
  workerIntro: `${SITE_NAME} replaces fragmented monitoring with one OSINT intelligence platform focused on clarity, speed, and actionability. This structure is designed for operational confidence under pressure.`,
} as const;

export const LANDING_TESTIMONIALS_SECTION = {
  heading: "Trusted by response-focused operators",
} as const;

export const LANDING_PRICING_COPY = {
  heading: "Free visibility. Paid velocity.",
  summary: `Start with a ${formatTrialDaysLabel(TRIAL_DAYS)}, validate performance during real events, then continue at ${formatUsdMonthlyCompact(PREMIUM_PRICE_USD)} for instant delivery.`,
  freePlanName: FREE_PLAN_NAME,
  freePriceLabel: "$0 / month",
  freeFeatures: [
    `Up to ${formatDelayMinutesLong(FREE_FEED_DELAY_MINUTES)} delayed intelligence feed`,
    "Dashboard and map access",
    "OAuth account onboarding",
  ],
  premiumPlanName: PREMIUM_PLAN_NAME,
  premiumPriceLabel: `${formatUsdMonthlySpaced(PREMIUM_PRICE_USD)} after trial`,
  premiumFeatures: [
    "Instant intelligence delivery",
    "Priority AI dedupe and processing lanes",
    "Premium workflow performance",
  ],
  backendHeroTrialCta: `Start ${formatTrialDaysLabel(TRIAL_DAYS)}`,
  backendTrialSummary: `${formatTrialDaysLabel(TRIAL_DAYS)} free trial, cancel anytime. Owner IDs remain permanently entitled for administration.`,
  backendPriceFigureMain: `$${PREMIUM_PRICE_USD}`,
  backendKpiPriceLabel: formatUsdMonthlyCompact(PREMIUM_PRICE_USD),
} as const;

export const LANDING_FINAL_CTA = {
  heading: "Upgrade your intelligence response speed this week.",
  copy: `Run ${SITE_NAME} during live events, compare decision latency, and keep the premium path if faster response directly improves your outcomes.`,
  primaryLabel: `Start ${formatTrialDaysLabel(TRIAL_DAYS)}`,
  secondaryLabel: "Sign In",
} as const;

export const LANDING_FOOTER = {
  productLabel: `${SITE_NAME} • Real-Time OSINT Intelligence Platform`,
  startTrialLabel: "Start Trial",
} as const;

export const BACKEND_LANDING_HERO = {
  title: "Conflict intelligence at edge speed.",
  lead: `${SITE_NAME} ingests high-signal OSINT, newsroom, and regional analyst feeds into a low-latency decision surface with subscription gating, owner overrides, and operational AI pipelines.`,
  signInLabel: "Sign in with X",
  continueLabel: "Continue with X",
  trialButtonLabel: `Start ${formatTrialDaysLabel(TRIAL_DAYS)}`,
  stats: [
    { value: "35+", label: "backend tests passing" },
    { value: "sub-sec", label: "edge read targets" },
    { value: formatUsdMonthlyCompact(PREMIUM_PRICE_USD), label: `after ${formatTrialDaysLabel(TRIAL_DAYS)}` },
  ] satisfies readonly StatTile[],
} as const;

export const BACKEND_OPERATOR_PANEL = {
  heading: "Operator console",
  intro: "Use token-protected checks for role, entitlement, and source intelligence snapshots.",
  userIdLabel: "User ID",
  userIdPlaceholder: "owner-user-id",
  apiTokenLabel: "Bearer API token",
  apiTokenPlaceholder: "Bearer ...",
  actions: [
    { id: "statusBtn", label: "Check access" },
    { id: "sourcesBtn", label: "Load sources" },
    { id: "ownerBtn", label: "Owner check" },
  ] satisfies readonly ActionLabel[],
} as const;

export const BACKEND_OPERATOR_CARDS: readonly MarketingCard[] = [
  {
    title: "Source graph",
    copy: "Curated global conflict sources with reliability metadata and regional slicing for scraper strategy.",
  },
  {
    title: "Shard-safe ingest",
    copy: "Durable Object sharding plus hot overlays keep updates near-instant under multi-scraper load.",
  },
  {
    title: "Paid intelligence",
    copy: `${FREE_FEED_DELAY_MINUTES}-minute non-subscriber delay, subscriber immediacy, and owner permanent entitlement.`,
  },
  {
    title: "AI pipelines",
    copy: "Routed AI lanes send text dedupe, translation, and classification through Cerebras while reserving Groq Scout only for rare media-aware dedupe.",
  },
] as const;

export const BACKEND_OPERATOR_PRICING = {
  heading: "Subscription",
  priceMain: `$${PREMIUM_PRICE_USD}`,
  priceSuffix: "/ month",
  summary: `${formatTrialDaysLabel(TRIAL_DAYS)} free trial, cancel anytime. Owner IDs remain permanently entitled for administration.`,
  launchCheckoutLabel: "Launch checkout",
} as const;
