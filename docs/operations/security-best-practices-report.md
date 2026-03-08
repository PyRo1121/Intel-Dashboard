# Security / Quality Audit Report

Date: 2026-03-04  
Scope: `src/`, `worker/src/`, `backend/src/`, deployment config, test coverage

## Executive Summary

A focused deep-dive was completed on auth, subscription gating, and public data exposure. Three high-risk issues were identified and fixed in code: public backend feed exposure, anonymous delay bypass, and built-in owner fallback defaults. Current test suites are green after the fixes (`worker`: 19/19, `backend`: 49/49).

## Fixed This Pass

### [B-001] Public backend feed endpoints were exposed by default (high, fixed)
- Location: `backend/src/index.ts:6170`, `backend/src/index.ts:6192`
- Risk: direct calls to backend `/api/intel` and `/api/briefings` could bypass normal frontend/session controls.
- Fix:
  - Added explicit route gate `PUBLIC_FEED_ROUTES_ENABLED` (default: `false`): `backend/src/index.ts:104`, `backend/src/index.ts:865`.
  - Routes now return 404 when disabled: `backend/src/index.ts:6171`, `backend/src/index.ts:6193`.
  - Config defaults added in Wrangler for both base and paid envs: `backend/wrangler.jsonc:66`, `backend/wrangler.jsonc:217`.
  - Tests updated/added: `backend/src/index.test.ts:947`, `backend/src/index.test.ts:993`, `backend/src/index.test.ts:1029`.

### [B-002] Anonymous users received instant feeds (subscription delay bypass) (high, fixed)
- Location: `worker/src/index.ts:5217`, `worker/src/index.ts:5132`
- Risk: non-authenticated traffic could consume non-delayed intelligence by skipping entitlement checks.
- Fix:
  - Default delay for non-authenticated requests now enforced (`DEFAULT_NON_SUBSCRIBER_DELAY_MINUTES`) for:
    - Telegram API responses: `worker/src/index.ts:5140`
    - OSINT/Briefings/Air-Sea APIs: `worker/src/index.ts:5219`
  - Delay/tier headers now always set for delay-scoped APIs.

### [B-003] Built-in owner fallback IDs in source code (high, fixed)
- Location: `backend/src/index.ts:94`, `backend/src/index.ts:1069`
- Risk: privileged principals were embedded as fallback values in runtime code.
- Fix:
  - Removed hardcoded fallback owner IDs; default is now empty and owner access comes from configured env only.

### [B-004] Request-body size limits were bypassable for chunked uploads (high, fixed)
- Location: `backend/src/index.ts:2944`, `backend/src/index.ts:5602`
- Risk: reading full request bodies via `request.text()` allowed oversized chunked payloads to be buffered before size enforcement.
- Fix:
  - Added streaming body reader with hard byte cap enforcement (`readRequestBodyWithLimit`) and reused it for JSON/raw parsing.
  - Added regression tests for chunked JSON and raw webhook payload overflow in `backend/src/index.test.ts`.

### [B-005] X profile sync could regress users to placeholder identity on transient X API outages (high, fixed)
- Location: `worker/src/index.ts:1475`, `worker/src/index.ts:1712`, `worker/src/index.ts:5215`
- Risk: intermittent `api.x.com` failures caused repeated synthetic profile fallback (`X Account` / empty avatar), degrading authenticated identity UX and increasing auth latency pressure.
- Fix:
  - Added KV-backed resolved profile cache keyed by user/account (`auth:x_profile_cache:*`) and reuse path for transient sync failures.
  - Hydration now prefers known-good cached identity before synthetic fallback when profile lookup fails.
  - Reduced maximum profile lookup budget from `16s` to `8s` to avoid prolonged auth waits.

### [B-006] Telegram hot state served from KV only (eventual consistency) caused stale/wipe oscillation (high, fixed)
- Location: `worker/src/telegram-scraper-do.ts:471`, `worker/src/telegram-scraper-do.ts:1119`, `worker/src/telegram-scraper-do.ts:1635`, `worker/src/index.ts:5215`
- Risk: relying solely on global KV for previous/current state allowed stale snapshots to reappear, producing apparent feed rollback between scrapes.
- Fix:
  - Added canonical state persistence in DO storage (`latest_state_json`) and a new `/state` endpoint.
  - Worker `/api/telegram` now reads DO state first and falls back to KV only if needed.
  - Scrape cycle now writes canonical state to DO storage and mirrors to KV.

### [B-007] Removed unreachable legacy OAuth implementation from edge worker (medium, fixed)
- Location: `worker/src/index.ts` (legacy custom OAuth handlers and token helpers removed)
- Risk: dead auth code increased maintenance surface and elevated regression risk by keeping obsolete flows beside the active better-auth implementation.
- Fix:
  - Removed old custom GitHub/X OAuth route handlers and related unused signing/token helper code.
  - Kept active behavior anchored to better-auth routes only (`/auth/*` + legacy `/oauth/*` rewrites).
  - Expanded e2e coverage to guard legacy-route redirects and auth probe cookie clearing (`e2e/smoke.test.mjs`).

## Residual Risks / Follow-Ups

### [R-001] Owner IDs remain in Wrangler vars (operational visibility risk)
- Location: `backend/wrangler.jsonc:82`, `backend/wrangler.jsonc:233`
- Note: these are identifiers, not secrets, but still reveal privileged principals in config.
- Recommendation: keep owner mapping in environment-specific secret/config management if you want to reduce exposure in source-managed files.

### [R-002] Signed user-id verification is off by default
- Location: `backend/wrangler.jsonc:36`, `backend/wrangler.jsonc:186`
- Note: this is a policy choice, not a bug. Leaving `REQUIRE_SIGNED_USER_ID=false` allows caller-supplied user IDs as long as bearer token checks are correct.
- Recommendation: enable for stricter identity assurance on backend RPCs that depend on userId trust.

### [R-003] Local env plaintext secret risk (mitigated)
- Location: `.env` now contains guidance only (no key/value assignments).
- Note: runtime secrets were migrated to Wrangler secrets and a policy check now fails CI if plaintext env assignments are reintroduced.
- Recommendation: keep using Wrangler secrets exclusively for runtime credentials.

## Code Hygiene Snapshot

- `TODO/FIXME/XXX/HACK` markers: no actionable markers found in runtime code.
- Placeholder/stub scan: only UI placeholders and legitimate DO stub naming patterns found; no blocked production stubs detected.

## Validation

- `bun run typecheck` passed
- `bun run typecheck:edge` passed
- `bun run test:edge` passed (19/19)
- `bun run test:backend` passed (49/49)
- `bun run test:backend` passed (51/51)

## Dependency Audit Snapshot

- Root production dependency audit now reports `0` vulnerabilities after lockfile refresh and dependency overrides for vulnerable transitives.
- Worker production dependency audit now reports `0` vulnerabilities after `better-auth` patch update and lock refresh.
- Backend production dependency audit remains clean (`0` vulnerabilities).

Recommended actions:
1. Keep `bun audit` and `bun audit --cwd apps/edge` in the release checklist.
2. Keep backend dependency surface minimal and rerun `bun audit` after each dependency change.
3. Re-run full regression (`test:all` + authenticated e2e) before each production deploy.
