#!/usr/bin/env python3
"""
fetch-telegram-intel.py — Monitor public Telegram channels via Telethon MTProto API.

Method: Telethon (MTProto) — 50 messages per channel, no web scraping limits.
Translation: Ollama HY-MT1.5-1.8B (local, concurrent via ThreadPoolExecutor).
Media: Detects photo/video, provides t.me embed links for dashboard.
Session: SQLite session file persists auth between cron runs.

First run requires interactive phone auth. Subsequent runs are fully automatic.
"""

import asyncio
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from telethon import TelegramClient
from telethon.errors import (
    ChannelPrivateError,
    FloodWaitError,
    UsernameInvalidError,
    UsernameNotOccupiedError,
)
from telethon.tl.types import (
    MessageMediaDocument,
    MessageMediaPhoto,
    MessageMediaWebPage,
    DocumentAttributeVideo,
    DocumentAttributeAnimated,
)

# ── Telegram API credentials ─────────────────────────────────────────────
API_ID = int(os.environ.get("TG_API_ID", "0"))
API_HASH = os.environ.get("TG_API_HASH", "")
SESSION_PATH = str(Path.home() / ".openclaw" / "telegram_intel_session")

# ── Config ────────────────────────────────────────────────────────────────
MESSAGES_PER_CHANNEL = 50
DELAY_BETWEEN_CHANNELS_S = 0.5
FLOOD_WAIT_BUFFER_S = 5

OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "RogerBen/HY-MT1.5-1.8B:latest"
OLLAMA_TIMEOUT = 60
OLLAMA_WORKERS = 6
OLLAMA_OPTIONS = {"top_k": 20, "top_p": 0.6, "repeat_penalty": 1.05, "temperature": 0.7}

STATE_DIR = Path.home() / ".openclaw" / "workspace" / "skills" / "telegram-intel" / "state"
OUT_JSON = STATE_DIR / "latest-telegram-intel.json"
OUT_TXT = STATE_DIR / "latest-telegram-intel.txt"
SKILL_MD_PATH = Path.home() / ".openclaw" / "workspace" / "skills" / "telegram-intel" / "SKILL.md"

ENGLISH_HINT_WORDS = {
    "the", "and", "for", "with", "that", "this", "from", "have", "will", "about", "after", "before", "over",
    "under", "into", "between", "during", "against", "today", "tomorrow", "yesterday", "report", "update",
    "attack", "defense", "military", "official", "breaking", "analysis", "forces", "operation", "intel",
}

FOREIGN_SCRIPT_RE = re.compile(
    r"[\u0400-\u04FF\u0590-\u05FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0E00-\u0E7F\u4E00-\u9FFF]"
)

