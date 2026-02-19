#!/usr/bin/env python3
"""Format crypto JSON into human-readable TXT for the bot."""
import json, sys, os
from datetime import datetime

data = json.load(sys.stdin)
now = os.environ.get("REFRESH_TIME", datetime.now().strftime("%m/%d/%Y, %I:%M:%S %p"))

print("=== CRYPTO PRICES ===")
print(f"Updated: {now}")
print("Source: CoinGecko via intel-dashboard backend")
print()
for coin in data:
    sym = coin.get("symbol", "?")
    name = coin.get("name", "?")
    price = coin.get("price", 0)
    change = coin.get("changePercent24h", 0) or 0
    mcap = coin.get("marketCap", 0)
    vol = coin.get("volume24h", 0)
    direction = "\u2191" if change >= 0 else "\u2193"
    print(f"\u2022 {sym} ({name}): ${price:,.2f} {direction} {change:+.2f}% 24h")
    print(f"  Market Cap: ${mcap:,.0f} | 24h Volume: ${vol:,.0f}")
