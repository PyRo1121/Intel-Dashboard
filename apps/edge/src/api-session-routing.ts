export function requiresSessionForApiPath(path: string): boolean {
  if (!path.startsWith("/api/")) {
    return false;
  }

  if (path.startsWith("/api/intel-dashboard/")) {
    return false;
  }

  switch (path) {
    case "/api/telegram/collector-ingest":
      return false;
    default:
      return true;
  }
}
