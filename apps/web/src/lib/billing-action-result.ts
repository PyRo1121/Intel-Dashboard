import { isOwnerRole } from "@intel-dashboard/shared/entitlement.ts";
import type { BillingActionPayload, BillingStatusPayload } from "./billing-client.ts";

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

export function getBillingPortalState(result: BillingStatusPayload["result"] | undefined): {
  ownerBypass: boolean;
  portalAvailable: boolean;
  portalReady: boolean;
} {
  const ownerBypass = isOwnerRole(result?.role);
  const portalAvailable = result?.subscription?.portalAvailable === true;
  return {
    ownerBypass,
    portalAvailable,
    portalReady: ownerBypass || portalAvailable,
  };
}
