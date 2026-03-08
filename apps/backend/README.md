# Intel Dashboard Backend (Cloudflare Worker)

This backend runs as a standalone Cloudflare Worker from `apps/backend`.

## Endpoints

- Usage RPC: `POST /api/intel-dashboard/usage-data-source`
- Seed writes: `POST /api/intel-dashboard/usage-data-source/seed`
- News feed (gated): `POST /api/intel-dashboard/news`
- News publish (admin): `POST /api/intel-dashboard/news/publish`
- Billing status: `POST /api/intel-dashboard/billing/status`
- Feature gates snapshot: `POST /api/intel-dashboard/feature-gates`
- User info/profile: `GET|POST /api/intel-dashboard/user-info`
- Owner CRM customer drill-down: `POST /api/intel-dashboard/admin/crm/customer`
- Owner CRM subscription cancel: `POST /api/intel-dashboard/admin/crm/cancel-subscription`
- Owner CRM refund: `POST /api/intel-dashboard/admin/crm/refund`
- Sources catalog: `GET|POST /api/intel-dashboard/sources`
- AI jobs (admin, batch): `POST /api/intel-dashboard/ai/jobs`
- Billing start trial: `POST /api/intel-dashboard/billing/start-trial`
- Billing subscribe/cancel (admin): `POST /api/intel-dashboard/billing/subscribe`
- Billing checkout session: `POST /api/intel-dashboard/billing/checkout`
- Billing Stripe webhook: `POST /api/intel-dashboard/billing/webhook`
- Outbound publish with dedupe: `POST /api/intel-dashboard/outbound/publish`

## Auth

- `USAGE_DATA_SOURCE_TOKEN` protects usage RPC.
- `USAGE_ADMIN_TOKEN` protects seed endpoint.
- `USAGE_DATA_SOURCE_TOKEN` also protects user news/billing status routes.
- `USAGE_DATA_SOURCE_TOKEN` also protects `user-info`, feature-gates, sources, and checkout routes.
- `BILLING_ADMIN_TOKEN` (optional) protects admin routes (`news/publish`, `billing/subscribe`).
  - If not set, admin routes fall back to `USAGE_ADMIN_TOKEN`.
- Stripe secrets (required for checkout/webhook):
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
  - `STRIPE_PRICE_ID`
  - `STRIPE_SUCCESS_URL`
  - `STRIPE_CANCEL_URL`
- Stripe live CRM metrics (optional, recommended for owner dashboard accuracy):
  - `CRM_STRIPE_LIVE_ENABLED` (default `true`)
  - `CRM_STRIPE_SYNC_TIMEOUT_MS` (default `8000`)
  - `CRM_STRIPE_MAX_SUBSCRIPTIONS` (default `5000`)

## Storage Mode

- `USAGE_STORAGE_MODE=kv` (default): serve usage from KV binding `USAGE_KV`.
- `USAGE_STORAGE_MODE=backend`: proxy to an upstream backend URL.

## Performance Tuning Vars

