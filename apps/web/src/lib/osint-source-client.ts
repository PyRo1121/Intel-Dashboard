import type { OsintSourceProfileResponse } from "@intel-dashboard/shared/osint-source-profile.ts";
import { fetchClientJson } from "./client-json.ts";

export async function fetchOsintSourceProfile(provider: string): Promise<OsintSourceProfileResponse | null> {
  const result = await fetchClientJson<OsintSourceProfileResponse>(
    `/api/osint/source-history/${encodeURIComponent(provider)}`,
  );
  return result.ok ? result.data : null;
}

