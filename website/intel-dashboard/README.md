# Intel Dashboard

Unified frontend + edge worker + backend worker stack for `intel.pyro1121.com`.

## Workspace Layout

- `/home/pyro1121/Documents/intel-dashboard/src` - SolidStart frontend
- `/home/pyro1121/Documents/intel-dashboard/worker` - production edge worker (`intel.pyro1121.com/*`)
- `/home/pyro1121/Documents/intel-dashboard/backend` - backend API worker

## Local Commands

```bash
npm run dev
npm run typecheck
npm run typecheck:worker
npm run test:worker
npm run test:e2e
npm run test:all
npm run build
npm run billing:stripe:setup -- --help
```

## E2E + TDD Gate

- Default smoke E2E: `npm run test:e2e`
- Browser-authenticated smoke E2E: `npm run test:e2e:browser`
- Full strict E2E (fails if auth vars are missing): `npm run test:e2e:strict`
- Full test gate (typecheck + worker tests + backend tests + fetch e2e + browser e2e): `npm run test:all`
- Full live gate (requires authenticated/backend secrets and fails if any are missing): `npm run test:all:live`
- Full strict gate (for CI/CD): `npm run test:all:strict`

Optional strict E2E env vars:

```bash
export E2E_BACKEND_TOKEN="<USAGE_DATA_SOURCE_TOKEN>"
export E2E_SESSION_COOKIE="pyrobot_session=<cookie-value>"
export E2E_SIGNOUT_SESSION_COOKIE="pyrobot_session=<separate-cookie-value>"
export E2E_USER_ID="PyRo1121"
export E2E_EXPECT_DELAY_MINUTES="0"
export E2E_EXPECT_TIER="subscriber"
```

Cloudflare-style local secret file flow:

```bash
npm run e2e:save-secrets
```

- `test:e2e`, `test:e2e:strict`, and `test:e2e:auth` now auto-load `.dev.vars.e2e` first, then `.dev.vars`.
- `e2e:save-secrets` writes `.dev.vars.e2e` from your current shell values or the default `/tmp/e2e_session_cookie.txt` and `/tmp/e2e_backend_token.txt` files.
- If you only have the raw BetterAuth cookie value, set `E2E_SESSION_TOKEN=<value>` before running `npm run e2e:save-secrets`; the script will normalize it into `__Secure-better-auth.session_token=<value>`.
- If you want destructive logout coverage in the browser lane, also set `E2E_SIGNOUT_SESSION_TOKEN=<value>` or `E2E_SIGNOUT_SESSION_COOKIE=<name=value>` before running `npm run e2e:save-secrets`. This should be a separate live session so the main authenticated suite is not invalidated mid-run.
- `E2E_SIGNOUT_SESSION_COOKIE` should be a separate live session. It is intentionally not defaulted to the main session, because the logout test invalidates whatever session token it uses.
- The default direct backend base URL is `https://backend-e2e.pyro1121.com`.
- `.dev.vars.e2e.example` shows the expected keys.
- `.dev.vars*` is gitignored.
- `npm run check:e2e-live` verifies that the required live e2e keys are present and that `E2E_SESSION_COOKIE` is still a valid authenticated edge session before running the strict live suite.
- If `E2E_SIGNOUT_SESSION_COOKIE` is set, `check:e2e-live` validates it too and now fails if it matches `E2E_SESSION_COOKIE`.
- If `E2E_SESSION_COOKIE` is stale, refresh it with `npm run e2e:save-secrets` after logging in again.

## Stripe Subscription Bootstrap

Session-backed edge billing routes are available for the dashboard client:

- `GET /api/billing/status`
- `POST /api/billing/start-trial`
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `GET /api/billing/activity`

Feed gating is enforced at the edge for non-subscribers:

- Delay: backend-driven non-subscriber delay (currently up to 90 minutes)
- Caps: tier-based max visible items/messages for free and trial tiers
- Headers: `X-News-Tier`, `X-News-Role`, `X-News-Delay-Minutes`, `X-News-Capped`, `X-News-Total-Before-Gate`, `X-News-Total-Visible`

Optional worker vars for cap tuning:

