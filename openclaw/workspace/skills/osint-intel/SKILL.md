---
name: osint-intel
description: Aggregate open-source intelligence across conflict event APIs, curated RSS feeds, airspace notices, and military aircraft telemetry, then output normalized IntelItem JSON plus a briefing-ready analysis text. Use when building automated geopolitical monitoring, validating incident signals across multiple sources, or preparing daily intelligence briefs for operators.
---

# osint-intel

`osint-intel` collects and normalizes OSINT data from multiple sources:

- GDELT conflict events
- RSS feeds (regional + milblogger source packs)
- ACLED conflict events
- FAA/ICAO NOTAM data
- OpenSky military aircraft movement signals
- Telegram intelligence channels (via `telegram-intel` state)

## Outputs

- Each fetch script prints JSON `IntelItem[]` to stdout.
- `scripts/aggregate.ts` runs all fetchers, deduplicates with a 4-hour memory window, and prints merged `IntelItem[]`.
- `scripts/analyze.ts` reads aggregated JSON from stdin and prints an analyst-style briefing.

## Usage

```bash
bun run scripts/fetch-gdelt.ts
bun run scripts/fetch-rss.ts
bun run scripts/fetch-acled.ts
bun run scripts/fetch-notams.ts
bun run scripts/fetch-military.ts
bun run scripts/fetch-sec.ts
bun run scripts/fetch-weather.ts
bun run scripts/fetch-telegram.ts
bun run scripts/aggregate.ts
bun run scripts/refresh.ts
bun run scripts/aggregate.ts | bun run scripts/analyze.ts
```

## Continuous refresh

```bash
bun run install-cron
```

This installs a `* * * * *` cron job that runs `bun run refresh` and appends logs to `state/refresh.log`.

## Environment

- Optional: `ACLED_API_KEY`, `ACLED_EMAIL` for ACLED access.
- Optional: `OSINT_REGION` to bias some fetchers to a target region.

## Runtime state

- Dedup memory: `~/.openclaw/workspace/memory/osint-seen.json`
- Skill-local state files: `state/`
