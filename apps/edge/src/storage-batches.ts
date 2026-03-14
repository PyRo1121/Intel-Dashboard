export const MAX_DO_STORAGE_BATCH_ENTRIES = 128;

export function chunkEntries<T>(entries: readonly T[], batchSize = MAX_DO_STORAGE_BATCH_ENTRIES): T[][] {
  const normalizedBatchSize = Math.max(1, Math.floor(batchSize));
  const batches: T[][] = [];
  for (let index = 0; index < entries.length; index += normalizedBatchSize) {
    batches.push(entries.slice(index, index + normalizedBatchSize));
  }
  return batches;
}

export function collectStaleChunkKeys(
  prefix: string,
  previousChunkCount: number | null | undefined,
  nextChunkCount = 0,
): string[] {
  const previous = typeof previousChunkCount === "number" && Number.isFinite(previousChunkCount)
    ? Math.max(0, Math.floor(previousChunkCount))
    : 0;
  const next = Math.max(0, Math.floor(nextChunkCount));
  const keys: string[] = [];
  for (let index = next; index < previous; index += 1) {
    keys.push(`${prefix}:${index}`);
  }
  return keys;
}