- `FREE_INTEL_MAX_ITEMS`
- `FREE_BRIEFINGS_MAX_ITEMS`
- `FREE_AIR_SEA_MAX_ITEMS`
- `FREE_TELEGRAM_TOTAL_MESSAGES_MAX`
- `FREE_TELEGRAM_CHANNEL_MESSAGES_MAX`
- `TRIAL_INTEL_MAX_ITEMS`
- `TRIAL_BRIEFINGS_MAX_ITEMS`
- `TRIAL_AIR_SEA_MAX_ITEMS`
- `TRIAL_TELEGRAM_TOTAL_MESSAGES_MAX`
- `TRIAL_TELEGRAM_CHANNEL_MESSAGES_MAX`

Bootstrap Stripe + Wrangler secrets with:

```bash
npm run billing:stripe:setup -- --apply --create-webhook --usage-token "$(openssl rand -hex 32)"
```

Optional args:

- `--price-id price_xxx` to reuse existing Stripe price.
- `--stripe-secret-key sk_test_xxx` to write backend Stripe API key.
- `--webhook-secret whsec_xxx` to write webhook secret directly.
- `--listen` to start a forwarding listener for local webhook testing.

## Deploy

```bash
cd /home/pyro1121/Documents/intel-dashboard/worker
npm run deploy
```

## Auth Health Check

```bash
cd /home/pyro1121/Documents/intel-dashboard
npm run health:oauth
```

## Cloudflare Owner E2E Allowlist

To let synthetic auth-route checks bypass Bot Fight Mode from your current public IP:

```bash
CLOUDFLARE_API_TOKEN=... npm run security:cf:allow-owner-e2e-ip
```

- This creates or refreshes a zone-level IP Access allow rule for `pyro1121.com`
- It is intended for your owner/test IP only
- If your public IP changes, rerun the command

To remove the managed allowlist rule for the current IP:

```bash
CLOUDFLARE_API_TOKEN=... npm run security:cf:clear-owner-e2e-ip
```

## Continuous Production E2E

GitHub Actions workflow:

- [e2e-production.yml](/home/pyro1121/Documents/intel-dashboard/.github/workflows/e2e-production.yml)

Expected GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `E2E_SESSION_TOKEN`
- `E2E_SIGNOUT_SESSION_TOKEN` (optional, recommended for destructive logout coverage)
- `E2E_CF_ACCESS_CLIENT_ID` (optional, required once `backend-e2e.pyro1121.com` is protected by Cloudflare Access)
- `E2E_CF_ACCESS_CLIENT_SECRET` (optional, required once `backend-e2e.pyro1121.com` is protected by Cloudflare Access)
- `E2E_BACKEND_TOKEN`
- `E2E_USER_ID`
- `E2E_NON_OWNER_USER_ID`

The workflow:

1. installs dependencies and Chromium
2. writes `.dev.vars.e2e`
3. verifies live e2e config is present
4. allowlists the runner IP for auth-route checks
5. runs `npm run test:all:live`
6. clears the managed allowlist rule

Local live e2e secrets now default to a secure external path instead of the workspace:

- `~/.codex/secrets/intel-dashboard.e2e.env`

Override it with `E2E_ENV_FILE=/absolute/path` if needed.

## Turnstile Login Protection

OAuth start routes (`/auth/login`, `/auth/signup`, `/auth/x/login`, `/auth/x/signup`) are now gated by Cloudflare Turnstile.

Required worker secrets:

```bash
cd /home/pyro1121/Documents/intel-dashboard/worker
wrangler secret put TURNSTILE_SITE_KEY
wrangler secret put TURNSTILE_SECRET_KEY
wrangler deploy
```

If either secret is missing, Turnstile gating is bypassed automatically to avoid auth lockout.

## Current Production Notes

- OAuth callback supports transient X API failures with provisional login + server-side re-hydration.
- Dashboard shell HTML is `no-store` to prevent stale manifest/asset mismatch after deploy.
- `/api/auth/me` is the canonical authenticated user endpoint for frontend session state and now includes entitlement tier/limits for plan-aware UI.
- Telegram translation uses `AI_GATEWAY_TOKEN` by default; fallback to `CF_API_TOKEN` is now disabled unless `ALLOW_CF_API_TOKEN_AS_AIG=true` is explicitly set.
- Owner CRM dashboard is available at `/crm` (owner-only) and powered by `/api/admin/crm/overview` for signup directory, subscription state, and telemetry rollups.
- Verbose scrape/cache info logs are now gated behind `DEBUG_RUNTIME_LOGS=true` in the edge worker/DO runtime.
