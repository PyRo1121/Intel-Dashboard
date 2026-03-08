import { describe, expect, it, vi } from "vitest";
import { buildSeedEndpointUrl, chunkEntries, seedEntries, type UsageKvSeedEntry } from "./seed-client.js";

describe("seed client", () => {
  it("builds canonical seed endpoint url", () => {
    expect(buildSeedEndpointUrl("https://example.com")).toBe(
      "https://example.com/api/intel-dashboard/usage-data-source/seed",
    );
    expect(buildSeedEndpointUrl("https://example.com/x", "custom/seed")).toBe("https://example.com/custom/seed");
  });

  it("chunks entries by bounded batch size", () => {
    const entries: UsageKvSeedEntry[] = Array.from({ length: 5 }, (_v, idx) => ({
      key: `intel-dashboard:usage:k${idx}`,
      value: { idx },
    }));

    expect(chunkEntries(entries, 2)).toHaveLength(3);
    expect(chunkEntries(entries, 10_000)).toHaveLength(1);
    expect(chunkEntries([], 2)).toEqual([]);
  });

  it("posts seed entries with bearer auth and aggregates writes", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      expect(headers?.authorization).toBe("Bearer seed-token");

      const body = typeof init?.body === "string" ? JSON.parse(init.body) : null;
      const written = Array.isArray(body?.entries) ? body.entries.length : 0;
      return new Response(JSON.stringify({ ok: true, result: { written } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const result = await seedEntries({
      workerBaseUrl: "https://example.com",
      adminToken: "seed-token",
      entries: [
        { key: "intel-dashboard:usage:a", value: {} },
        { key: "intel-dashboard:usage:b", value: {} },
        { key: "intel-dashboard:usage:c", value: {} },
      ],
      batchSize: 2,
      fetchFn: fetchMock as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      endpointUrl: "https://example.com/api/intel-dashboard/usage-data-source/seed",
      batches: 2,
      written: 3,
    });
  });
});
