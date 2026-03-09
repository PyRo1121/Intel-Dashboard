export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  header.split(";").forEach((cookie) => {
    const eq = cookie.indexOf("=");
    if (eq > 0) {
      cookies[cookie.slice(0, eq).trim()] = cookie.slice(eq + 1).trim();
    }
  });
  return cookies;
}

export function clearCookie(name: string): string {
  return `${name}=deleted; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function getSetCookieValues(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === "function") {
    return withGetSetCookie.getSetCookie();
  }
  const raw = headers.get("set-cookie");
  if (!raw) return [];
  const values: string[] = [];
  let start = 0;
  for (let index = 0; index < raw.length; index += 1) {
    if (raw[index] !== ",") continue;
    const rest = raw.slice(index + 1);
    if (!/^\s*[^;,=\s]+=/.test(rest)) continue;
    const value = raw.slice(start, index).trim();
    if (value) values.push(value);
    start = index + 1;
  }
  const last = raw.slice(start).trim();
  if (last) values.push(last);
  return values;
}
