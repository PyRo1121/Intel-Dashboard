#!/usr/bin/env python3
"""
fetch-aviation-intel.py — Pull live aviation intel from OpenSky Network.

Filters:
  1. Emergency squawks: 7500 (hijack), 7600 (comms failure), 7700 (general emergency)
  2. Military callsign prefixes (REACH, DOOM, FORTE, NUKE, etc.)
  3. High-value aircraft types matched by callsign/country heuristics

Outputs:
  latest-aviation.json  — structured JSON for programmatic use
  latest-aviation.txt   — human-readable briefing for the AI bot

Regions: Middle East, Ukraine/Black Sea, Pacific, Europe
Uses only Python stdlib (urllib, json). No pip dependencies.
"""

import json
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path

# ── CONFIG ──────────────────────────────────────────────────────────────

OPENSKY_URL = "https://opensky-network.org/api/states/all"
USER_AGENT = "pyro-aviation-intel/1.0"
TIMEOUT_S = 20
DELAY_BETWEEN_REGIONS_S = 1.5  # OpenSky rate limiting (anonymous: ~400/day)

STATE_DIR = Path.home() / ".openclaw" / "workspace" / "skills" / "aviation-intel" / "state"
OUT_JSON = STATE_DIR / "latest-aviation.json"
OUT_TXT = STATE_DIR / "latest-aviation.txt"

# Regions to scan
REGIONS = {
    "middle_east": {"lamin": 12, "lamax": 42, "lomin": 25, "lomax": 65},
    "ukraine_blacksea": {"lamin": 44, "lamax": 55, "lomin": 22, "lomax": 42},
    "europe": {"lamin": 45, "lamax": 72, "lomin": -10, "lomax": 40},
    "pacific": {"lamin": 10, "lamax": 45, "lomin": 100, "lomax": 155},
}

# Emergency squawk codes
EMERGENCY_SQUAWKS = {
    "7500": "HIJACK",
    "7600": "RADIO FAILURE",
    "7700": "GENERAL EMERGENCY",
}

# Military callsign prefixes
MIL_CALLSIGN_PREFIXES = [
    ("RCH", "US Military Airlift"),
    ("REACH", "US Military Airlift"),
    ("DOOM", "B-52/Bomber"),
    ("DEATH", "B-52/Bomber"),
    ("JAKE", "Tanker/Strategic"),
    ("NUKE", "Tanker/Strategic"),
    ("EPIC", "Mil Callsign"),
    ("IRON", "Mil Callsign"),
    ("NATO", "NATO"),
    ("FORTE", "Global Hawk ISR"),
    ("DUKE", "US Army"),
    ("MOOSE", "C-17 Airlift"),
    ("BISON", "C-5M Galaxy"),
    ("SNTRY", "E-3 AWACS"),
    ("DRAGN", "RC-135 Recon"),
    ("GORDO", "P-8A Poseidon"),
    ("PLNKN", "SIGINT"),
    ("TOPCT", "E-6B Mercury"),
    ("SCORE", "Strategic Tanker"),
    ("HAVOC", "Attack Helo"),
    ("VIPER", "F-16/Fighter"),
    ("RAPTOR", "F-22"),
    ("BONES", "B-1B Lancer"),
    ("GHOST", "B-2 Spirit"),
    ("SPAR", "USAF VIP/Government"),
    ("SAM0", "Special Air Mission"),
    ("SAM1", "Special Air Mission"),
    ("SAM2", "Special Air Mission"),
    ("SAM3", "Special Air Mission"),
    ("SAM4", "Special Air Mission"),
    ("SAM5", "Special Air Mission"),
    ("SAM6", "Special Air Mission"),
    ("SAM7", "Special Air Mission"),
    ("SAM8", "Special Air Mission"),
    ("SAM9", "Special Air Mission"),
    ("EXEC1", "Executive Flight"),
    ("VENUS", "USAF KC-135"),
    ("PACK", "USMC Airlift"),
    ("EVAC", "Aeromedical Evacuation"),
]

