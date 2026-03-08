export type UsageKvSeedEntry = {
  key: string;
  value: unknown;
  ttlSeconds?: number;
};

export const DEFAULT_SEED_PATH = "/api/intel-dashboard/usage-data-source/seed";
export const DEFAULT_BATCH_SIZE = 100;
export const MAX_BATCH_SIZE = 500;

export function buildSeedEndpointUrl(baseUrl: string, seedPath?: string): string {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new Error("worker base URL is required");
  }
  const url = new URL(baseUrl);
  const rawPath = typeof seedPath === "string" && seedPath.trim().length > 0 ? seedPath.trim() : DEFAULT_SEED_PATH;
  url.pathname = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function clampBatchSize(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BATCH_SIZE;
  }
  const normalized = Math.floor(value);
  if (normalized < 1) {
    return 1;
  }
  if (normalized > MAX_BATCH_SIZE) {
    return MAX_BATCH_SIZE;
  }
  return normalized;
}

export function chunkEntries(entries: UsageKvSeedEntry[], batchSize?: number): UsageKvSeedEntry[][] {
  const size = clampBatchSize(batchSize);
  if (entries.length === 0) {
    return [];
  }
  const chunks: UsageKvSeedEntry[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

export type SeedEntriesParams = {
  workerBaseUrl: string;
  adminToken: string;
  entries: UsageKvSeedEntry[];
  seedPath?: string;
  batchSize?: number;
  fetchFn?: typeof fetch;
};

export type SeedEntriesResult = {
  endpointUrl: string;
  batches: number;
  written: number;
};

function parseErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }
  const value = (payload as Record<string, unknown>).error;
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function parseWrittenCount(payload: unknown, fallback: number): number {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }
  const result = (payload as Record<string, unknown>).result;
  if (!result || typeof result !== "object") {
    return fallback;
  }
  const written = (result as Record<string, unknown>).written;
  return typeof written === "number" && Number.isFinite(written) ? Math.max(0, Math.floor(written)) : fallback;
}

export async function seedEntries(params: SeedEntriesParams): Promise<SeedEntriesResult> {
  const endpointUrl = buildSeedEndpointUrl(params.workerBaseUrl, params.seedPath);
  const adminToken = params.adminToken.trim();
  if (!adminToken) {
    throw new Error("admin token is required");
  }

  const fetchFn = params.fetchFn ?? fetch;
  const batches = chunkEntries(params.entries, params.batchSize);
  let written = 0;

  for (const batch of batches) {
    const response = await fetchFn(endpointUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ entries: batch }),
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      const message = parseErrorMessage(payload);
      throw new Error(message ? `seed failed with HTTP ${response.status}: ${message}` : `seed failed with HTTP ${response.status}`);
    }

    if (!payload || typeof payload !== "object" || (payload as Record<string, unknown>).ok !== true) {
      throw new Error("seed returned invalid payload");
    }

    written += parseWrittenCount(payload, batch.length);
  }

  return {
    endpointUrl,
    batches: batches.length,
    written,
  };
}