- `USAGE_MAX_REQUEST_BYTES` (default `1048576`): request body hard limit for API and seed routes.
- `USAGE_CACHE_TTL_SECONDS` (default `30`): edge cache TTL for KV-read API responses.
- `USAGE_CACHE_NAMESPACE` (default `usage-rpc-v1`): cache namespace tag in cache keys.
- `USAGE_CACHE_WARM_ENABLED` (default `true`): enables scheduled cache warmups.
- `USAGE_CACHE_WARM_WINDOWS_DAYS` (default `1,7,30`): day windows prewarmed by cron.
- `USAGE_BACKEND_MAX_RETRIES` (default `1`): retry count for transient backend failures.
- `USAGE_BACKEND_TIMEOUT_MS` (default `10000`): per-attempt backend timeout.
- `USAGE_SEED_ASYNC` (default `true` in this backend): queue seed writes instead of inline KV writes.
- `USAGE_SEED_ASYNC_BATCH_SIZE` (default `100`): queue publish batch size.
- `USAGE_ANALYTICS_SAMPLE_RATE` (default `1`): Analytics Engine sampling ratio for request telemetry.
- `FREE_RATE_LIMIT_PER_MINUTE` (default `60`): per-user, per-minute request cap for free tier API routes.
- `TRIAL_RATE_LIMIT_PER_MINUTE` (default `180`): per-user, per-minute request cap for trial tier.
- `SUBSCRIBER_RATE_LIMIT_PER_MINUTE` (default `600`): per-user, per-minute request cap for subscriber tier.
- `FREE_NEWS_MAX_ITEMS` (default `50`): max news items returned to free users.
- `TRIAL_NEWS_MAX_ITEMS` (default `100`): max news items returned to trial users.
- `SUBSCRIBER_NEWS_MAX_ITEMS` (default `200`): max news items returned to subscribers.
- `NEWS_FEED_MAX_ITEMS` (default `3000`): hard cap for stored feed entries to keep publish/get latency predictable.
- `NEWS_READ_CACHE_MS` (default `200`): per-isolate in-memory feed cache TTL to reduce KV read latency spikes.
- `NEWS_COORDINATOR_ENABLED` (default `true`): enables Durable Object coordinated ingest for atomic publish ordering and dedupe.
- `NEWS_COORDINATOR_NAME` (default `global`): coordinator object name used to shard/route publish coordination.
- `NEWS_COORDINATOR_SHARD_COUNT` (default `4`): number of coordinator shards for publish parallelism under many scrapers.
- `NEWS_COORDINATOR_ALLOW_FALLBACK` (default `false` in deployed envs): when `false`, publish returns `503` if coordinator is unavailable instead of risking cross-shard fallback writes.
- `OWNER_USER_IDS` (default `PyRo1121`): comma-separated user IDs always treated as entitled owner/admin in user-info and paid gating logic.
- `NEWS_HOT_OVERLAY_ENABLED` (default `true`): enables entitled-read hot overlay from coordinator to reduce KV propagation lag.
- `NEWS_HOT_OVERLAY_LIMIT` (default `250`): max hot entries maintained/read from coordinator overlay.
- `NEWS_HOT_OVERLAY_SHARD_FANOUT` (default `4`): number of coordinator shards queried for entitled hot overlay reads.
- `NEWS_HOT_OVERLAY_TIMEOUT_MS` (default `350`): timeout budget for coordinator hot-overlay reads.
- `BILLING_ALLOW_RETRIAL` (default `false`): controls whether users can restart trial after first use.
- `REQUIRE_SIGNED_USER_ID` (default `false`): when `true`, user-facing routes require a valid `userSig` HMAC for `userId`.
- `OUTBOUND_DEDUPE_TTL_SECONDS` (default `604800`): outbound dedupe key TTL (seconds).
- `OUTBOUND_DELIVERY_TIMEOUT_MS` (default `10000`): timeout for each outbound delivery call.
- `OUTBOUND_NAMESPACE_PREFIX` (default `intel-dashboard:outbound`): KV namespace prefix for dedupe keys.
- `OUTBOUND_ASYNC` (default `true`): run outbound fanout in `waitUntil` for faster publish response latency.
- `CRM_STRIPE_LIVE_ENABLED` (default `true`): enables owner CRM revenue/subscriber sync from Stripe subscription API.
- `CRM_STRIPE_SYNC_TIMEOUT_MS` (default `8000`): timeout per Stripe CRM sync page request.
- `CRM_STRIPE_MAX_SUBSCRIPTIONS` (default `5000`): upper bound of Stripe subscriptions scanned per CRM refresh.

## AI Gateway Dedupe (optional)

When enabled, outbound dedupe uses AI Gateway to derive a normalized dedupe key before delivery.

