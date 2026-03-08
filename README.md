# Intel Dashboard Backup

Private backup + restore runbook for:

- `website/intel-dashboard/` - SolidStart intel dashboard
- `website/intel-dashboard/worker/` - Cloudflare Worker (API proxy + DO cache)
- `openclaw/scripts/` - Telegram/aviation/data ingestion scripts
- `openclaw/skills/` - installed global skill links
- `openclaw/workspace/skills/` - active skill projects + state
- `openclaw/cron/` - cron job definitions and run logs

## 1) Prerequisites

- Node.js `>=22`
- npm (bundled with Node)
- Bun (for some OpenClaw skill workflows)
- Python 3.11+
- Git + GitHub CLI (`gh`)
- Wrangler CLI (Cloudflare)

Install and auth:

```bash
gh auth login
npx wrangler login
```

## 2) Clone On New PC

```bash
git clone https://github.com/PyRo1121/openclaw-intel-backup.git
cd openclaw-intel-backup
```

## 3) Restore Layout

Recommended target layout:

- dashboard code: `~/Documents/intel-dashboard`
- OpenClaw home: `~/.openclaw`

```bash
mkdir -p "$HOME/Documents/intel-dashboard"
mkdir -p "$HOME/.openclaw"

cp -a website/intel-dashboard/. "$HOME/Documents/intel-dashboard/"
cp -a openclaw/. "$HOME/.openclaw/"
```

## 4) Website Dev + Build

From dashboard root:

```bash
cd "$HOME/Documents/intel-dashboard"
npm install
npm run dev
```

Production build for Cloudflare Pages (required):

```bash
cd "$HOME/Documents/intel-dashboard"
BUILD_TARGET=cloudflare npm run build
```

Why this matters: `BUILD_TARGET=cloudflare` switches SolidStart to static preset in `app.config.ts` and avoids asset mismatch/hydration chunk issues.

## 5) Cloudflare Pages Deploy

Use this exact deploy flow:

```bash
cd "$HOME/Documents/intel-dashboard"
BUILD_TARGET=cloudflare npm run build
npx wrangler pages deploy ".output/public" --project-name pyrobot-intel
```

## 6) Worker Commands (API + Durable Objects)

Worker config: `website/intel-dashboard/worker/wrangler.toml`

```bash
cd "$HOME/Documents/intel-dashboard/worker"
npm install
npm run dev
npm run deploy
npm run tail
```

Notes:

- Worker routes are configured for `intel.pyro1121.com/*`
- Durable Object binding: `INTEL_CACHE`
- Cron trigger in worker: every 5 minutes

## 7) OpenClaw Data Refresh Commands

Telegram intel scrape + translation:

```bash
python3 "$HOME/.openclaw/scripts/fetch-telegram-intel.py"
```

OSINT pipeline refresh:

```bash
cd "$HOME/.openclaw/workspace/skills/osint-intel"
bun install
bun run refresh
```

Aviation ingest (if used):

```bash
python3 "$HOME/.openclaw/scripts/fetch-aviation-intel.py"
```

## 8) Cron Jobs

Primary cron definition file:

- `openclaw/cron/jobs.json`

Run logs:

- `openclaw/cron/runs/*.jsonl`

If moving machines, validate paths inside jobs still match your new home directory.

## 9) Required Secrets / Local-Only Files

This backup intentionally excludes secrets and volatile credentials. Recreate on new machine:

- `~/.openclaw/credentials/*`
- `~/.openclaw/openclaw.json*`
- API keys, OAuth secrets, session tokens
- `.env` files

## 10) Quick Health Checks

Dashboard local:

```bash
curl -I http://localhost:3200
```

Production:

```bash
curl -I https://intel.pyro1121.com/
curl -I https://intel.pyro1121.com/telegram
curl -I https://intel.pyro1121.com/air-sea
```

## 11) Common Gotchas

- If you see chunk 404/hydration mismatches, rebuild with `BUILD_TARGET=cloudflare` and redeploy Pages output.
- If Telegram shows non-English leakage, rerun `fetch-telegram-intel.py` (translation pass is enforced there).
- If worker API paths fail but static pages load, redeploy worker separately from `website/intel-dashboard/worker`.

## Security Notes

Excluded on purpose:

- credentials/secrets (`~/.openclaw/credentials`, key files, tokens)
- local session material
- transient build/cache directories (`node_modules`, `.output`, `.vinxi`, `.wrangler`, etc.)
