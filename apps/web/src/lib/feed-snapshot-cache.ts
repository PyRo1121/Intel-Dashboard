export function loadSessionSnapshot<T>(key: string, maxAgeMs: number): T | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: unknown; value?: unknown };
    const savedAt = typeof parsed?.savedAt === 'number' && Number.isFinite(parsed.savedAt) ? parsed.savedAt : 0;
    if (savedAt <= 0 || Date.now() - savedAt > maxAgeMs) return null;
    return (parsed.value ?? null) as T | null;
  } catch {
    return null;
  }
}

export function saveSessionSnapshot<T>(key: string, value: T): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // ignore client storage failures
  }
}