- `AI_GATEWAY_URL`: full AI Gateway chat-completions URL.
- `AI_GATEWAY_TOKEN` (optional): bearer token sent to the gateway.
- `AI_JOBS_ADMIN_TOKEN` (optional): dedicated bearer token for `/api/intel-dashboard/ai/jobs`; falls back to the existing admin token if unset.
- `AI_GATEWAY_MODEL` (default `cerebras/gpt-oss-120b`): default text model passed in request body.
- `AI_GATEWAY_TEXT_URL` / `AI_GATEWAY_TEXT_MODEL` (optional): override URL/model for the standard text lane.
- `AI_GATEWAY_MEDIA_URL` / `AI_GATEWAY_MEDIA_MODEL` (optional, default model `groq/meta-llama/llama-4-scout-17b-16e-instruct`): route true media-aware dedupe through Groq Scout.
- `AI_GATEWAY_ESCALATION_URL` / `AI_GATEWAY_ESCALATION_MODEL` (optional, default model `cerebras/zai-glm-4.7`): route rare hard-case dedupe escalations to a heavier reasoning model.
- `AI_GATEWAY_TIMEOUT_MS` (default `3000`): AI request timeout for high-throughput batch and sync AI jobs.
- `AI_GATEWAY_CACHE_TTL_SECONDS` (default `600`): gateway cache TTL applied to deterministic AI requests.
- `AI_GATEWAY_CACHE_TTL_DEDUPE_SECONDS` (default `604800`): cache TTL override for dedupe-key generation.
- `AI_GATEWAY_CACHE_TTL_TRANSLATE_SECONDS` (default `2592000`): cache TTL override for deterministic text translation.
- `AI_GATEWAY_CACHE_TTL_CLASSIFY_SECONDS` (default `604800`): cache TTL override for classification jobs.
- `AI_GATEWAY_CACHE_TTL_NEWS_ENRICH_SECONDS` (default `86400`): cache TTL override for news enrichment.
- `AI_GATEWAY_CACHE_TTL_BRIEFING_SECONDS` (default `21600`): cache TTL override for briefing generation.
- `AI_GATEWAY_MAX_ATTEMPTS` (default `1`): gateway retry attempts (`1` minimizes duplicate token usage).
- `AI_GATEWAY_RETRY_DELAY_MS` (default `250`): retry delay when attempts > 1.
- `AI_GATEWAY_BACKOFF` (default `exponential`): retry backoff strategy (`exponential` or `linear`).
- `AI_GATEWAY_COLLECT_LOG` (default `false`): controls `cf-aig-collect-log` header for request logging.
- `AI_DEDUPE_ESCALATION_ENABLED` (default `true`): enables text/media dedupe fallback to the escalation lane before deterministic hashing.
- `AI_DEDUPE_MEDIA_MAX_IMAGES` (default `3`): maximum image URLs attached to media-aware dedupe prompts.
- `AI_PIPELINE_MAX_CONNECTIONS` (default `10`, paid env `20`): shared max parallel AI connections used by both outbound dedupe and `/ai/jobs` pipelines.
- `AI_BATCH_PROVIDER` (default `internal`): async AI jobs run through queue-backed internal concurrency and still use AI Gateway for model execution. Legacy `groq` batch mode remains available.
- `AI_BATCH_POLL_DELAY_SECONDS` (default `60`): initial delay before polling Groq batch status.
- `USAGE_DATA_SOURCE_TOKEN` (required): backend fails closed with HTTP 500 if missing on protected API routes.

AI jobs route supports concurrent batch execution for:
- `dedupe` (stable dedupe key generation, with automatic media lane routing when image URLs are present and optional escalation)
- `translate` (text translation)
- `classify` (single-label classification)

If AI Gateway is unset or fails, the worker falls back to deterministic SHA-256 hashing of canonicalized payloads.

## Worker Pipeline Enabled

- Smart Placement (`placement.mode = smart`) for latency-sensitive execution.
- Cloudflare Queue for async AI batch execution:
  - producer binding `AI_JOB_QUEUE`
  - consumer queue `intel-dashboard-ai-jobs`
  - dead-letter queue `intel-dashboard-ai-jobs-dlq`
- Scheduled cron warmups (`triggers.crons`) to prefill edge cache from KV.

## Near-Instant Scraper Ingest

- `news/publish` uses a Durable Object coordinator (`NewsIngestCoordinator`) for single-writer, atomic feed merge under concurrent scraper bursts.
- Publish routing can shard by key (`shardKey` in publish body) to distribute scraper load across coordinator objects.
- Coordinator writes feed updates to KV and response path remains low-latency with in-memory feed cache + binary-search unlock lookup.
- Entitled news reads can overlay coordinator hot entries to return freshest stories before global KV propagation settles.
- Outbound fanout can run asynchronously (`OUTBOUND_ASYNC=true`) so ingest ACK is not blocked on channel delivery.

