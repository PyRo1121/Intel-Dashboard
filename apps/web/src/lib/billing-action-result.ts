import type { BillingActionPayload } from "./billing-client.ts";

export function getBillingTrialNotice(result: BillingActionPayload["result"] | undefined): string {
  if (result?.owner === true) {
    return "Owner account detected. Trial activation is not required.";
  }
  if (result?.trialStarted === true) {
    return "Trial started. Entitlements updated.";
  }
  if (result?.trialEligible === false) {
    return "Trial is not available for this account.";
  }
  return "Trial status updated.";
}

export function getBillingCheckoutBypassNotice(): string {
  return "Owner account detected. Checkout bypass is active.";
}

export function getBillingPortalBypassNotice(): string {
  return "Owner account detected. Stripe portal is not required.";
}
