export type XProfileSyncDiagnostics = {
  required: boolean;
  status:
    | "synced"
    | "missing_account"
    | "missing_access_token"
    | "transient_profile_failure"
    | "profile_lookup_failed"
    | "db_error";
  accessSource?: "d1_account";
  hasRefreshToken?: boolean;
  refreshAttempted?: boolean;
  refreshSucceeded?: boolean;
  tokenScope?: string | null;
  tokenUserIdHint?: string | null;
  error?: string | null;
  fallbackApplied?: boolean;
  fallbackUserId?: string | null;
};

export type PublicXProfileSyncDiagnostics = {
  required: boolean;
  status: XProfileSyncDiagnostics["status"];
  retryable?: boolean;
  hasRefreshToken?: boolean;
  refreshAttempted?: boolean;
  refreshSucceeded?: boolean;
  fallbackApplied?: boolean;
  error?: string | null;
};

export function sanitizeDiagnosticErrorForClient(error: string | null | undefined, maxLen = 260): string | null {
  if (typeof error !== "string") return null;
  const compact = error.replace(/\s+/g, " ").trim();
  if (!compact) return null;
  return compact.length > maxLen ? `${compact.slice(0, maxLen)}...` : compact;
}

export function buildClientXProfileDiagnostics(
  diagnostics: XProfileSyncDiagnostics | null,
  includeSensitive: boolean,
): PublicXProfileSyncDiagnostics | XProfileSyncDiagnostics | null {
  if (!diagnostics) return null;
  const safeError = sanitizeDiagnosticErrorForClient(diagnostics.error);
  if (includeSensitive) {
    return {
      ...diagnostics,
      error: safeError,
    };
  }
  return {
    required: diagnostics.required,
    status: diagnostics.status,
    retryable: diagnostics.status === "transient_profile_failure",
    hasRefreshToken: diagnostics.hasRefreshToken,
    refreshAttempted: diagnostics.refreshAttempted,
    refreshSucceeded: diagnostics.refreshSucceeded,
    fallbackApplied: diagnostics.fallbackApplied,
    ...(diagnostics.status === "transient_profile_failure" ? { error: "transient_profile_failure" } : {}),
  };
}
