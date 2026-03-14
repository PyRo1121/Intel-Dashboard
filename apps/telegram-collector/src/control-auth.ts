export function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() || null : null;
}

export function hasCollectorControlAccess(request: Request, configuredSecret: string | undefined): boolean {
  const expected = configuredSecret?.trim() || "";
  if (!expected) {
    return false;
  }
  const provided = parseBearerToken(request) || "";
  return provided.length > 0 && provided === expected;
}
