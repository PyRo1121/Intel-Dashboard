# Telegram Collector

Cloudflare Container-backed runtime scaffold for a future MTProto Telegram collector.

Current scope:
- boots a minimal containerized runtime
- exposes `/health` and `/status`
- exposes `/push-batch` on the Worker to forward normalized collector batches into the existing edge intake route:
  - `/api/telegram/collector-ingest`
- forwards text/caption payloads only; MTProto media assets remain scraper-backed until the collector has an upload path

Required configuration before live forwarding:
- `COLLECTOR_EDGE_URL`
- `COLLECTOR_SHARED_SECRET`
- optionally `COLLECTOR_EDGE_PATH`

Future MTProto runtime requirements:
- `TELEGRAM_API_ID`
- `TELEGRAM_API_HASH`
- `TELEGRAM_SESSION_STRING`

## Generating TELEGRAM_SESSION_STRING

Use the local bootstrap script with a dedicated collector account:

```bash
cd apps/telegram-collector
TELEGRAM_API_ID=123456 \
TELEGRAM_API_HASH=your_api_hash \
bun run generate-session
```

Optional:

```bash
TELEGRAM_PHONE_NUMBER=+15551234567
```

The script will prompt for:
- phone number if not preset
- Telegram login code
- 2FA password if enabled

It prints the resulting `TELEGRAM_SESSION_STRING`, which should be stored as a secret on the deployed collector.

This scaffold does not cut over Telegram ingestion yet. It provides the Cloudflare Container shape and forwarding contract the collector runtime will use.