# (username, label, category, language_hint)
CHANNELS = [
    # ── Ukrainian Official ────────────────────────────────────────────
    ("ukraine_context", "Ukraine Context", "ua_official", "uk"),
    ("GeneralStaffZSU", "UA General Staff", "ua_official", "uk"),
    ("UkrainianLandForces", "UA Ground Forces", "ua_official", "uk"),
    ("ukaborona", "UA Ministry of Defense", "ua_official", "uk"),
    ("AFUStratCom", "AFU Strategic Comms", "ua_official", "uk"),
    ("air_alert_ua", "UA Air Alerts", "ua_official", "uk"),
    ("kpszsu", "UA Air Force Command", "ua_official", "uk"),

    # ── Ukrainian OSINT ───────────────────────────────────────────────
    ("DeepStateUA", "DeepState Map", "ua_osint", "uk"),
    ("operativnoZSU", "Operatyvnyi ZSU", "ua_osint", "uk"),
    ("Kherson_molodec", "Kherson Insider", "ua_osint", "uk"),
    ("supernova_plus", "Supernova+", "ua_osint", "uk"),

    # ── Ukrainian Intelligence ────────────────────────────────────────
    ("SBUkr", "SBU Security Service", "ua_intel", "uk"),
    ("informnapalm", "InformNapalm OSINT", "ua_intel", "uk"),
    ("DIUkraine", "GUR Defense Intelligence", "ua_intel", "uk"),
    ("Atesh_UA", "ATESH Partisan Movement", "ua_intel", "uk"),
    ("Molfar_global", "Molfar OSINT", "ua_intel", "en"),

    # ── Ukrainian Frontline Units ─────────────────────────────────────
    ("azov_media", "Azov Brigade", "ua_frontline", "uk"),
    ("kraken_kha", "Kraken Unit Kharkiv", "ua_frontline", "uk"),
    ("Soniashnyk", "Soniashnyk Aviation", "ua_frontline", "uk"),

    # ── Ukrainian Journalism ──────────────────────────────────────────
    ("ssternenko", "Sternenko", "ua_journalism", "uk"),
    ("ButusovPlus", "Butusov Plus", "ua_journalism", "uk"),
    ("ivan_fedorov_zp", "Zaporizhzhia RMA", "ua_journalism", "uk"),
    ("Tsaplienko", "Tsaplienko War Reporter", "ua_journalism", "uk"),
    ("pravda_gerashchenko", "Gerashchenko Advisor", "ua_journalism", "uk"),

    # ── Russian Official ──────────────────────────────────────────────
    ("mod_russia", "Russian MOD", "ru_official", "ru"),
    ("mod_russia_en", "Russian MOD (English)", "ru_official", "en"),
    ("MID_Russia", "Russian MFA", "ru_official", "ru"),
    ("MFARussia", "Russian MFA (English)", "ru_official", "en"),

    # ── Russian Milbloggers ───────────────────────────────────────────
    ("rybar", "Rybar", "ru_milblog", "ru"),
    ("dva_majors", "Two Majors", "ru_milblog", "ru"),
    ("RVvoenkor", "RV Voenkor", "ru_milblog", "ru"),
    ("wargonzo", "WarGonzo", "ru_milblog", "ru"),
    ("strelkovii", "Strelkov / Girkin", "ru_milblog", "ru"),
    ("voenkorKotenok", "Voenkor Kotenok", "ru_milblog", "ru"),
    ("epoddubny", "Poddubny", "ru_milblog", "ru"),
    ("Sladkov_plus", "Sladkov+", "ru_milblog", "ru"),
    ("boris_rozhin", "Colonelcassad", "ru_milblog", "ru"),
    ("readovkanews", "Readovka", "ru_milblog", "ru"),
    ("voenacher", "Turned on War", "ru_milblog", "ru"),
    ("RKadyrov_95", "Kadyrov", "ru_milblog", "ru"),
    ("bomber_fighter", "Fighterbomber", "ru_milblog", "ru"),
    ("grey_zone", "Grey Zone / Wagner", "ru_milblog", "ru"),
    ("Starshe_eddy", "Starshe Eddy", "ru_milblog", "ru"),
    ("sudoplatov_official", "Sudoplatov Unit", "ru_milblog", "ru"),
    ("ASTRApress", "ASTRA Independent", "ru_milblog", "ru"),
    ("CITeam", "Conflict Intel Team", "ru_milblog", "ru"),
    ("milinfolive", "MilInfoLive", "ru_milblog", "ru"),

    # ── English Analysis ──────────────────────────────────────────────
    ("NOELreports", "NOEL Reports", "en_analysis", "en"),
    ("wartranslated", "War Translated", "en_analysis", "en"),
    ("ukraine_front_lines", "Ukraine Front Lines", "en_analysis", "en"),
    ("ISW_official", "Inst. for Study of War", "en_analysis", "en"),
    ("UkraineNowEnglish", "Ukraine NOW English", "en_analysis", "en"),
    ("militarysummary", "Military Summary", "en_analysis", "en"),
    ("CITeam_en", "Conflict Intel Team EN", "en_analysis", "en"),

    # ── English OSINT ─────────────────────────────────────────────────
    ("andrewperpetua", "Andrew Perpetua", "en_osint", "en"),
    ("defmon3war", "DefMon3", "en_osint", "en"),

    # ── Weapons & Equipment ───────────────────────────────────────────
    ("UAWeapons", "UA Weapons Tracker", "weapons", "en"),

    # ── Mapping & Geolocation ─────────────────────────────────────────
    ("AMK_Mapping", "AMK Mapping", "mapping", "en"),
    ("Suriyakmaps", "Suriyak Maps", "mapping", "en"),
    ("mapsukraine", "Ukraine Maps", "mapping", "en"),
    ("war_mapper", "War Mapper", "mapping", "en"),
]

