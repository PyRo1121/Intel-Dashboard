# Subscriber My Alerts Design

## Summary

Build a subscriber-only in-app alerts inbox at `/my-alerts` that turns existing Telegram signal grading, first-reporter logic, OSINT severity, and subscriber preferences into durable alert records.

This is an in-app only feature for v1. No Telegram, email, or push delivery is included.

## Why this feature

`/my-feed` gives subscribers a personalized ranked rail, but it is still pull-based. `My Alerts` adds a push-like experience inside the product by surfacing important matched items immediately when the subscriber opens the app.

This should reuse the existing subscriber preference model and avoid building a separate alert preference system.

## Goals

- Subscriber-only dedicated route: `/my-alerts`
- Durable alert inbox backed by D1
- Alert matching across Telegram and OSINT
- Explainable alert types and matched-preference reasons
- Simple unread/all workflow
- Clean future path to external notifications

## Non-goals

- Telegram, email, browser push, or SMS delivery
- Full notification settings matrix
- Archiving, deleting, or snoozing alerts in v1
- Machine-learned alert relevance

## User model

Only entitled roles can access alerts:
- `owner`
- `subscriber`

Free and trial users receive a hard 403 on private APIs and a gated route experience in the web UI.

## Alert types (v1)

1. `first_report_region`
- A watched region receives a first-report or early-lead event.

2. `high_signal_region`
- A watched region receives a high-signal event.
- For Telegram, this means `signalGrade` `A` or `B`.
- For OSINT, this means `severity` `high` or `critical`.

3. `first_report_channel`
- A favorite Telegram channel produces a first-report or early-lead event.

4. `high_signal_source`
- A favorite OSINT provider produces a high-severity item.

## Data model

Use `INTEL_DB` (D1).

### `subscriber_alert_events`

Columns:
- `id` TEXT PRIMARY KEY
- `user_id` TEXT NOT NULL
- `type` TEXT NOT NULL
- `source_surface` TEXT NOT NULL
- `item_id` TEXT NOT NULL
- `matched_preference` TEXT NOT NULL
- `title` TEXT NOT NULL
- `summary` TEXT NOT NULL
- `link` TEXT NOT NULL
- `source_label` TEXT NOT NULL
- `channel_or_provider` TEXT NOT NULL
- `region` TEXT NOT NULL
- `tags_json` TEXT NOT NULL
- `signal_score` REAL NOT NULL DEFAULT 0
- `signal_grade` TEXT
- `rank_reasons_json` TEXT NOT NULL
- `created_at` TEXT NOT NULL
- `read_at` TEXT

Indexes:
- `(user_id, created_at DESC)`
- `(user_id, read_at, created_at DESC)`
- unique constraint on `(user_id, type, item_id, matched_preference)` to dedupe alert creation

No separate state table is needed in v1 because unread state can be represented by `read_at IS NULL`.

## Preference reuse

Reuse existing subscriber preference tables:
- `subscriber_feed_favorite_channels`
- `subscriber_feed_favorite_sources`
- `subscriber_feed_watch_regions`
- `subscriber_feed_watch_tags`
- `subscriber_feed_watch_categories`

`My Alerts` must not create a second preference schema.

## Matching pipeline

Alert matching is server-side.

### Inputs

Telegram canonical events already provide:
- `signal_score`
- `signal_grade`
- `signal_reasons`
- `first_reporter_channel`
- `source_channels`
- `domain_tags`
- `category`

OSINT items already provide:
- `title`
- `summary`
- `source`
- `timestamp`
- `region`
- `category`
- `severity`

### Matching flow

1. Normalize the candidate event/item into a shared alert-matching shape.
2. Query only the relevant preference sets for matching keys:
   - watched region
   - favorite channel
   - favorite source
3. Produce one alert record per unique `(user_id, type, item_id, matched_preference)`.
4. Insert alerts with idempotent conflict handling.

This avoids fan-out work for unrelated subscribers.

## API contract

### `GET /api/subscriber/my-alerts`

Query params:
- `state=all|unread`
- `limit`

Response:
- `unreadCount`
- `items`

Each item:
- `id`
- `type`
- `sourceSurface`
- `createdAt`
- `readAt`
- `title`
- `summary`
- `link`
- `sourceLabel`
- `channelOrProvider`
- `region`
- `tags`
- `signalScore`
- `signalGrade`
- `rankReasons`
- `matchedPreference`

### `POST /api/subscriber/my-alerts/read`

Body:
- `alertIds: string[]`

Behavior:
- marks the provided alerts read for the current user only

### `POST /api/subscriber/my-alerts/read-all`

Behavior:
- marks all unread alerts for the current user as read

## UI design

Add a new subscriber-only route:
- `/my-alerts`

V1 layout:
- page header
- unread count summary
- `Unread` / `All` filter toggle
- alert cards sorted newest-first
- `Mark read` on each card
- `Mark all read` in the toolbar

Each card shows:
- alert type badge
- source surface badge (`telegram` / `osint`)
- signal grade badge when present
- matched-preference chip
- title and summary
- source/channel/provider
- timestamp
- source link

## Ranking and ordering

Inbox ordering:
1. newest `created_at`
2. higher `signal_score` as secondary tie-breaker

This keeps the inbox readable and predictable.

## Failure behavior

- Matching failures must fail closed for the specific write path and log clearly.
- Read APIs must fail with explicit 5xx/4xx JSON responses, not fake success payloads.
- Mark-read endpoints must only affect the current user’s alerts.

## Testing

### Edge tests
- schema bootstrap for alert tables
- alert matching for each v1 type
- duplicate prevention via unique key strategy
- auth gating for all alert endpoints
- mark-read and mark-all-read behavior

### Web tests
- client normalization helpers
- route state rendering
- unread/all toggle behavior

### Browser coverage
- subscriber can open `/my-alerts`
- unread cards render
- mark-read updates visible state
- free/trial route stays gated

## Implementation order

1. Add D1 schema bootstrap for alert events
2. Add shared alert types/contracts
3. Add edge alert-matching helpers
4. Add alert read/read-all APIs
5. Add `/my-alerts` route and sidebar integration
6. Add tests and browser coverage

## Future expansion

This design intentionally leaves room for:
- delivery channels (Telegram, email, push)
- per-alert-type settings
- source history and alert explanations
- digest views and batching
