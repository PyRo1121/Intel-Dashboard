# Intel Dashboard Auth Worker

> Status: legacy reference. Production auth is handled by `/home/pyro1121/Documents/intel-dashboard/worker` (`pyrobot-worker` route owner on `intel.pyro1121.com/*`).

Cloudflare Worker for X OAuth login/session handling used by `intel.pyro1121.com`.

## Routes

- `GET /auth/x/login` - start OAuth 2.0 with PKCE + state cookie
- `GET /auth/x/callback` - exchange code, fetch user profile, set signed session cookie
- `GET /auth/me` - return current session and optional backend entitlement info
- `GET|POST /auth/logout` - clear auth session cookie

## Security

- PKCE verifier + state cookie with CSRF state validation
- Signed session cookie (`AUTH_SECRET` HMAC)
- HttpOnly + Secure + SameSite cookies
- No-store responses on auth routes

## Required Secrets

Set these before deploy:

```bash
wrangler secret put X_CLIENT_ID
wrangler secret put X_CLIENT_SECRET
wrangler secret put AUTH_SECRET
wrangler secret put INTEL_API_TOKEN
```

`INTEL_API_TOKEN` is used by `/auth/me` to query backend user profile from `/api/intel-dashboard/user-info`.

## Local Commands

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm deploy
```