CATEGORY_LABELS = {
    "ua_official": "Ukrainian Official",
    "ua_osint": "Ukrainian OSINT",
    "ua_intel": "Ukrainian Intelligence",
    "ua_frontline": "Ukrainian Frontline Units",
    "ua_journalism": "Ukrainian Journalism",
    "ru_official": "Russian Official",
    "ru_milblog": "Russian Milbloggers",
    "en_analysis": "English Analysis",
    "en_osint": "English OSINT",
    "weapons": "Weapons & Equipment",
    "mapping": "Mapping & Geolocation",
}

DEFAULT_LANG_BY_CATEGORY = {
    "ua_official": "uk",
    "ua_osint": "uk",
    "ua_intel": "uk",
    "ua_frontline": "uk",
    "ua_journalism": "uk",
    "ru_official": "ru",
    "ru_milblog": "ru",
    "drone": "uk",
}

DEFAULT_LANG_BY_USERNAME = {username: lang for username, _label, _category, lang in CHANNELS}


def parse_skill_markdown_channels(path: Path) -> tuple[list[tuple[str, str, str, str]], dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"SKILL.md not found at {path}")

    lines = path.read_text(encoding="utf-8").splitlines()
    heading_re = re.compile(r"^###\s+(.+?)\s+\(`([^`]+)`\)\s*$")

    parsed_channels: list[tuple[str, str, str, str]] = []
    parsed_labels: dict[str, str] = {}
    current_category = ""
    in_channel_list = False

    for raw_line in lines:
        line = raw_line.strip()
        if line == "## Channel List":
            in_channel_list = True
            continue
        if line.startswith("## ") and line != "## Channel List":
            in_channel_list = False
            current_category = ""
            continue
        if not in_channel_list:
            continue

        heading = heading_re.match(line)
        if heading:
            current_category = heading.group(2).strip()
            parsed_labels[current_category] = heading.group(1).strip()
            continue

        if not current_category or not line.startswith("|"):
            continue

        cols = [part.strip() for part in line.strip("|").split("|")]
        if len(cols) < 2:
            continue

        username, label = cols[0], cols[1]
        if not username or username.lower() == "username":
            continue
        if set(username) == {"-"}:
            continue

        lang = DEFAULT_LANG_BY_USERNAME.get(username, DEFAULT_LANG_BY_CATEGORY.get(current_category, "en"))
        parsed_channels.append((username, label, current_category, lang))

    if not parsed_channels:
        raise ValueError("No channels parsed from SKILL.md")

    deduped_channels: list[tuple[str, str, str, str]] = []
    seen_usernames: set[str] = set()
    for username, label, category, lang in parsed_channels:
        if username in seen_usernames:
            continue
        seen_usernames.add(username)
        deduped_channels.append((username, label, category, lang))

    merged_labels = dict(CATEGORY_LABELS)
    merged_labels.update(parsed_labels)
    return deduped_channels, merged_labels


def load_channel_config() -> tuple[list[tuple[str, str, str, str]], dict[str, str]]:
    try:
        channels, labels = parse_skill_markdown_channels(SKILL_MD_PATH)
        log(f"Loaded {len(channels)} channels from {SKILL_MD_PATH}")
        return channels, labels
    except Exception as e:
        log(f"Falling back to built-in channel config ({e})")
        return CHANNELS, CATEGORY_LABELS