## Source Catalog API

- `GET /api/intel-dashboard/sources` (or `POST` with JSON body) returns curated global conflict/OSINT source metadata.
- Supported filters: `q`, `category`, `region`, `language`, `tags`, `limit`.
- Route is protected by `USAGE_DATA_SOURCE_TOKEN`.

## KV Key Schema

- `intel-dashboard:usage:session-meta:<agentId>:<sessionId>`
- `intel-dashboard:usage:discover:<startMs>:<endMs>`
- `intel-dashboard:usage:cost-summary:<startMs>:<endMs>`
- `intel-dashboard:usage:session-cost:<agentId>:<sessionId>:<startMs>:<endMs>`
- `intel-dashboard:usage:session-timeseries:<agentId>:<sessionId>`
- `intel-dashboard:usage:session-logs:<agentId>:<sessionId>`
- `intel-dashboard:usage:news:feed`
- `intel-dashboard:usage:news:feed:shard:<coordinatorShard>` (enabled when `NEWS_COORDINATOR_SHARD_COUNT > 1`)
- `intel-dashboard:billing:account:<userId>`
- `intel-dashboard:outbound:dedupe:<scope>:<channel>:<fingerprint>`

Read aggregation behavior:
- The Worker reads and merges all shard feed keys (plus legacy base feed key) for low-risk migration compatibility.
- Writes are shard-local in the coordinator path, preventing cross-shard overwrite races under concurrent scraper ingest.

## Paid Product Rules

- Non-subscribers: news is delayed by `90` minutes (`NEWS_DELAY_MINUTES`).
- Trial: `7` days (`BILLING_TRIAL_DAYS`).
- Trial retrial: disabled by default (`BILLING_ALLOW_RETRIAL=false`).
- Subscription metadata: `$8/month` (`BILLING_MONTHLY_PRICE_USD`).
- Billing state is KV-backed and enforced directly in Worker routes.
- Tier policy is enforced in-worker for request rate limits and news-item caps.

## Stripe Integration

- Checkout creation route (`billing/checkout`) creates Stripe subscription Checkout Sessions.
- Webhook route (`billing/webhook`) verifies `Stripe-Signature` using HMAC SHA-256 with timestamp tolerance and applies idempotent processing using KV event keys.
- Supported status updates:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Set Stripe secrets in Cloudflare:

```bash
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
wrangler secret put STRIPE_PRICE_ID
wrangler secret put STRIPE_SUCCESS_URL
wrangler secret put STRIPE_CANCEL_URL
wrangler secret put CRM_STRIPE_LIVE_ENABLED
wrangler secret put CRM_STRIPE_SYNC_TIMEOUT_MS
wrangler secret put CRM_STRIPE_MAX_SUBSCRIPTIONS
```

### Stripe CLI setup (subscriber activation with BetterAuth)

1. Ensure worker-to-backend entitlement auth is configured (same token value as backend):

```bash
wrangler secret put USAGE_DATA_SOURCE_TOKEN --config worker/wrangler.toml
```

2. Start Stripe CLI listener and forward only subscription events to the edge webhook:

```bash
stripe listen \
  --forward-to https://intel.pyro1121.com/api/webhooks/stripe \
  --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted
```

3. Copy the webhook signing secret printed by `stripe listen` (`whsec_...`) and set it on backend:

```bash
wrangler secret put STRIPE_WEBHOOK_SECRET --config backend/wrangler.jsonc
```

4. Trigger verification events:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

5. BetterAuth user identity requirement:
- Use the BetterAuth `user.id` as billing `userId` for checkout/session requests.
- `billing/checkout` stores this value in Stripe `client_reference_id` and metadata, and webhook processing maps subscription state back to the same user key.

Optional AI Gateway secrets:

```bash
wrangler secret put AI_GATEWAY_TOKEN
wrangler secret put USER_ID_SIGNING_SECRET
```

