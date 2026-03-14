import { collectStaleChunkKeys } from "./storage-batches.ts";

type CacheMetadata = {
  timestamp: number;
  status: number;
};

export type ChunkedCacheWritePlan = {
  dataPuts: Record<string, string | number>;
  deleteKeys: string[];
  metaKey: string;
  metaValue: CacheMetadata;
};

export function buildChunkedCacheWritePlan(
  key: string,
  raw: string,
  metadata: CacheMetadata,
  previousChunkCount: number | null | undefined,
  chunkSize: number,
): ChunkedCacheWritePlan {
  if (raw.length <= chunkSize) {
    return {
      dataPuts: { [key]: raw },
      deleteKeys: [`${key}:chunks`, ...collectStaleChunkKeys(key, previousChunkCount, 0)],
      metaKey: `${key}:meta`,
      metaValue: metadata,
    };
  }

  const numChunks = Math.ceil(raw.length / chunkSize);
  const dataPuts: Record<string, string | number> = {
    [`${key}:chunks`]: numChunks,
  };
  for (let index = 0; index < numChunks; index += 1) {
    dataPuts[`${key}:${index}`] = raw.slice(index * chunkSize, (index + 1) * chunkSize);
  }

  return {
    dataPuts,
    deleteKeys: [key, ...collectStaleChunkKeys(key, previousChunkCount, numChunks)],
    metaKey: `${key}:meta`,
    metaValue: metadata,
  };
}
