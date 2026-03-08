# Security + Latency Checklist

## Security Controls (Current)

- Owner override is explicit and controlled via `OWNER_USER_IDS`.
- Sharded ingest fallback is disabled by default (`NEWS_COORDINATOR_ALLOW_FALLBACK=false`) to avoid cross-shard race regressions.
- Rate limiting is native Cloudflare (`ratelimits`) per tier with KV fallback.
- X OAuth callback uses PKCE + state cookie validation and signed session cookies in auth worker source.
- Stripe webhooks are signed and idempotent with out-of-order event protection.

## Latency Controls (Current)

- Durable Object sharded ingest for concurrent scraper writes.
- KV shard read fan-in with hot-overlay reads from coordinator.
- In-memory feed cache in worker isolates (`NEWS_READ_CACHE_MS`).
- Async outbound fanout (`OUTBOUND_ASYNC=true`) to keep publish acknowledgements fast.
- AI pipeline concurrency bounded per environment (`AI_PIPELINE_MAX_CONNECTIONS=10` default, `20` paid) with queue-backed async Groq batch processing and tuned timeout (`AI_GATEWAY_TIMEOUT_MS=8000`).

## Recommended Ongoing Hardening

1. Keep auth worker and backend worker source in this workspace as the only production source of truth.
2. Rotate `AUTH_SECRET`, `X_CLIENT_SECRET`, Stripe secrets quarterly.
3. Monitor p95 and p99 for:
   - `/api/intel-dashboard/news`
   - `/api/intel-dashboard/news/publish`
   - `/auth/x/callback`
4. Set alerts on callback 5xx spikes and coordinator 503 publish failures.
5. Keep shard counts proportional to active scraper groups and adjust `NEWS_HOT_OVERLAY_SHARD_FANOUT` for read latency vs cost.
