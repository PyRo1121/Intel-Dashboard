export const MAX_DO_STORAGE_BATCH_ENTRIES = 128;

export function chunkEntries<T>(entries: readonly T[], batchSize = MAX_DO_STORAGE_BATCH_ENTRIES): T[][] {
  const normalizedBatchSize = Math.max(1, Math.floor(batchSize));
  const batches: T[][] = [];
  for (let index = 0; index < entries.length; index += normalizedBatchSize) {
    batches.push(entries.slice(index, index + normalizedBatchSize));
  }
  return batches;
}
