# OpenClaw + Intel Website Backup

This private backup repository contains:

- `website/intel-dashboard/` — SolidStart dashboard website
- `openclaw/scripts/` — automation and ingestion scripts
- `openclaw/skills/` — installed global skills
- `openclaw/workspace/skills/` — workspace skill projects and state
- `openclaw/cron/` — cron wrappers used for refresh jobs

## Restore on another PC

1. Clone this repo
2. Copy website project to your preferred path
3. Copy OpenClaw folders into `~/.openclaw/` preserving structure
4. Install dependencies where needed:
   - `website/intel-dashboard`: `npm install`
   - skill workspaces as needed (`bun install` / `npm install`)

## Security Notes

Intentionally excluded from backup:

- credentials/secrets (`~/.openclaw/credentials`, `openclaw.json`, API key files)
- local sessions/tokens
- transient build and cache folders (`node_modules`, `.output`, `.vinxi`, etc.)
