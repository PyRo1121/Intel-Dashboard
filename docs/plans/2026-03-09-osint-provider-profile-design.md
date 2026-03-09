# OSINT Provider Profile Design

## Summary

Build a role-aware OSINT provider profile route at `/osint/source/:provider`.

Unlike Telegram source history, OSINT providers do not currently have durable provider-level historical storage in D1. V1 must therefore use:
- the live/current OSINT feed snapshot
- the existing static OSINT source catalog metadata

This is a provider profile/history surface, not a fabricated long-horizon analytics system.

## Goals

- Dedicated route: `/osint/source/:provider`
- Subscriber-facing provider profile
- Owner-only diagnostics on the same route
- Reuse existing OSINT source catalog metadata
- Reuse current OSINT feed snapshot for recent item history

## Non-goals

- Inventing persistent long-term provider history without real storage
- Notification changes
- Cross-source correlation beyond the current live feed snapshot

## Access model

Allowed roles:
- `subscriber`
- `owner`

Behavior:
- subscribers see the standard provider profile
- owners see the standard profile plus diagnostics derived from catalog metadata
- free and trial users are denied

## Route

- `/osint/source/:provider`

## Data sources

1. Existing OSINT source catalog
- trust tier
- latency tier
- acquisition method
- source type
- media capability
- scrape risk
- subscriber value score

2. Current OSINT feed snapshot
- recent items from that provider
- severity mix in the current window
- recent regions/categories seen in the live feed

## Subscriber surface

Show:
- provider name
- trust tier
- latency tier
- source type
- subscriber value score
- current-window severity mix
- recent items from that provider
- current regions/categories seen
- plain-language verdict

## Owner-only surface

Add:
- acquisition method
- scrape risk
- media capability
- source catalog tags/metadata
- current-item count in live feed snapshot
- category/region concentration details

## API contract

### `GET /api/osint/source-history/:provider`

Response:
- `provider`
- `summary`
- `recentItems`
- `ownerDiagnostics?`

### `provider`
- `id`
- `name`
- `trustTier`
- `latencyTier`
- `sourceType`
- `subscriberValueScore`

### `summary`
- `currentItemCount`
- `criticalCount`
- `highCount`
- `mediumCount`
- `lowCount`
- `regions[]`
- `categories[]`
- `verdict`

### `recentItems`
- `title`
- `summary`
- `url`
- `timestamp`
- `region`
- `category`
- `severity`

### `ownerDiagnostics`
- `acquisitionMethod`
- `scrapeRisk`
- `mediaCapability[]`
- `catalogTags[]`

## Query strategy

- resolve provider from the source catalog
- fetch current live OSINT snapshot from the existing feed path
- filter items by provider/source name
- compute profile summary from the filtered current snapshot

This is intentionally current-window only until a durable provider-history store exists.

## UI

- route header with provider identity and score card row
- recent item list
- region/category chips
- owner diagnostics section when applicable

## Testing

### Edge
- provider lookup normalization
- auth gating
- summary computation from current feed snapshot
- missing provider / no-items handling

### Web
- client normalization
- provider profile rendering
- owner diagnostics conditional rendering

### Browser
- subscriber can open `/osint/source/:provider`
- owner can open the same route and see diagnostics
- free/trial route stays gated

## Implementation order

1. source-catalog helper for provider lookup
2. edge API for provider profile
3. web client helper
4. `/osint/source/:provider` route
5. link provider names from the OSINT feed
6. tests and browser coverage
