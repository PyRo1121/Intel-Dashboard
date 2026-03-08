#!/usr/bin/env bash
# Run every 1 min via cron/systemd timer. Bot reads these files instead of making API calls.
set -euo pipefail

LOG_PREFIX="[intel-refresh]"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OSINT_STATE="/home/pyro1121/.openclaw/workspace/skills/osint-intel/state/latest-events.json"
OSINT_DIR="/home/pyro1121/.openclaw/workspace/skills/osint-intel"
BUN="/home/pyro1121/.local/share/mise/installs/bun/1.3.8/bin/bun"
export REFRESH_TIME
REFRESH_TIME=$(date '+%m/%d/%Y, %I:%M:%S %p %Z')

log() { echo "$LOG_PREFIX $1" >&2; }

# ── OSINT ───────────────────────────────────────────────────────────────
refresh_osint() {
  log "Running OSINT refresh pipeline..."
  if (cd "$OSINT_DIR" && "$BUN" run refresh >/dev/null 2>&1); then
    local size
    size=$(stat -c%s "$OSINT_STATE" 2>/dev/null || echo '0')
    log "OSINT: refreshed (${size} bytes)"
  else
    log "WARN: OSINT refresh returned HTTP $status"
  fi
}

# ── AVIATION ────────────────────────────────────────────────────────────
refresh_aviation() {
  log "Fetching aviation intel from OpenSky..."
  python3 "$SCRIPT_DIR/fetch-aviation-intel.py" 2>&1 | while IFS= read -r line; do log "$line"; done
  if [ "${PIPESTATUS[0]}" -eq 0 ]; then
    local size
    size=$(stat -c%s "/home/pyro1121/.openclaw/workspace/skills/aviation-intel/state/latest-aviation.txt" 2>/dev/null || echo '0')
    log "Aviation: refreshed (${size} bytes)"
  else
    log "WARN: aviation fetch failed"
    return 1
  fi
}

# ── TELEGRAM ────────────────────────────────────────────────────────────
refresh_telegram() {
  log "Fetching Telegram intel (Ukraine/Russia channels)..."
  python3 "$SCRIPT_DIR/fetch-telegram-intel.py" 2>&1 | while IFS= read -r line; do log "$line"; done
  if [ "${PIPESTATUS[0]}" -eq 0 ]; then
    local size
    size=$(stat -c%s "/home/pyro1121/.openclaw/workspace/skills/telegram-intel/state/latest-telegram-intel.txt" 2>/dev/null || echo '0')
    log "Telegram: refreshed (${size} bytes)"
  else
    log "WARN: Telegram fetch failed"
    return 1
  fi
}

# ── MAIN ────────────────────────────────────────────────────────────────
main() {
  log "Starting intel refresh at $REFRESH_TIME"

  refresh_osint &
  local pid_osint=$!
  refresh_aviation &
  local pid_aviation=$!
  refresh_telegram &
  local pid_telegram=$!

  local failures=0
  wait $pid_osint    || ((failures++))
  wait $pid_aviation || ((failures++))
  wait $pid_telegram || ((failures++))

  if [ "$failures" -gt 0 ]; then
    log "Completed with $failures failure(s)"
  else
    log "All refreshes completed successfully"
  fi
}

main
