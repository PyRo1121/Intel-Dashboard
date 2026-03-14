# Telegram MTProto + OSINT Fast-Lane Design

## Goal
Reduce subscriber-visible latency beyond the current polling limits:
- Telegram: move high-value channels from scrape-driven ingest toward near-immediate ingest.
- OSINT: stop rotating top-value sources and give them a dedicated fast lane.

## Current state
Telegram production now runs with:
- 10s scrape interval
- 30s full rotation window
- 64 hot channels every cycle
- scraper cycles finishing in roughly 2.6s-5.2s for 96 channels/cycle

This is healthy, but still bounded by polling.

OSINT production now runs with:
- 36 RSS sources/run
- 6 items/source
- fetch concurrency 12
- 60s rotation window

This is materially better than before, but still bounded by cron/RSS rotation.

## Recommendation
Implement two new ingest layers while keeping the current stack as fallback:
1. Telegram MTProto collector for high-value joined channels.
2. OSINT fast lane for priority sources, with rotation preserved for the long tail.

## Telegram design
### Runtime
Use a long-lived collector runtime, ideally a Cloudflare Container.

### Scope
Collector handles only the highest-value Telegram channels.
The current HTML scraper remains in place for:
- fallback
- discovery
- non-joined / low-priority channels

### Flow
1. Collector account joins selected public channels.
2. MTProto updates are received close to publish time.
3. Collector normalizes incoming messages into the existing Telegram canonical event contract.
4. Collector writes through the same downstream path used by current Telegram state:
   - Durable Object / D1 / KV hot state
   - canonical events
   - source history
   - signal grading inputs
5. Existing product surfaces continue to read the same state:
   - /telegram
   - /my-feed
   - /my-alerts
   - source history
   - leaderboard

### Cutover strategy
- Collector-origin data is authoritative for hot channels.
- Scraper remains authoritative for non-hot channels.
- For overlapping channels, prefer collector updates and keep scraper as safety net until confidence is high.

## OSINT design
### Source tiers
1. Fast lane
- top-value RSS/API sources
- every minute
- no rotation

2. Rotating lane
- broader RSS coverage
- rotated

3. Future push/API lane
- direct integrations later for webhook/API sources

### Flow
1. Fast-lane sources are always selected every scheduled run.
2. Rotating lane fills remaining budget.
3. Existing enrichment and publish pipeline stays intact.
4. Product surfaces keep reading the same feed contracts.

## Storage and platform fit
- D1: canonical history, source history, diagnostics
- KV: hot snapshots and cached state
- Durable Objects: coordination and hot state fan-out
- Container: MTProto collector runtime
- Workers: serving layer and existing APIs

## Risks
### Telegram collector
- requires dedicated Telegram accounts and session management
- requires careful duplicate handling between collector and scraper

### OSINT fast lane
- may increase upstream fetch load
- needs explicit source-tier ownership to avoid accidental regressions

## Testing
- collector normalization tests
- duplicate resolution tests between collector and scraper
- source-tier selection tests for OSINT
- browser and API freshness checks on high-value surfaces
- regression tests for canonical event compatibility

## Phased implementation
### Phase 1
- add OSINT fast-lane tiering in backend selection logic
- no new runtime required

### Phase 2
- scaffold Telegram collector interfaces and write path
- no cutover yet

### Phase 3
- enable collector for a small hot-channel subset
- compare collector freshness vs scraper freshness

### Phase 4
- expand collector coverage and reduce scraper dependence for hot channels
