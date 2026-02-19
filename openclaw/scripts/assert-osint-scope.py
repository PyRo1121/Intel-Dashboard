#!/usr/bin/env python3
import json
import re
import sys
from pathlib import Path

ROOT = Path("/home/pyro1121/.openclaw")
JOBS_PATH = ROOT / "cron" / "jobs.json"

ACTIVE_DOCS = [
    ROOT / "workspace" / "IDENTITY.md",
    ROOT / "workspace" / "TOOLS.md",
    ROOT / "workspace" / "SOUL.md",
    ROOT / "workspace" / "MEMORY.md",
    ROOT / "scripts" / "intel-refresh.sh",
]

BLOCKED = [
    re.compile(r"\bpolymarket\b", re.IGNORECASE),
    re.compile(r"\bcrypto\b", re.IGNORECASE),
    re.compile(r"\bdrop-tracker\b", re.IGNORECASE),
    re.compile(r"\bdrops\b", re.IGNORECASE),
]

ALLOWED_CONTEXT = [
    re.compile(r"\bno market\b", re.IGNORECASE),
    re.compile(r"\bno drops\b", re.IGNORECASE),
    re.compile(r"\bintel-only\b", re.IGNORECASE),
]


def line_allowed(line: str) -> bool:
    return any(p.search(line) for p in ALLOWED_CONTEXT)


def check_text(path: Path, text: str) -> list[str]:
    violations: list[str] = []
    for idx, line in enumerate(text.splitlines(), 1):
        if line_allowed(line):
            continue
        for pattern in BLOCKED:
            if pattern.search(line):
                violations.append(f"{path}:{idx}: {line.strip()}")
                break
    return violations


def check_jobs() -> list[str]:
    violations: list[str] = []
    if not JOBS_PATH.exists():
        return [f"missing required file: {JOBS_PATH}"]

    data = json.loads(JOBS_PATH.read_text())
    for job in data.get("jobs", []):
        if not job.get("enabled", False):
            continue
        name = str(job.get("name", "unnamed"))
        payload = job.get("payload", {})
        message = str(payload.get("message", ""))
        for idx, line in enumerate(message.splitlines(), 1):
            if line_allowed(line):
                continue
            for pattern in BLOCKED:
                if pattern.search(line):
                    violations.append(f"jobs.json:{name}:line{idx}: {line.strip()}")
                    break
    return violations


def check_active_skills() -> list[str]:
    skills_root = ROOT / "workspace" / "skills"
    if not skills_root.exists():
        return [f"missing required dir: {skills_root}"]

    blocked_dirs = {
        "polymarket",
        "polymarket-analysis",
        "polymarket-arbitrage",
        "polymarket-intel",
        "polymarket-trader",
        "crypto-intel",
        "crypto-gold-monitor",
        "drop-tracker",
        "market-news-analyst",
        "institutional-flow-tracker",
    }
    violations: list[str] = []
    for name in blocked_dirs:
        p = skills_root / name
        if p.exists():
            violations.append(f"active skill still present: {p}")
    return violations


def main() -> int:
    violations: list[str] = []
    violations.extend(check_jobs())
    violations.extend(check_active_skills())

    for doc in ACTIVE_DOCS:
        if not doc.exists():
            violations.append(f"missing required file: {doc}")
            continue
        violations.extend(check_text(doc, doc.read_text()))

    result = {
        "ok": len(violations) == 0,
        "violations": violations,
    }
    print(json.dumps(result, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