# High-value aircraft keywords (matched against callsign + type data)
WATCH_AIRCRAFT = {
    "E-6B": ("TACAMO / Nuclear C2", "critical"),
    "E-4B": ("Nightwatch / Doomsday Plane", "critical"),
    "B-2": ("Stealth Bomber", "critical"),
    "B-52": ("Strategic Bomber", "high"),
    "B-1B": ("Lancer Bomber", "high"),
    "RC-135": ("Signals Intelligence", "high"),
    "RQ-4": ("Global Hawk ISR Drone", "high"),
    "MQ-9": ("Reaper Drone", "high"),
    "E-3": ("AWACS", "high"),
    "E-8C": ("JSTARS Ground Surveillance", "high"),
    "EP-3": ("SIGINT Aircraft", "high"),
    "P-8A": ("Maritime Patrol", "medium"),
    "KC-135": ("Aerial Refueling Tanker", "medium"),
    "KC-46": ("Aerial Refueling Tanker", "medium"),
    "KC-10": ("Aerial Refueling Tanker", "medium"),
    "C-17": ("Strategic Airlift", "medium"),
    "C-5M": ("Strategic Airlift", "medium"),
    "C-130": ("Tactical Airlift", "low"),
}

# Countries likely to have military transponders visible
MIL_ORIGIN_COUNTRIES = {
    "United States", "United Kingdom", "France", "Germany", "Canada",
    "Australia", "Israel", "Turkey", "Saudi Arabia", "Japan",
    "South Korea", "India", "Russia", "China", "Iran",
}


# ── OPENSKY STATE VECTOR INDICES ────────────────────────────────────────
# https://openskynetwork.github.io/opensky-api/rest.html#all-state-vectors
IDX_ICAO24 = 0
IDX_CALLSIGN = 1
IDX_ORIGIN_COUNTRY = 2
IDX_TIME_POSITION = 3
IDX_LAST_CONTACT = 4
IDX_LONGITUDE = 5
IDX_LATITUDE = 6
IDX_BARO_ALTITUDE = 7
IDX_ON_GROUND = 8
IDX_VELOCITY = 9
IDX_HEADING = 10
IDX_VERTICAL_RATE = 11
IDX_SENSORS = 12
IDX_GEO_ALTITUDE = 13
IDX_SQUAWK = 14
IDX_SPI = 15
IDX_POSITION_SOURCE = 16


def log(msg: str) -> None:
    print(f"[aviation-intel] {msg}", file=sys.stderr)


def fetch_region(region_name: str, bounds: dict) -> dict:
    """Fetch all state vectors for a region from OpenSky."""
    params = "&".join(f"{k}={v}" for k, v in bounds.items())
    url = f"{OPENSKY_URL}?{params}"

    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode())
            states = data.get("states") or []
            log(f"{region_name}: {len(states)} aircraft in region")
            return {"time": data.get("time", 0), "states": states}
    except urllib.error.HTTPError as e:
        log(f"WARN: {region_name} HTTP {e.code}")
        return {"time": 0, "states": []}
    except Exception as e:
        log(f"WARN: {region_name} failed: {e}")
        return {"time": 0, "states": []}


def classify_military_callsign(callsign: str):
    upper = callsign.strip().upper()
    if not upper:
        return None
    for prefix, desc in MIL_CALLSIGN_PREFIXES:
        if upper.startswith(prefix):
            return (prefix, desc)
    return None


