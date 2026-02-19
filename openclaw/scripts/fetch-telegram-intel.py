#!/usr/bin/env python3
"""
fetch-telegram-intel.py — Scrape public Telegram channels for Ukraine/Russia war intel.

Method: t.me/s/{channel} web preview (no API key, no Telegram account, no daemon).
Translation: Ollama HY-MT1.5-1.8B (Tencent Hunyuan, fully local, concurrent via ThreadPoolExecutor).
Media: Extracts video URLs, photo URLs, thumbnails for dashboard embedding.
"""

import json
import re
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from pathlib import Path

# ── Config ────────────────────────────────────────────────────────────────
OLLAMA_URL = "http://localhost:11434/api/chat"
OLLAMA_MODEL = "RogerBen/HY-MT1.5-1.8B:latest"
OLLAMA_TIMEOUT = 60
OLLAMA_WORKERS = 6
OLLAMA_OPTIONS = {"top_k": 20, "top_p": 0.6, "repeat_penalty": 1.05, "temperature": 0.7}

STATE_DIR = Path.home() / ".openclaw" / "workspace" / "skills" / "telegram-intel" / "state"
OUT_JSON = STATE_DIR / "latest-telegram-intel.json"
OUT_TXT = STATE_DIR / "latest-telegram-intel.txt"
SKILL_MD_PATH = Path.home() / ".openclaw" / "workspace" / "skills" / "telegram-intel" / "SKILL.md"

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
TIMEOUT_S = 15
DELAY_BETWEEN_CHANNELS_S = 1.5

LANG_NAMES = {"ru": "Russian", "uk": "Ukrainian"}

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

    # ── Cyber Warfare ────────────────────────────────────────────────
    ("itarmyofukraine2022", "IT Army of Ukraine", "cyber", "uk"),

    # ── Naval / Black Sea ────────────────────────────────────────────
    ("blackseastrategyinstitute", "Black Sea Strategy Inst.", "naval", "en"),

    # ── Air Defense / Monitoring ─────────────────────────────────────
    ("warinukraineua", "Ukrainian Witness", "air_defense", "en"),
    ("CyberspecNews", "CYPERSPEC Air/UAV", "air_defense", "en"),

    # ── Casualties & Equipment ───────────────────────────────────────
    ("rf200_now_world", "Cargo-200 Casualties", "casualties", "en"),
    ("UkraineWeaponsTracker", "Weapons Tracker (Oryx)", "weapons", "en"),

    # ── Satellite / Geospatial OSINT ─────────────────────────────────
    ("sitreports", "SITREP OSINT", "satellite", "en"),
    ("kalibrated", "Kalibrated Analysis", "satellite", "en"),
    ("GeoSight", "The GeoSight", "satellite", "en"),
    ("mercsat", "MERC-SAT Analytics", "satellite", "en"),

    # ── Drone Warfare ────────────────────────────────────────────────
    ("aerorozvidka", "Aerorozvidka Drones", "drone", "uk"),

    # ── Foreign Volunteers ───────────────────────────────────────────
    ("georgian_legion", "Georgian Legion", "foreign_vol", "en"),

    # ── Think Tank / Long-form Analysis ──────────────────────────────
    ("noel_reports", "NOEL Reports (Alt)", "think_tank", "en"),
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
    "cyber": "Cyber Warfare",
    "naval": "Naval / Black Sea",
    "air_defense": "Air Defense & Monitoring",
    "casualties": "Casualties & Equipment Losses",
    "satellite": "Satellite & Geospatial OSINT",
    "drone": "Drone Warfare",
    "foreign_vol": "Foreign Volunteer Units",
    "think_tank": "Think Tanks & Analysis",
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
    """Detect if text is primarily Russian, Ukrainian, or English."""
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


# ── Ollama TranslateGemma ────────────────────────────────────────────────

def _ollama_translate(text: str, detected_lang: str) -> str:
    """Translate via local Ollama HY-MT1.5. Thread-safe."""
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
    """Translate all messages for a channel concurrently via ThreadPoolExecutor."""
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


# ── Telegram scraper ─────────────────────────────────────────────────────

