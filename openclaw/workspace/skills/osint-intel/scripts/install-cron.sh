#!/usr/bin/env bash
set -euo pipefail

CRON_EXPR="* * * * *"
WORKDIR="/home/pyro1121/.openclaw/workspace/skills/osint-intel"
COMMAND="cd \"$WORKDIR\" && bun run refresh >> state/refresh.log 2>&1"
ENTRY="$CRON_EXPR $COMMAND"

existing="$(crontab -l 2>/dev/null || true)"
filtered="$(printf '%s\n' "$existing" | grep -Fv "$COMMAND" || true)"

tmpfile="$(mktemp)"
trap 'rm -f "$tmpfile"' EXIT

if [ -n "$filtered" ]; then
  printf '%s\n' "$filtered" > "$tmpfile"
fi
printf '%s\n' "$ENTRY" >> "$tmpfile"

crontab "$tmpfile"
printf 'Installed/updated cron: %s\n' "$ENTRY"
