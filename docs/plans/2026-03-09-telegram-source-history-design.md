# Telegram Source History Design

## Summary

Build a role-aware Telegram source history route at `/telegram/source/:channel`.

The same route serves two depths:
- subscribers get a polished source-performance profile
- owners get deeper operational diagnostics on the same source

This feature should reuse existing Telegram canonical-event and source-performance data already stored in D1.

## Goals

- Dedicated route: `/telegram/source/:channel`
- Subscriber-only plus owner access
- Clear explanation of why a source is important
- Owner-only diagnostics without a separate route tree
- Reuse existing signal-grade and source-performance data

## Non-goals

- Separate owner/admin route for the same source page
- Full provider/source history across all OSINT sources in v1
- Notification delivery or alerting changes
- A separate analytics subsystem

## Access model

Allowed roles:
- `subscriber`
- `owner`

Behavior:
- subscribers see the standard source profile
- owners see the standard profile plus diagnostics blocks
- free and trial users are denied

## Route

- `/telegram/source/:channel`

Examples:
- `/telegram/source/tasnimnews`
- `/telegram/source/operativnoZSU`

## Subscriber surface

Show:
- source/channel name
- label/category
- trust tier
- overall source score
- lead/first-report counts for `24h / 7d / 30d`
- average signal score
- recent notable first reports
- common source reasons:
  - `First`
  - `Multi-source`
  - `Core source`
  - `Fresh`
- plain-language verdict:
  - `High-value first reporter`
  - `Reliable corroborator`
  - `Watch source`

## Owner-only surface

Add:
- duplicate/follow-on rate
- corroboration lag indicators
- latest score inputs and counters
- recent canonical events involving the source
- source-performance/debug block:
  - channel username
  - label/category
  - trust tier
  - current score inputs
  - derived performance score

This section is operational and diagnostic, not just presentational.

## API contract

### `GET /api/telegram/source-history/:channel?window=24h|7d|30d`

Response:
- `source`
- `summary`
- `recentEvents`
- `ownerDiagnostics?`

### `source`
- `channel`
- `label`
- `category`
- `trustTier`

### `summary`
- `score`
- `leadCount`
- `duplicateCount`
- `recentFirstReports`
- `averageSignalScore`
- `duplicateRate`
- `topReasons[]`
- `lastSeenAt`
- `verdict`

### `recentEvents`
Compact list of canonical event references involving the source:
- `eventId`
- `datetime`
- `title`
- `signalScore`
- `signalGrade`
- `rankReasons`
- `link`

### `ownerDiagnostics`
Owner-only:
- `bestSourceScore`
- `averageSourceScore`
- `sourceCountSeen`
- `leadWins`
- `followOnCount`
- `duplicatePenaltyCount`
- `latestRawEvents` (optional compact subset)

## Data sources

Use existing D1-backed Telegram data first.

Primary sources:
- canonical Telegram events
- source-performance / leaderboard data
- existing channel config metadata

No new analytics store in v1.

## Query strategy

1. Summary query
- aggregate source stats by channel for selected window
- score, counts, averages, latest timestamps

2. Recent events query
- recent canonical events where the channel appears in event source membership

3. Owner diagnostics query
- raw score input counters and diagnostic details
- only loaded for owners

## Windows

Support:
- `24h`
- `7d`
- `30d`

Default:
- `24h`

## UI

Top controls:
- window switcher
- source score summary card row

Main sections:
1. source header
2. summary metrics
3. recent first reports / notable items
4. reason distribution / source profile cues
5. owner diagnostics (owner only)

## Failure behavior

- missing source returns explicit 404-like empty state
- malformed source data degrades safely
- owner diagnostics must not leak to subscriber responses

## Testing

### Edge
- source-history query normalization
- auth gating
- owner diagnostics omission for subscriber
- missing-source fallback

### Web
- client normalization
- route state rendering
- owner diagnostics conditional rendering

### Browser
- subscriber can open `/telegram/source/:channel`
- owner can open the same route and see diagnostics
- free/trial route stays gated

## Implementation order

1. edge query helper for source history
2. edge API route
3. web client helper
4. `/telegram/source/:channel` route
5. role-aware owner diagnostics block
6. tests and browser coverage

## Future expansion

- OSINT provider history pages
- source comparison pages
- favorite-source actions from source pages
- source-triggered notification settings
