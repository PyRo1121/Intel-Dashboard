#!/usr/bin/env python3
"""Format polymarket JSON into human-readable TXT for the bot."""
import json, sys, os
from datetime import datetime

data = json.load(sys.stdin)
markets = data.get("markets", [])
stats = data.get("stats", {})
movers = data.get("movers", [])
easy = data.get("easyWins", [])
now = os.environ.get("REFRESH_TIME", datetime.now().strftime("%m/%d/%Y, %I:%M:%S %p"))

print("=== POLYMARKET INTEL ===")
print(f"Updated: {now}")
print(f"Total Markets: {stats.get('totalMarkets', '?')} | Volume: ${stats.get('totalVolume', 0):,.0f}")
print()

def fmt_outcomes(m):
    names = m.get("outcomes", [])
    prices = m.get("outcomePrices", [])
    parts = []
    for i, name in enumerate(names[:3]):
        p = prices[i] if i < len(prices) else 0
        parts.append(f"{name}: {float(p)*100:.0f}%")
    return ", ".join(parts)

if movers:
    print("--- MOVERS (biggest price swings) ---")
    for m in movers[:15]:
        print(f"• {m.get('question', '?')}")
        print(f"  {fmt_outcomes(m)}")
    print()

if easy:
    print("--- EASY WINS (high-confidence bets) ---")
    for e in easy[:10]:
        name = e.get("market", e.get("question", "?"))
        price = e.get("price", 0)
        vol = e.get("volume", 0)
        etype = e.get("type", "")
        print(f"• {name}")
        print(f"  Confidence: {float(price)*100:.0f}% | Volume: ${float(vol):,.0f} | Type: {etype}")
    print()

print("--- TOP MARKETS BY VOLUME ---")
for m in sorted(markets, key=lambda x: x.get("volumeNum", 0), reverse=True)[:20]:
    vol = m.get("volumeNum", 0)
    cat = m.get("category", "?")
    print(f"• [{cat}] {m.get('question', '?')}")
    print(f"  Volume: ${vol:,.0f} | {fmt_outcomes(m)}")
