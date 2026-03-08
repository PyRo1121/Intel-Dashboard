# Intel Dashboard Production Architecture

## Active Services

- `pyrobot-worker` (`/home/pyro1121/Documents/intel-dashboard/worker`)
  - Owns `intel.pyro1121.com/*`
  - Handles OAuth entry/callback/logout
  - Serves built static assets from `.output/public`
  - Serves authenticated dashboard shell routes (`/osint`, `/telegram`, `/map`, `/air-sea`, `/briefings`, `/chat-history`)
  - Proxies data APIs to local Durable Objects or backend service binding
- `intel-dashboard-backend` (`/home/pyro1121/Documents/intel-dashboard/backend`)
  - Billing status/trial/checkout/webhook APIs
  - Source catalog and AI batch orchestration APIs
  - News publish/read APIs and entitlement policy logic

## Routing Model

- Public hostname: `intel.pyro1121.com/*` -> `pyrobot-worker`
- Service binding from `pyrobot-worker` -> `intel-dashboard-backend` (internal worker-to-worker traffic)

## Auth Flow (Current)

1. User starts at `/login` or `/signup`.
2. `pyrobot-worker` sends user to OAuth provider (X/GitHub).
3. Callback writes signed session cookie (`pyrobot_session`) and redirects to `/osint`.
4. Frontend calls `/api/auth/me` for authenticated user payload.
5. If provisional X profile was issued during transient X API failure, worker re-hydrates from short-lived server-side token storage and upgrades session.

## Data/Compute Bindings (Edge Worker)

- Durable Objects:
  - `INTEL_CACHE` (feed cache + cache bust + webhook dedupe)
  - `TELEGRAM_SCRAPER`
- KV:
  - `TELEGRAM_STATE` (telegram state + short-lived provisional X access references)
- R2:
  - `MEDIA_BUCKET`
- Service binding:
  - `INTEL_BACKEND`

## Operational Notes

- Dashboard shell responses are `no-store` to avoid stale HTML/asset manifest mismatch.
- OAuth callback and profile enrichment are timeout-bounded with transient-failure fallback to reduce callback failures.
- Worker tests and typechecks should pass before deploy:
  - `npm run typecheck:worker`
  - `npm run test:worker`
