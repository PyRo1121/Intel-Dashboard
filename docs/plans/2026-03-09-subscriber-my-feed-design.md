# Subscriber My Feed Design

## Goal
Build a subscriber-only personalized `/my-feed` that combines Telegram and OSINT into one ranked intelligence rail.

## Product shape
- dedicated route: `/my-feed`
- subscriber-only access
- default view combines Telegram + OSINT
- in-app only v1

## Architecture
Use an edge-owned unified feed.

The edge worker will:
- read subscriber preferences from `INTEL_DB`
- load Telegram canonical events from the existing Telegram feed pipeline
- load OSINT items from the existing intel feed pipeline
- normalize both into one shared feed item contract
- apply favorite/watch boosts and return one ordered list

## Preference model
D1 tables:
- `subscriber_feed_preferences`
- `subscriber_feed_favorite_channels`
- `subscriber_feed_favorite_sources`
- `subscriber_feed_watch_regions`
- `subscriber_feed_watch_tags`
- `subscriber_feed_watch_categories`

## API
- `GET /api/subscriber/feed-preferences`
- `POST /api/subscriber/feed-preferences`
- `GET /api/subscriber/my-feed?scope=all|favorites|watched|telegram|osint&limit=n`

## Feed item contract
Each item contains:
- `id`
- `sourceSurface`
- `timestamp`
- `title`
- `summary`
- `link`
- `sourceLabel`
- `channelOrProvider`
- `severity`
- `region`
- `tags`
- `signalScore`
- `signalGrade`
- `rankReasons`
- `favoriteMatch`
- `watchMatch`
- `combinedScore`

## Ranking
Telegram base:
- existing `signal_score`

OSINT base:
- existing severity/priority/freshness weighting

Boosts:
- favorited channel/source: `+18`
- watched region: `+10`
- watched tag/category: `+8`

Clamp final score to `0..100`.

## UI
- new subscriber-only route `/my-feed`
- controls:
  - `All`
  - `Favorites`
  - `Watched`
  - `Telegram`
  - `OSINT`
- badges:
  - `Favorite match`
  - `Watched region`
  - `A/B signal`

## Auth
- owner and subscriber allowed
- free and trial denied with explicit 403

## Testing
- D1 preference CRUD tests
- auth gating tests
- normalization/ranking tests for mixed Telegram + OSINT items
- browser route test for `/my-feed`

## Non-goals
- external notifications
- full source history pages
- collaborative/shared preferences
