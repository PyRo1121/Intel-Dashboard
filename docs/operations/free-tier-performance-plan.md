# Free-Tier Performance Plan (Cloudflare)

Date: 2026-03-04

## Objective

Improve latency and throughput while staying on Cloudflare Workers Free plan.

## Current Architecture (Historical baseline)

- `apps/edge` deployed as `pyrobot-worker`: edge route owner, auth, dashboard shell/static assets.
- `apps/backend` deployed as `intel-dashboard-backend`: API/data pipeline via Service Binding.

This split is preferred over a single Worker because frontend/static delivery stays at edge while backend can be optimized independently.

## Baseline Benchmark (captured)

- Script: `bun run bench:latency`
- Baseline artifact: `benchmarks/free-tier-baseline.json`

Summary snapshot:
- `edge_landing` p50: 16.9ms, p95: 357.3ms
- `edge_auth_me` p50: 14.7ms, p95: 27.9ms
- `edge_telegram_auth_gate` p50: 14.5ms, p95: 19.2ms
- `backend_user_info_auth_gate` p50: 14.7ms, p95: 124.1ms

## Implemented (2026-03-04)

- Backend cron cadence changed from `*/10 * * * *` to `* * * * *` (1-minute ingest tick).
- Backend Smart Placement enabled (`placement.mode = "smart"`).
- RSS rotation window support added (`NEWS_RSS_ROTATION_WINDOW_SECONDS`, default 60s).
- RSS validator caching added (ETag / Last-Modified) with KV-backed validator state to reduce redundant fetch/parsing.
- Source selection upgraded to weighted + region-balanced rotation for better global coverage under capped budgets.
- Free-tier safety caps enforced in code when `FREE_TIER_MODE=true`:
  - max sources/run: `20`
  - max items/source: `12`
- Runtime values now set via Wrangler secrets:
  - `FREE_TIER_MODE=true`
  - `NEWS_RSS_ROTATION_WINDOW_SECONDS=60`
  - `NEWS_RSS_SOURCES_PER_RUN=20`
- `NEWS_RSS_ITEMS_PER_SOURCE=12`
- `NEWS_RSS_VALIDATOR_TTL_SECONDS=1209600`
- Regression tests added for:
  - free-tier ingest cap enforcement
  - rotation-window source selection behavior
  - region diversity under cap
  - validator header reuse
- Benchmark regression gate script added:
  - `bun run bench:assert -- --baseline <file> --candidate <file>`

Post-change benchmark artifacts:
- Immediate after deploy: `benchmarks/free-tier-post-deploy-immediate.json`
- After tuning secrets: `benchmarks/free-tier-post-tuning.json`
- World-class pass 1: `benchmarks/free-tier-post-worldclass-pass1.json`
- World-class pass 2 rerun: `benchmarks/free-tier-post-worldclass-pass2-rerun.json`

## Free-Tier Constraints to Design Around

- 100,000 requests/day (Workers Free)
- 10ms CPU time/invocation (Workers Free)
- 50 external subrequests/invocation (and higher internal CF-service allowance)

## Practical Free-Tier Operating Budget

To avoid breaching free-tier limits, use this ingestion envelope:

- Scheduler cadence: every 1 minute (1,440 invocations/day)
- External source fetches per invocation: <= 40
- Estimated source polls/day: ~57,600
- For 200 sources, average refresh interval: ~5 minutes/source

This is the realistic free-tier window. A 30-second full-rotation over 200+ sources is not feasible on Free plan.

## Optimization Sequence (safe)

1. Keep two-worker topology (no merge).
2. Run benchmark before each change:
   - `bun run bench:latency -- --requests 50 --concurrency 5 --json-out benchmarks/<tag>.json`
   - Guard regressions: `bun run bench:assert -- --baseline benchmarks/free-tier-baseline.json --candidate benchmarks/<tag>.json`
3. Test Smart Placement on backend only (not edge/assets worker), then compare p95/p99.
4. Tighten ingestion budget:
   - Poll only active/high-value sources per minute.
   - Use conditional fetch (`ETag` / `If-Modified-Since`) to cut bandwidth and parse cost.
   - Skip translation/AI when content hash unchanged.
5. Keep strict dedupe before AI gateway calls.

## Success Criteria

- Edge p95 stable or improved.
- Backend API p95 reduced by >= 10% without regression in edge shell latency.
- Daily requests remain below 80% of free-tier quota under normal traffic.
