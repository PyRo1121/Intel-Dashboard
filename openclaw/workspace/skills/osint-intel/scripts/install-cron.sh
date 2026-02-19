#!/usr/bin/env bash
set -euo pipefail

CRON_EXPR="*/10 * * * *"
WORKDIR="/home/pyro1121/.openclaw/workspace/skills/osint-intel"
COMMAND="cd \"$WORKDIR\" && bun run refresh >> state/refresh.log 2>&1"
ENTRY="$CRON_EXPR $COMMAND"

existing="$(crontab -l 2>/dev/null || true)"

if printf '%s\n' "$existing" | grep -Fq "$COMMAND"; then
  printf 'osint-intel refresh cron already installed\n'
  exit 0
fi

{
  printf '%s\n' "$existing"
  printf '%s\n' "$ENTRY"
} | crontab -

printf 'Installed cron: %s\n' "$ENTRY"