def log(msg: str) -> None:
    print(f"[telegram-intel] {msg}", file=sys.stderr)


# ── Language detection ────────────────────────────────────────────────────

def _detect_lang(text: str) -> str:
    if not text.strip():
        return "en"
    cyrillic = sum(1 for c in text if '\u0400' <= c <= '\u04FF')
    ratio = cyrillic / max(len(text), 1)
    if ratio < 0.2:
        return "en"
    uk_chars = sum(1 for c in text if c in 'іїєґІЇЄҐ')
    return "uk" if uk_chars > 2 else "ru"


def _should_translate_text(text: str) -> bool:
    candidate = text.strip()
    if not candidate or candidate == "(media only)":
        return False

    return bool(FOREIGN_SCRIPT_RE.search(candidate))


# ── Ollama HY-MT translation ─────────────────────────────────────────────

def _ollama_translate(text: str, detected_lang: str) -> str:
    prompt = (
        "Translate the following segment into English, "
        "without additional explanation.\n\n"
        f"{text}"
    )

    payload = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": OLLAMA_OPTIONS,
    }).encode("utf-8")

    req = urllib.request.Request(
        OLLAMA_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=OLLAMA_TIMEOUT) as resp:
        result = json.loads(resp.read().decode("utf-8"))

    return result["message"]["content"].strip()


def translate_text(text: str) -> str:
    if not text.strip():
        return text
    detected = _detect_lang(text)
    if detected == "en" and not _should_translate_text(text):
        return text
    truncated = text[:6000] if len(text) > 6000 else text
    for attempt in range(3):
        try:
            result = _ollama_translate(truncated, detected)
            if len(result) < 3 or result.lower() in ("onse", "onse }"):
                log(f"    Garbage output on attempt {attempt + 1}, retrying...")
                continue
            if _should_translate_text(result):
                log(f"    Non-English residue on attempt {attempt + 1}, retrying...")
                continue
            return result
        except Exception as e:
            if attempt < 2:
                log(f"    Translation attempt {attempt + 1} failed ({e}), retrying...")
                continue
            log(f"    Translation failed after 3 attempts: {e}")
    return text


def translate_channel_messages(raw_msgs: list) -> list:
    needs_translation = []
    results = {}

    for i, msg in enumerate(raw_msgs):
        text = msg["text"]
        if _should_translate_text(text):
            needs_translation.append((i, text))
        else:
            results[i] = text

    if not needs_translation:
        return [msg["text"] for msg in raw_msgs]

    with ThreadPoolExecutor(max_workers=OLLAMA_WORKERS) as pool:
        futures = {}
        for idx, text in needs_translation:
            future = pool.submit(translate_text, text)
            futures[future] = idx

        for future in as_completed(futures):
            idx = futures[future]
            try:
                results[idx] = future.result()
            except Exception as e:
                log(f"    Worker failed for msg {idx}: {e}")
                results[idx] = raw_msgs[idx]["text"]

    return [results[i] for i in range(len(raw_msgs))]


# ── Telethon channel reader ──────────────────────────────────────────────

def _extract_media(msg, username: str) -> list:
    media_list = []
    if not msg.media:
        return media_list

    link = f"https://t.me/{username}/{msg.id}"

    if isinstance(msg.media, MessageMediaPhoto):
        media_list.append({
            "type": "photo",
            "url": f"{link}?embed=1",
        })

    elif isinstance(msg.media, MessageMediaDocument):
        doc = msg.media.document
        if doc:
            is_video = False
            is_gif = False
            duration = 0
            for attr in (getattr(doc, "attributes", None) or []):
                if isinstance(attr, DocumentAttributeVideo):
                    is_video = True
                    duration = attr.duration
                elif isinstance(attr, DocumentAttributeAnimated):
                    is_gif = True

            if is_video and not is_gif:
                media_list.append({
                    "type": "video",
                    "url": f"{link}?embed=1",
                    "thumbnail": "",
                    "duration": duration,
                })
            elif is_gif:
                media_list.append({
                    "type": "photo",
                    "url": f"{link}?embed=1",
                })

    return media_list


