export function readLatestValue<T>(
  latest: T | undefined,
  current: T | undefined | null,
  fallback: T,
): T {
  return latest ?? current ?? fallback;
}

export function readLatestArray<T>(latest: T[] | undefined, current: T[] | undefined | null): T[] {
  return readLatestValue(latest, current, []);
}
