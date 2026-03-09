# Subscriber Alert Controls Design

## Summary

Add compact subscriber alert controls inside `/my-alerts`.

This should not become a separate settings system. It should extend the existing subscriber preference model with a small alert-control layer that lets subscribers decide which alert types they want to receive and how strict high-signal Telegram alerts should be.

## Goals

- Keep controls inside `/my-alerts`
- Persist controls in D1
- Reuse the current alert pipeline
- Let subscribers enable/disable alert types individually
- Let subscribers choose the minimum Telegram grade used for high-signal region alerts

## Non-goals

- Separate settings route
- Delivery channels (Telegram/email/push)
- Per-source override matrices
- Archive/snooze rules

## V1 Controls

Boolean toggles:
- `firstReportRegionEnabled`
- `highSignalRegionEnabled`
- `firstReportChannelEnabled`
- `highSignalSourceEnabled`

Threshold:
- `minimumTelegramHighSignalGrade`
  - `A`
  - `B`

Meaning:
- `A` means only grade `A` Telegram events qualify for `high_signal_region`
- `B` means grade `A` or `B` Telegram events qualify

## Storage

Add D1 table:
- `subscriber_alert_preferences`

Columns:
- `user_id` TEXT PRIMARY KEY
- `first_report_region_enabled` INTEGER NOT NULL DEFAULT 1
- `high_signal_region_enabled` INTEGER NOT NULL DEFAULT 1
- `first_report_channel_enabled` INTEGER NOT NULL DEFAULT 1
- `high_signal_source_enabled` INTEGER NOT NULL DEFAULT 1
- `minimum_telegram_high_signal_grade` TEXT NOT NULL DEFAULT 'B'
- `updated_at` TEXT NOT NULL

## API contract

### `GET /api/subscriber/alert-preferences`
Returns the current subscriber alert controls.

### `POST /api/subscriber/alert-preferences`
Replaces the current subscriber alert controls.

Payload:
- `firstReportRegionEnabled`
- `highSignalRegionEnabled`
- `firstReportChannelEnabled`
- `highSignalSourceEnabled`
- `minimumTelegramHighSignalGrade`

## Matching changes

The existing alert generation stays deterministic.

Before writing an alert:
- check whether that alert type is enabled
- for Telegram `high_signal_region`, require:
  - grade `A` if preference is `A`
  - grade `A` or `B` if preference is `B`

Do not add more control dimensions in v1.

## UI

Location:
- top section inside `/my-alerts`

Controls:
- four toggles for alert types
- one compact grade selector for Telegram high-signal region alerts
- one save button
- one small saved/error message area

## Testing

### Edge
- preference normalization
- default preference fallback
- GET/POST alert preference APIs
- alert matching obeys disabled types
- alert matching obeys Telegram high-signal grade threshold

### Web
- client read/write helpers
- `/my-alerts` renders controls
- save path updates state correctly

### Browser
- subscriber can change alert controls and save them
- controls persist across refresh

## Implementation order

1. shared alert-control type
2. D1 schema + edge load/save helpers
3. alert matching updates
4. alert-controls API
5. `/my-alerts` controls UI
6. tests and browser coverage