def scrape_channel(username: str) -> list:
    url = f"https://t.me/s/{username}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})

    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            html = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        log(f"  HTTP {e.code} for {username}")
        return []
    except Exception as e:
        log(f"  Failed to fetch {username}: {e}")
        return []

    messages = []
    msg_wraps = re.split(r'(?=<div class="tgme_widget_message_wrap)', html)

    for wrap in msg_wraps:
        if 'tgme_widget_message_wrap' not in wrap:
            continue

        post_match = re.search(r'data-post="([^"]+)"', wrap)
        if not post_match:
            continue
        post_id = post_match.group(1)
        link = f"https://t.me/{post_id}"

        text = ""
        text_match = re.search(
            r'class="tgme_widget_message_text[^"]*"[^>]*>(.*?)</div>',
            wrap, re.DOTALL
        )
        if text_match:
            raw_html = text_match.group(1)
            text = raw_html.replace("<br/>", "\n").replace("<br>", "\n")
            text = re.sub(r'<[^>]+>', ' ', text).strip()
            text = unescape(text)
            text = re.sub(r' +', ' ', text)

        time_match = re.search(r'<time[^>]*datetime="([^"]+)"', wrap)
        dt_str = time_match.group(1) if time_match else ""

        views_match = re.search(r'class="tgme_widget_message_views">([^<]+)', wrap)
        views = views_match.group(1).strip() if views_match else ""

        # ── MEDIA ───────────────────────────────────────────────────
        media = []

        video_srcs = re.findall(r'<video[^>]+src="([^"]+)"', wrap)
        for vsrc in video_srcs:
            thumb_match = re.search(
                r'tgme_widget_message_video_thumb[^"]*"[^>]*style="background-image:url\(\'([^\']+)\'\)',
                wrap
            )
            media.append({
                "type": "video",
                "url": vsrc,
                "thumbnail": thumb_match.group(1) if thumb_match else "",
            })

        photo_urls = re.findall(
            r'class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\(\'([^\']+)\'\)',
            wrap
        )
        for purl in photo_urls:
            if 'telesco.pe' in purl or 'telegram.org/file' in purl:
                media.append({"type": "photo", "url": purl})

        if not photo_urls:
            inline_photos = re.findall(
                r'tgme_widget_message_photo[^"]*"[^>]*style="[^"]*background-image:url\(\'([^\']+)\'\)',
                wrap
            )
            for purl in inline_photos:
                if 'telesco.pe' in purl or 'telegram.org/file' in purl:
                    media.append({"type": "photo", "url": purl})

        if not text and not media:
            continue

        messages.append({
            "text": text if text else "(media only)",
            "datetime": dt_str,
            "link": link,
            "views": views,
            "media": media,
            "has_video": any(m["type"] == "video" for m in media),
            "has_photo": any(m["type"] == "photo" for m in media),
        })

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

def main():
    log("Starting Telegram intel fetch...")
    channels, category_labels = load_channel_config()

    # Warm up Ollama model
    try:
        _ollama_translate("тест", "ru")
        log(f"Ollama {OLLAMA_MODEL} ready ({OLLAMA_WORKERS} concurrent workers)")
    except Exception as e:
        log(f"FATAL: Ollama not available: {e}")
        log(f"Make sure ollama is running and {OLLAMA_MODEL} is pulled")
        sys.exit(1)

    all_channels = []
    total_messages = 0
    translated_count = 0
    failed_count = 0

    for i, (username, label, category, lang_hint) in enumerate(channels):
        if i > 0:
            time.sleep(DELAY_BETWEEN_CHANNELS_S)

        log(f"Scraping @{username} ({label})...")
        raw_msgs = scrape_channel(username)
        log(f"  {len(raw_msgs)} messages found")

        # Concurrent translation for the whole channel
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

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    output = {
        "timestamp": now,
        "source": "Telegram public channels",
        "total_channels": len(channels),
        "channels_fetched": len([c for c in all_channels if c["message_count"] > 0]),
        "total_messages": total_messages,
        "translated_messages": translated_count,
        "failed_translations": failed_count,
        "translation_engine": f"Ollama HY-MT1.5-1.8B Q8_0 (local)",
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


if __name__ == "__main__":
    main()
