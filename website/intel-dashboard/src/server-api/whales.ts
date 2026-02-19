import type { APIEvent } from "@solidjs/start/server";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let cache: { data: unknown; ts: number } | null = null;

interface WhaleAlert {
  id: string;
  type: "large_transfer" | "exchange_flow" | "unknown_wallet" | "institution";
  blockchain: string;
  amount: number;
  amountUSD: number;
  from: string;
  to: string;
  timestamp: number;
  txHash: string;
}

async function fetchWhaleAlerts(): Promise<WhaleAlert[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return cache.data as WhaleAlert[];
  }

  try {
    // Try WhaleAlert API (free tier)
    const res = await fetch("https://api.whale-alert.io/v1/transactions?min_value=1000000", {
      headers: { "Api-Key": "demo" }
    });
    
    if (res.ok) {
      const data = await res.json();
      const alerts: WhaleAlert[] = (data.transactions || []).map((tx: any) => ({
        id: tx.hash || Math.random().toString(36),
        type: tx.from?.owner_type === "exchange" ? "exchange_flow" : "unknown_wallet",
        blockchain: tx.blockchain,
        amount: tx.amount,
        amountUSD: tx.amount_usd,
        from: tx.from?.address || "unknown",
        to: tx.to?.address || "unknown",
        timestamp: tx.timestamp,
        txHash: tx.hash,
      }));
      
      cache = { data: alerts, ts: Date.now() };
      return alerts;
    }
  } catch (error) {
    console.error("Whale API error:", error);
  }
  
  // Return mock data if API fails
  return cache?.data as WhaleAlert[] || [];
}

export async function GET({ request }: APIEvent) {
  const alerts = await fetchWhaleAlerts();
  
  return new Response(JSON.stringify(alerts.slice(0, 10)), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
