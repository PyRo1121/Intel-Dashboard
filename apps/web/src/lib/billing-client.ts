import { fetchClientJson } from "./client-json.ts";

export type BillingStatusPayload = {
  ok?: boolean;
  result?: {
    userId?: string;
    tier?: string;
    role?: string;
    entitled?: boolean;
    delayMinutes?: number;
    monthlyPriceUsd?: number;
    trialDays?: number;
    subscription?: {
      status?: string;
      expiresLabel?: string | null;
      monthsRemaining?: string | null;
      portalAvailable?: boolean;
      stripeCustomerPresent?: boolean;
    };
  };
};

export type BillingActionPayload = {
  ok?: boolean;
  error?: string;
  result?: {
    owner?: boolean;
    trialStarted?: boolean;
    trialEligible?: boolean;
    bypassCheckout?: boolean;
    bypassPortal?: boolean;
    checkoutUrl?: string | null;
    portalUrl?: string | null;
  };
};

export type BillingActivityEvent = {
  id?: string;
  atMs?: number;
  kind?: string;
  source?: string;
  status?: string;
  note?: string;
  stripeEventType?: string;
};

export type BillingActivityPayload = {
  ok?: boolean;
  result?: {
    events?: BillingActivityEvent[];
    total?: number;
    limit?: number;
  };
};

export async function fetchBillingStatus(): Promise<BillingStatusPayload | null> {
  const result = await fetchClientJson<BillingStatusPayload>("/api/billing/status", {
    method: "GET",
  });
  return result.ok ? result.data : null;
}

export async function fetchBillingActivity(): Promise<BillingActivityPayload | null> {
  const result = await fetchClientJson<BillingActivityPayload>("/api/billing/activity", {
    method: "GET",
  });
  return result.ok ? result.data : null;
}

export async function callBillingAction(path: string): Promise<BillingActionPayload> {
  const result = await fetchClientJson<BillingActionPayload>(path, {
    method: "POST",
    body: "{}",
  });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return result.data;
}
