# Async Briefings Design

## Goal
Reduce AI token spend for `/api/briefings` without regressing Telegram/news realtime latency.

## Current problem
- Briefings are AI-generated on demand in the backend.
- The edge `IntelCacheDO` proactively refreshes `/api/briefings` every 60 seconds.
- The briefings UI refreshes every 120 seconds.
- Product messaging already frames briefings as a periodic artifact generated every 4 hours, not a realtime feed.

This means the system is paying realtime AI cost on a background refresh loop for content that does not need realtime freshness.

## Chosen approach
Use stale-while-refresh briefings with background AI generation.

## Design
- Introduce persistent backend cache state for generated briefings keyed by briefing window.
- `/api/briefings` should return cached briefing payloads immediately.
- If a requested/current briefing window is missing or stale, backend should:
  - return the best available cached payload immediately
  - trigger background regeneration for the missing/stale window
- Background regeneration uses the existing backend queue/recovery infrastructure rather than a new worker/service.
- Deterministic fallback briefing content remains available and should be stored if AI generation fails.

## Data model
Persist a compact JSON payload per briefing window in existing KV state.
Suggested fields:
- `windowStartMs`
- `windowHours`
- `content`
- `severitySummary`
- `eventCount`
- `generatedAtMs`
- `mode` (`ai` or `fallback`)
- `sourceHash` or equivalent fingerprint of the briefing input set

Also persist a lightweight refresh marker / pending state to avoid duplicate queueing for the same window.

## Runtime behavior
### Request path
- `handlePublicBriefings` reads cached windows first.
- If cached data exists and is within the allowed staleness window, return it directly.
- If current window is missing or stale:
  - enqueue regeneration once
  - still return cached data immediately if any exists
  - otherwise synthesize and return fallback data immediately

### Scheduled path
- scheduled backend runs can proactively enqueue/refresh the newest briefing window on the normal cadence.
- This keeps the cache warm before user traffic arrives.

### Queue path
- reuse existing internal queue processing.
- add a dedicated briefing refresh job kind rather than forcing briefings through the generic AI jobs API.
- queue consumer computes the latest source set for the target window, generates AI content once, and persists the cached payload.

## Cache policy
- Edge DO can keep refreshing `/api/briefings`, but backend responses should usually be cache hits against stored briefing payloads rather than fresh AI calls.
- AI Gateway briefing cache remains useful as a secondary guard, but it should no longer be the primary mechanism for keeping `/api/briefings` cheap.

## Failure handling
- If queueing fails on request path, do not fail the endpoint if cached/fallback briefing data is available.
- If AI generation fails in background, store fallback content for that window and mark mode as `fallback`.
- Never block `/api/briefings` on live AI success.

## Testing
- unit tests for cached hit, stale hit + enqueue, cold miss + fallback, and duplicate enqueue suppression
- queue tests for successful briefing generation persistence and fallback persistence on AI failure
- endpoint tests for `/api/briefings` returning cached payloads without invoking AI generation synchronously

## Expected result
- Telegram/news hot path remains realtime
- briefing latency becomes cache/KV bound
- briefing AI calls collapse from continuous refresh-driven generation to once-per-window regeneration
