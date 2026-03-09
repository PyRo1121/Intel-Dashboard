# Subscriber My Feed Design

## Goal
Build a subscriber-only personalized `My Feed` that combines Telegram and OSINT into one ranked intelligence rail.

## Product shape
- dedicated route: `/my-feed`
- subscriber-only access
- default view combines Telegram + OSINT together
- in-app only v1; no external notifications

## Why this approach
- turns premium signal work into a personal product surface
- avoids separate per-surface preference systems
- creates the right foundation for `My Alerts` later
- keeps ranking logic authoritative on the server

## Approach
Use a server-side unified feed.

The backend/edge layer should:
- read subscriber preferences from D1
- fetch Telegram canonical events and OSINT items from their existing authoritative pipelines
- normalize them into one shared feed item contract
- apply preference-aware ranking boosts
- return a single ordered payload to the web route

## Preference model
Store durable preferences in D1.

Tables:
- `subscriber_feed_preferences`
  - `user_id`
  - `updated_at`
- `subscriber_feed_favorite_channels`
  - `user_id`
  - `channel`
- `subscriber_feed_favorite_sources`
  - `user_id`
  - `source`
- `subscriber_feed_watch_regions`
  - `user_id`
  - `region`
- `subscriber_feed_watch_tags`
  - `user_id`
  - `tag`
- `subscriber_feed_watch_categories`
  - `user_id`
  - `category`

## Feed contract
`GET /api/subscriber/my-feed`

Response:
- `preferences`
- `items`

Each item should contain:
- `id`
- `sourceSurface` (`telegram` or `osint`)
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

## Preference APIs
- `GET /api/subscriber/feed-preferences`
- `POST /api/subscriber/feed-preferences`

## Ranking model
Telegram base score:
- existing `signal_score`

OSINT base score:
- existing severity/priority/freshness weighting

Preference boosts:
- favorite source/channel: `+18`
- watched region: `+10`
- watched tag/category: `+8`

Clamp final `combinedScore` to `0..100`.

## UI
- new route `/my-feed`
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
- free and trial denied

## Testing
- D1 preference CRUD tests
- auth gating tests
- ranking tests for mixed Telegram/OSINT items
- browser route test for `/my-feed`

## Non-goals for v1
- push/email/Telegram notifications
- full source history pages
- multi-user collaboration on preferences
