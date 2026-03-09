export function loadSessionSnapshot<T>(key: string, maxAgeMs: number): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const storage = window.sessionStorage;
    if (!storage) return null;
    const raw = storage.getItem(key);
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
  try {
    if (typeof window === 'undefined') return;
    const storage = window.sessionStorage;
    if (!storage) return;
    storage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
  } catch {
    // ignore client storage failures
  }
}
