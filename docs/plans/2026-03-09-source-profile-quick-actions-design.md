# Source Profile Quick Actions Design

## Summary

Add one-click favorite and watch actions directly on subscriber/owner source profile pages.

V1 scope:
- Telegram source history page
  - `Favorite channel`
  - `Watch category`
- OSINT provider profile page
  - `Favorite provider`
  - `Watch region`
  - `Watch category`

This reuses the existing subscriber feed preference model and `/api/subscriber/feed-preferences` API. No new preference schema is introduced.

## Goals

- Let subscribers act on source intelligence pages without manual text entry
- Reuse the current preference model for `/my-feed` and `/my-alerts`
- Keep controls out of live feed cards in v1
- Preserve clean, low-clutter source/profile page UX

## Non-goals

- Card-level quick actions on Telegram/OSINT feed cards
- A dedicated settings route
- External notifications
- A second alert or feed preference model

## Route surfaces

### Telegram source history
- `/telegram/source/:channel`
- controls:
  - `Favorite channel`
  - `Watch category`

### OSINT provider profile
- `/osint/source/:provider`
- controls:
  - `Favorite provider`
  - `Watch region` for each visible summary region
  - `Watch category` for each visible summary category

## Data model

Reuse existing `SubscriberFeedPreferences`:
- `favoriteChannels`
- `favoriteSources`
- `watchRegions`
- `watchTags`
- `watchCategories`

No schema changes required.

## API model

Reuse:
- `GET /api/subscriber/feed-preferences`
- `POST /api/subscriber/feed-preferences`

Write path:
- load current preferences
- toggle the normalized value in the relevant array
- save the full updated preference object

## UX behavior

- actions are immediate and persisted on click
- controls visually reflect current saved state
- show compact save status text (`Saved`, `Save failed`)
- buttons are disabled while saving

## Normalization rules

- lowercase + trim before comparison and persistence
- dedupe values before saving
- keep sorting stable for deterministic output

## Testing

### Web helper tests
- normalize/toggle/include preference helpers

### Route validation
- source/profile pages consume the existing preference API
- no duplicated preference mutation logic outside the helper

### Existing broad validation
- `typecheck:web`
- relevant web tests

## Implementation order

1. small web helper for normalized preference toggles
2. Telegram source page quick actions
3. OSINT provider page quick actions
4. helper tests + validation