async def fetch_channel(client: TelegramClient, username: str, limit: int) -> list:
    messages = []
    try:
        async for msg in client.iter_messages(username, limit=limit):
            if msg.text is None and msg.media is None:
                continue

            text = msg.text or ""
            media = _extract_media(msg, username)
            if not text and not media:
                continue

            views_raw = getattr(msg, "views", None)
            views_str = ""
            if views_raw is not None:
                if views_raw >= 1_000_000:
                    views_str = f"{views_raw / 1_000_000:.1f}M"
                elif views_raw >= 1_000:
                    views_str = f"{views_raw / 1_000:.1f}K"
                else:
                    views_str = str(views_raw)

            dt_str = msg.date.isoformat() if msg.date else ""

            messages.append({
                "text": text if text else "(media only)",
                "datetime": dt_str,
                "link": f"https://t.me/{username}/{msg.id}",
                "views": views_str,
                "media": media,
                "has_video": any(m["type"] == "video" for m in media),
                "has_photo": any(m["type"] == "photo" for m in media),
            })

    except FloodWaitError as e:
        log(f"  FloodWait {e.seconds}s for @{username}, sleeping...")
        await asyncio.sleep(e.seconds + FLOOD_WAIT_BUFFER_S)
        return await fetch_channel(client, username, limit)

    except ChannelPrivateError:
        log(f"  @{username} is private/restricted, skipping")
        return []

    except (UsernameInvalidError, UsernameNotOccupiedError):
        log(f"  @{username} invalid or doesn't exist, skipping")
        return []

    except Exception as e:
        log(f"  Error fetching @{username}: {e}")
        return []

    return messages


# ── Output formatting ────────────────────────────────────────────────────

def format_txt(data: dict, category_labels: dict[str, str]) -> str:
    lines = []
    ts = data.get("timestamp", "")
    lines.append(f"UKRAINE/RUSSIA TELEGRAM INTEL — {ts}")
    lines.append(f"Source: {data.get('channels_fetched', 0)}/{data.get('total_channels', 0)} channels | {data.get('total_messages', 0)} messages")
    lines.append("")

    by_category = {}
    for ch_data in data.get("channels", []):
        cat = ch_data.get("category", "other")
        by_category.setdefault(cat, []).append(ch_data)

    for cat, cat_label in category_labels.items():
        channels = by_category.get(cat, [])
        if not channels:
            continue

        lines.append(f">>> {cat_label.upper()} <<<")
        for ch_data in channels:
            label = ch_data["label"]
            username = ch_data["username"]
            msgs = ch_data.get("messages", [])
            if not msgs:
                lines.append(f"  @{username} ({label}): no posts available")
                continue

            lines.append(f"  --- @{username} ({label}) — {len(msgs)} posts ---")
            for msg in msgs[-3:]:
                dt = msg.get("datetime", "")[:16].replace("T", " ")
                views = msg.get("views", "")
                view_str = f" [{views} views]" if views else ""
                media_tags = []
                if msg.get("has_video"):
                    media_tags.append("VIDEO")
                if msg.get("has_photo"):
                    media_tags.append("PHOTO")
                media_str = f" [{'+'.join(media_tags)}]" if media_tags else ""
                text_en = msg.get("text_en", msg.get("text_original", ""))
                if len(text_en) > 250:
                    text_en = text_en[:247] + "..."
                lines.append(f"    [{dt}]{view_str}{media_str} {text_en}")
        lines.append("")

    return "\n".join(lines)


# ── Main ─────────────────────────────────────────────────────────────────