Cloudflare native rate-limit bindings are configured per tier in `wrangler.jsonc` for stronger consistency than KV counters:

- `FREE_TIER_RATE_LIMIT_BINDING`
- `TRIAL_TIER_RATE_LIMIT_BINDING`
- `SUBSCRIBER_TIER_RATE_LIMIT_BINDING`

If a binding is missing in a given environment, the worker safely falls back to KV-backed per-minute counters.

## Setup

1. Create KV namespaces and set IDs in `wrangler.jsonc` under `kv_namespaces` binding `USAGE_KV`.
2. Create queue infrastructure:
   - `wrangler queues create intel-dashboard-ai-jobs`
   - `wrangler queues create intel-dashboard-ai-jobs-dlq`
3. Set secrets:
   - `wrangler secret put USAGE_DATA_SOURCE_TOKEN`
   - `wrangler secret put USAGE_ADMIN_TOKEN`
4. Deploy:
  - `bun run deploy:backend`

Durable Object migrations are declared in `wrangler.jsonc` and applied by Wrangler during deploy.

5. Optional outbound dedupe route usage (admin token required):

```json
{
  "entries": [
    {
      "id": "news-123",
      "title": "Headline",
      "url": "https://example.com/story",
      "publishedAtMs": 1767340000000
    }
  ],
  "targets": [
    {
      "channel": "telegram",
      "endpointUrl": "https://example-relay.workers.dev/send",
      "method": "POST",
      "headers": { "authorization": "Bearer relay-token" }
    }
  ],
  "dedupeScope": "global-news",
  "dedupeTtlSeconds": 604800
}
```

### Free-tier lowest-latency profile (default)

Default deploy (`bun run deploy:backend`) is optimized for free-tier efficiency:

- KV mode enabled
- cache TTL set high (`USAGE_CACHE_TTL_SECONDS=900`)
- async seed disabled (`USAGE_SEED_ASYNC=false`) to avoid queue dependency
- analytics sampling disabled (`USAGE_ANALYTICS_SAMPLE_RATE=0`)
- cron warmups every 15 minutes

Use this profile when minimizing platform feature dependencies and keeping latency stable on free plans.

### Paid profile (optional)

Deploy uses the single production profile only (`bun run deploy:backend`).

## Seed Existing Data

Prepare a JSON file with an array of seed entries:

```json
[
  {"key":"intel-dashboard:usage:cost-summary:1709251200000:1709337599999","value":{"updatedAt":1709337600000,"days":1,"daily":[],"totals":{}}}
]
```

Seed with:

```bash
bun run --cwd apps/backend seed -- --worker-base-url "https://intel.pyro1121.com/api/intel-dashboard" --admin-token "<USAGE_ADMIN_TOKEN>" --entries-file ./entries.json
```

With `USAGE_SEED_ASYNC=true`, this endpoint returns accepted/queued counts and queue consumers perform KV writes.

## Verify

- `bun run --cwd apps/backend test`
- `bun run --cwd apps/backend typecheck`
- `bun run --cwd apps/backend build` (dry-run deploy)

## Benchmark (Target vs Baseline)

Run a single target benchmark:

```bash
bun run --cwd apps/backend bench:usage -- --base-url "https://intel.pyro1121.com/api/intel-dashboard" --token "<USAGE_DATA_SOURCE_TOKEN>" --requests 300 --concurrency 20
```

Compare against your legacy endpoint:

```bash
bun run --cwd apps/backend bench:usage -- --base-url "https://intel.pyro1121.com/api/intel-dashboard" --token "<NEW_TOKEN>" --compare-base-url "https://<legacy-endpoint>" --compare-token "<OLD_TOKEN>" --requests 300 --concurrency 20
```

Use this to gate cutover on p95/p99 latency and failure deltas.

## Cloudflare Runtime Types

- Runtime binding types are generated into:
  - `apps/edge/worker-configuration.d.ts`
  - `apps/backend/worker-configuration.d.ts`
- Regenerate after changing Wrangler config:

```bash
bun run typegen:cf
```

- Verify the committed generated files are still in sync:

```bash
bun run check:typegen
```
