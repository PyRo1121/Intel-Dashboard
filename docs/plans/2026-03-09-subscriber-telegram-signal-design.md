# Subscriber Telegram Signal Design

Date: 2026-03-09

## Goal

Give subscribers a real Telegram/live-feed advantage by:

- ranking canonical events using source performance instead of static channel weights alone
- rewarding channels that break stories first
- penalizing channels that mostly appear as late duplicate follow-ups
- surfacing a cleaner premium feed without adding AI latency to the hot path

## Scope

- Producer-side source performance model in `apps/edge/src/telegram-scraper-do.ts`
- Premium signal-first behavior in `apps/web/src/routes/telegram.tsx`
- Regression coverage for source scoring and premium feed behavior

## Design

### Producer

The Telegram Durable Object already canonicalizes source messages into event clusters. This is the right insertion point because the output feeds both websocket refresh and normal page fetches.

Add a rolling per-source performance table in DO SQLite with decayed counters for:

- total events seen
- lead reports
- follow-on duplicate reports
- corroborated reports
- single-source reports
- last lead time
- last seen time

Update these counters each scrape cycle from canonical clusters. Treat the earliest source in a cluster as the lead source, with a short tolerance window for near-simultaneous first reports.

Compute a per-source performance score using:

- static channel subscriber value
- lead-report rate
- corroboration rate
- follow-on duplicate penalty
- trust / latency tier bonuses
- small recency boost for recent lead reports

Use the updated score to strengthen event `rank_score` and event-level `subscriber_value_score`.

### Premium web feed

Subscribers and owners should default to a signal-first Telegram feed. Free and trial users keep the current deduped view.

Premium defaults:

- rank canonical events by score first, then freshness
- enable a noise filter by default to collapse low-signal duplicate chatter
- preserve toggles so the operator can fall back to the broader deduped view

### AI cost / latency posture

Do not add more AI calls in phase 1. Improve premium value by making better use of existing canonicalization and event metadata. If ambiguous-cluster AI adjudication is needed later, keep it off the default hot path.

## Validation

- unit tests for rolling source-performance scoring
- regression tests for event ranking behavior
- web tests for premium signal-first defaults
- targeted `apps/edge` and `apps/web` typecheck/test runs before widening
