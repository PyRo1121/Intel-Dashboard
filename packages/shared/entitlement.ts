export function formatEntitlementTier(value: string | undefined): string {
  const raw = (value || "free").trim().toLowerCase();
  if (raw === "owner") return "Owner";
  if (raw === "subscriber") return "Subscriber";
  if (raw === "trial") return "Trial";
  return "Free";
}

export function isEntitledRole(value: string | undefined): boolean {
  const raw = (value || "").trim().toLowerCase();
  return raw === "owner" || raw === "subscriber";
}

export function isOwnerRole(value: string | undefined): boolean {
  return (value || "").trim().toLowerCase() === "owner";
}

export function entitlementTierTone(value: string | undefined): string {
  const raw = (value || "free").trim().toLowerCase();
  if (raw === "owner") return "text-emerald-300";
  if (raw === "subscriber") return "text-sky-300";
  if (raw === "trial") return "text-amber-300";
  return "text-zinc-500";
}

export function formatSubscriptionStatus(value: string | undefined): string {
  const raw = (value || "none").trim().toLowerCase();
  if (raw === "trialing") return "Trialing";
  if (raw === "active") return "Active";
  if (raw === "owner") return "Owner lifetime";
  if (raw === "canceled") return "Canceled";
  if (raw === "expired") return "Expired";
  return "None";
}