def extract_interesting(region_name: str, states: list) -> list:
    """Filter states for interesting aircraft: squawks, military, high-value."""
    results = []
    seen_icao = set()

    for state in states:
        if not isinstance(state, list) or len(state) < 17:
            continue

        icao24 = str(state[IDX_ICAO24] or "").strip()
        if not icao24 or icao24 in seen_icao:
            continue
        seen_icao.add(icao24)

        callsign = str(state[IDX_CALLSIGN] or "").strip()
        country = str(state[IDX_ORIGIN_COUNTRY] or "").strip()
        squawk = str(state[IDX_SQUAWK] or "").strip()
        lat = state[IDX_LATITUDE]
        lon = state[IDX_LONGITUDE]
        alt_baro = state[IDX_BARO_ALTITUDE]
        alt_geo = state[IDX_GEO_ALTITUDE]
        velocity = state[IDX_VELOCITY]
        heading = state[IDX_HEADING]
        vert_rate = state[IDX_VERTICAL_RATE]
        on_ground = state[IDX_ON_GROUND]

        altitude = alt_geo if alt_geo is not None else (alt_baro if alt_baro is not None else 0)
        speed_kts = round(velocity * 1.94384, 1) if velocity else 0
        alt_ft = round(altitude * 3.28084) if altitude else 0

        entry = {
            "icao24": icao24,
            "callsign": callsign or "(no callsign)",
            "country": country,
            "region": region_name,
            "squawk": squawk,
            "latitude": lat,
            "longitude": lon,
            "altitude_ft": alt_ft,
            "speed_kts": speed_kts,
            "heading": round(heading) if heading else 0,
            "vertical_rate_fpm": round(vert_rate * 196.85) if vert_rate else 0,
            "on_ground": bool(on_ground),
            "tags": [],
            "severity": "low",
            "description": "",
            "links": {
                "adsbexchange": f"https://globe.adsbexchange.com/?icao={icao24}",
                "flightradar24": f"https://www.flightradar24.com/{callsign.strip()}" if callsign.strip() else "",
            },
        }

        dominated = False

        # 1. Emergency squawk check (highest priority)
        if squawk in EMERGENCY_SQUAWKS:
            label = EMERGENCY_SQUAWKS[squawk]
            entry["tags"].append(f"SQUAWK_{squawk}")
            entry["tags"].append("EMERGENCY")
            entry["severity"] = "critical"
            entry["description"] = f"EMERGENCY SQUAWK {squawk} ({label}) — {callsign or icao24} ({country}) at FL{alt_ft // 100:03d} in {region_name}"
            dominated = True

        # 2. Military callsign check
        mil_match = classify_military_callsign(callsign)
        if mil_match:
            prefix, mil_desc = mil_match
            entry["tags"].append("MILITARY")
            entry["tags"].append(f"MIL_{prefix}")
            if not dominated:
                entry["severity"] = "high"
                entry["description"] = f"Military: {callsign} ({mil_desc}) — {country}, FL{alt_ft // 100:03d}, {speed_kts}kts, hdg {entry['heading']}° in {region_name}"
            dominated = True

        # 3. High-value aircraft type check — only match if callsign IS the type code
        #    (e.g. "RCH" prefix already caught above; this catches ICAO type codes used as callsigns)
        #    Avoid false positives like "FDB2PE" matching "B2" or "UAE3P" matching "E3"
        if not dominated and country == "United States":
            cs_upper = callsign.upper()
            for ac_type, (ac_desc, ac_sev) in WATCH_AIRCRAFT.items():
                normalized = ac_type.replace("-", "")
                if cs_upper.startswith(normalized) or cs_upper == normalized:
                    entry["tags"].append(f"AIRCRAFT_{ac_type}")
                    entry["severity"] = ac_sev
                    entry["description"] = f"{ac_desc}: {callsign} ({country}) at FL{alt_ft // 100:03d} in {region_name}"
                    dominated = True
                    break

        if dominated:
            results.append(entry)

    return results


