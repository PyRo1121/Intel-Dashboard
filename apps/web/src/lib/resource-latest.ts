export function readLatestArray<T>(latest: T[] | undefined, current: T[] | undefined | null): T[] {
  return latest ?? current ?? [];
}