async def async_main():
    if not API_ID or not API_HASH:
        log("FATAL: Set TG_API_ID and TG_API_HASH environment variables")
        log("Get them from https://my.telegram.org/apps")
        sys.exit(1)

    log("Starting Telegram intel fetch (Telethon MTProto)...")
    log(f"  Session: {SESSION_PATH}")
    log(f"  Messages per channel: {MESSAGES_PER_CHANNEL}")
    channels, category_labels = load_channel_config()

    try:
        _ollama_translate("тест", "ru")
        log(f"Ollama {OLLAMA_MODEL} ready ({OLLAMA_WORKERS} concurrent workers)")
    except Exception as e:
        log(f"FATAL: Ollama not available: {e}")
        log(f"Make sure ollama is running and {OLLAMA_MODEL} is pulled")
        sys.exit(1)

    client = TelegramClient(SESSION_PATH, API_ID, API_HASH)
    client.start()
    me = await client.get_me()
    me_username = getattr(me, "username", None)
    me_phone = getattr(me, "phone", None)
    log(f"Authenticated as @{me_username or me_phone or 'unknown'}")

    all_channels = []
    total_messages = 0
    translated_count = 0
    failed_count = 0

    for i, (username, label, category, lang_hint) in enumerate(channels):
        if i > 0:
            await asyncio.sleep(DELAY_BETWEEN_CHANNELS_S)

        log(f"Fetching @{username} ({label})...")
        raw_msgs = await fetch_channel(client, username, MESSAGES_PER_CHANNEL)
        log(f"  {len(raw_msgs)} messages")

        t0 = time.time()
        translated_texts = translate_channel_messages(raw_msgs)
        elapsed = time.time() - t0

        translated_msgs = []
        ch_translated = 0
        for msg, text_en in zip(raw_msgs, translated_texts):
            original = msg["text"]
            if text_en != original:
                ch_translated += 1
                translated_count += 1
            elif _should_translate_text(text_en):
                failed_count += 1

            translated_msgs.append({
                "text_original": original,
                "text_en": text_en,
                "datetime": msg["datetime"],
                "link": msg["link"],
                "views": msg["views"],
                "media": msg["media"],
                "has_video": msg["has_video"],
                "has_photo": msg["has_photo"],
                "language": lang_hint,
            })

        log(f"  Translated {ch_translated}/{len(raw_msgs)} in {elapsed:.1f}s")

        all_channels.append({
            "username": username,
            "label": label,
            "category": category,
            "language": lang_hint,
            "message_count": len(translated_msgs),
            "messages": translated_msgs,
        })
        total_messages += len(translated_msgs)

    client.disconnect()

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    output = {
        "timestamp": now,
        "source": "Telegram MTProto API (Telethon)",
        "total_channels": len(channels),
        "channels_fetched": len([c for c in all_channels if c["message_count"] > 0]),
        "total_messages": total_messages,
        "translated_messages": translated_count,
        "failed_translations": failed_count,
        "translation_engine": "Ollama HY-MT1.5-1.8B Q8_0 (local)",
        "messages_per_channel": MESSAGES_PER_CHANNEL,
        "categories": category_labels,
        "channels": all_channels,
    }

    STATE_DIR.mkdir(parents=True, exist_ok=True)

    tmp_json = OUT_JSON.with_suffix(".json.tmp")
    tmp_json.write_text(json.dumps(output, indent=2, ensure_ascii=False))
    tmp_json.rename(OUT_JSON)

    txt_content = format_txt(output, category_labels)
    tmp_txt = OUT_TXT.with_suffix(".txt.tmp")
    tmp_txt.write_text(txt_content)
    tmp_txt.rename(OUT_TXT)

    log(f"Done: {total_messages} messages from {len(channels)} channels")
    log(f"  Translated: {translated_count} | Failed: {failed_count}")
    log(f"Written to {OUT_JSON} and {OUT_TXT}")


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
