#!/usr/bin/env bash
set -euo pipefail

SRC_BASE="/home/pyro1121/.openclaw/workspace/skills"
DST_BASE="/home/pyro1121/.openclaw/canvas/intel"

mkdir -p "$DST_BASE"

cp -f "$SRC_BASE/telegram-intel/state/latest-telegram-intel.txt" "$DST_BASE/latest-telegram-intel.txt"
cp -f "$SRC_BASE/aviation-intel/state/latest-aviation.txt" "$DST_BASE/latest-aviation.txt"
cp -f "$SRC_BASE/osint-intel/state/latest-events.json" "$DST_BASE/latest-events.json"

POLYMARKET_SRC="$SRC_BASE/polymarket-intel/state/latest-polymarket.txt"
if [[ -f "$POLYMARKET_SRC" ]]; then
  cp -f "$POLYMARKET_SRC" "$DST_BASE/latest-polymarket.txt"
else
  printf 'Polymarket feed disabled (OSINT-only scope).\n' > "$DST_BASE/latest-polymarket.txt"
fi
