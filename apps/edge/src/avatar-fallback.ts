function hashStringFnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function encodeUtf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function escapeSvgText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pickInitial(name: string, login: string): string {
  const source = `${name} ${login}`.trim();
  const match = source.match(/[A-Za-z0-9]/);
  return (match?.[0] ?? "X").toUpperCase();
}

export function buildDeterministicAvatarDataUrl(params: {
  login: string;
  name?: string;
  size?: number;
}): string {
  const login = params.login.trim();
  const name = (params.name ?? "").trim();
  const seed = `${login}:${name}`;
  const hash = hashStringFnv1a(seed || "x");
  const size = Number.isFinite(params.size) ? Math.max(64, Math.min(512, Math.floor(params.size ?? 96))) : 96;
  const initial = pickInitial(name, login);
  const hueA = hash % 360;
  const hueB = (hueA + 58 + (hash % 47)) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Profile avatar">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="hsl(${hueA} 70% 34%)"/>
    <stop offset="100%" stop-color="hsl(${hueB} 72% 22%)"/>
  </linearGradient>
</defs>
<rect width="${size}" height="${size}" fill="url(#g)" rx="${Math.floor(size * 0.16)}"/>
<circle cx="${Math.floor(size * 0.75)}" cy="${Math.floor(size * 0.2)}" r="${Math.floor(size * 0.12)}" fill="hsla(${hueB} 88% 78% / 0.35)"/>
<text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle" fill="#EAF4FF" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-size="${Math.floor(size * 0.42)}" font-weight="700">${escapeSvgText(initial)}</text>
</svg>`;
  const encoded = encodeUtf8ToBase64(svg);
  return `data:image/svg+xml;base64,${encoded}`;
}

