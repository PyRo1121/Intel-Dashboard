import { formatCrmAccountStatus } from "./crm-directory.ts";

export function getCrmCustomerCacheSourceLabel(source: string | null | undefined): string {
  switch (source) {
    case "stripe_live":
      return "Live Stripe";
    case "crm_customer_cache_stale":
      return "Cached (stale)";
    case "crm_customer_cache":
      return "Cached";
    default:
      return "Unknown";
  }
}

export function getCrmCustomerAccountStatusLabel(
  result:
    | {
        account?: {
          status?: string | null;
        };
      }
    | null
    | undefined,
): string {
  return formatCrmAccountStatus(result?.account?.status);
}

export function getCrmCustomerStripeCustomerId(
  result:
    | {
        account?: {
          stripeCustomerId?: string | null;
        };
      }
    | null
    | undefined,
): string {
  return result?.account?.stripeCustomerId || "—";
}

export function getCrmCustomerStripeSubscriptionId(
  result:
    | {
        account?: {
          stripeSubscriptionId?: string | null;
        };
        stripe?: {
          subscription?: {
            id?: string | null;
          } | null;
        };
      }
    | null
    | undefined,
): string {
  return result?.stripe?.subscription?.id || result?.account?.stripeSubscriptionId || "—";
}

export function getCrmCustomerCurrentPeriodEndMs(
  result:
    | {
        stripe?: {
          subscription?: {
            currentPeriodEndMs?: number | null;
          } | null;
        };
      }
    | null
    | undefined,
): number | undefined {
  const value = result?.stripe?.subscription?.currentPeriodEndMs;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function getCrmCustomerCacheFetchedAtMs(
  result:
    | {
        cache?: {
          fetchedAtMs?: number | null;
        };
      }
    | null
    | undefined,
): number | undefined {
  const value = result?.cache?.fetchedAtMs;
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function readCrmCustomerCharges<TCharge>(
  result:
    | {
        stripe?: {
          charges?: TCharge[] | null;
        };
      }
    | null
    | undefined,
): TCharge[] {
  return [...(result?.stripe?.charges ?? [])];
}
