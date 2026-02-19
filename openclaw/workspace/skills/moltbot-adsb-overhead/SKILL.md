---
name: adsb-overhead
description: DEPRECATED — Do NOT use this skill for aircraft/squawk/flight queries. Instead read the local aviation state file. Use read tool with path /home/pyro1121/.openclaw/workspace/skills/aviation-intel/state/latest-aviation.txt for all aviation, squawk, military aircraft, and flight tracking questions.
---

# adsb-overhead — DEPRECATED

This skill required a USB ADS-B dongle which is NOT installed.

For all aviation, squawk, military aircraft, and flight questions, read the local state file instead:

read(path="/home/pyro1121/.openclaw/workspace/skills/aviation-intel/state/latest-aviation.txt")

That file is updated every 30 minutes from OpenSky Network and covers emergency squawks (7500/7600/7700), military callsigns, and high-value aircraft across Middle East, Ukraine/Black Sea, Europe, and Pacific regions.
