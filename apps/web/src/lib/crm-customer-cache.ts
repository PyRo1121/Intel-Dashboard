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

