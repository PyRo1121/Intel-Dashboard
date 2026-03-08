# SentinelStream Intel Dashboard Workspace

This folder is the consolidated Cloudflare workspace for SentinelStream (Intel Dashboard).

- `apps/edge/` - production edge gateway (`intel.pyro1121.com/*`), auth, asset serving, API orchestration, cache/scraper Durable Objects
- `apps/backend/` - backend API worker (billing, source catalog, AI jobs, feed aggregation)
- `apps/web/` - frontend application code (SolidStart)
- `packages/shared/` - shared product and platform modules

Use this directory as the single review point for security hardening, Cloudflare configuration, and latency optimization.

AI execution now supports both sync and async modes:

- Sync jobs: `POST /api/intel-dashboard/ai/jobs`
- Async jobs: `POST /api/intel-dashboard/ai/jobs` with `{"async": true, "jobs": [...]}`
- Batch status pull: `GET /api/intel-dashboard/ai/jobs?batchId=<id>`

Concurrency is environment-bounded at 10-20 parallel AI operations via `AI_PIPELINE_MAX_CONNECTIONS`, and async queue processing uses the `AI_JOB_QUEUE` binding.

For current route ownership and runtime flow, see `ARCHITECTURE_INTEL_BACKEND.md`.