def format_txt(data: dict) -> str:
    """Format aviation intel as human-readable text for the bot."""
    lines = []
    ts = data.get("timestamp", "")
    lines.append(f"AVIATION INTEL — {ts}")
    lines.append(f"Source: OpenSky Network | Regions: Middle East, Ukraine/Black Sea, Europe, Pacific")
    lines.append("")

    emergencies = [a for a in data.get("aircraft", []) if "EMERGENCY" in a.get("tags", [])]
    military = [a for a in data.get("aircraft", []) if "MILITARY" in a.get("tags", []) and "EMERGENCY" not in a.get("tags", [])]
    high_value = [a for a in data.get("aircraft", []) if a not in emergencies and a not in military and any(t.startswith("AIRCRAFT_") for t in a.get("tags", []))]
    other = [a for a in data.get("aircraft", []) if a not in emergencies and a not in military and a not in high_value]

    # Emergency squawks section
    if emergencies:
        lines.append("=== EMERGENCY SQUAWKS ===")
        for a in emergencies:
            lines.append(f"  ** {a['description']}")
            lines.append(f"     Track: {a['links']['adsbexchange']}")
        lines.append("")
    else:
        lines.append("=== EMERGENCY SQUAWKS: None active ===")
        lines.append("")

    # Military section
    if military:
        lines.append(f"=== MILITARY AIRCRAFT ({len(military)}) ===")
        # Sort by severity
        sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        military.sort(key=lambda x: sev_order.get(x.get("severity", "low"), 3))
        for a in military:
            sev_tag = f"[{a['severity'].upper()}]" if a['severity'] != 'low' else ""
            lines.append(f"  {sev_tag} {a['description']}")
            if a["links"].get("flightradar24"):
                lines.append(f"     FR24: {a['links']['flightradar24']}  |  ADSBX: {a['links']['adsbexchange']}")
            else:
                lines.append(f"     Track: {a['links']['adsbexchange']}")
        lines.append("")
    else:
        lines.append("=== MILITARY AIRCRAFT: None detected ===")
        lines.append("")

    # High-value aircraft
    if high_value:
        lines.append(f"=== HIGH-VALUE AIRCRAFT ({len(high_value)}) ===")
        for a in high_value:
            lines.append(f"  {a['description']}")
        lines.append("")

    # Other interesting
    if other:
        lines.append(f"=== OTHER NOTABLE ({len(other)}) ===")
        for a in other[:20]:  # Cap at 20
            lines.append(f"  {a['description']}")
        lines.append("")

    # Summary
    total = len(data.get("aircraft", []))
    lines.append(f"--- Total notable aircraft: {total} | Emergencies: {len(emergencies)} | Military: {len(military)} | High-value: {len(high_value)} ---")

    return "\n".join(lines)


def load_previous_aircraft() -> list:
    try:
        if not OUT_JSON.exists():
            return []
        raw = json.loads(OUT_JSON.read_text())
        aircraft = raw.get("aircraft") if isinstance(raw, dict) else []
        if isinstance(aircraft, list):
            return aircraft
    except Exception:
        return []
    return []


def main():
    log("Starting aviation intel fetch...")
    all_aircraft = []
    dedupe_icao = set()

    for i, (region_name, bounds) in enumerate(REGIONS.items()):
        if i > 0:
            time.sleep(DELAY_BETWEEN_REGIONS_S)  # Rate limit courtesy

        result = fetch_region(region_name, bounds)
        interesting = extract_interesting(region_name, result["states"])

        # Deduplicate across regions (europe and ukraine overlap)
        for ac in interesting:
            if ac["icao24"] not in dedupe_icao:
                dedupe_icao.add(ac["icao24"])
                all_aircraft.append(ac)

    # Sort: critical first, then high, medium, low
    sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    all_aircraft.sort(key=lambda x: sev_order.get(x.get("severity", "low"), 3))

    fallback_used = False
    live_total = len(all_aircraft)
    if live_total == 0:
        previous = load_previous_aircraft()
        if previous:
            all_aircraft = previous
            fallback_used = True

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    output = {
        "timestamp": now,
        "source": "OpenSky Network",
        "regions": list(REGIONS.keys()),
        "fallback_used": fallback_used,
        "live_total_notable": live_total,
        "total_notable": len(all_aircraft),
        "emergencies": len([a for a in all_aircraft if "EMERGENCY" in a.get("tags", [])]),
        "military": len([a for a in all_aircraft if "MILITARY" in a.get("tags", [])]),
        "aircraft": all_aircraft,
    }

    # Write JSON (atomic)
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    tmp_json = OUT_JSON.with_suffix(".json.tmp")
    tmp_json.write_text(json.dumps(output, indent=2))
    tmp_json.rename(OUT_JSON)

    # Write TXT (atomic)
    txt_content = format_txt(output)
    tmp_txt = OUT_TXT.with_suffix(".txt.tmp")
    tmp_txt.write_text(txt_content)
    tmp_txt.rename(OUT_TXT)

    log(f"Done: {len(all_aircraft)} notable aircraft ({output['emergencies']} emergencies, {output['military']} military)")
    log(f"Written to {OUT_JSON} and {OUT_TXT}")


if __name__ == "__main__":
    main()
