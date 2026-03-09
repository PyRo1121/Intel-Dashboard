import { fetchClientJson, fetchPublicJson } from "./client-json.ts";

export type TelegramDedupeFeedbackStatus = {
  ownerEnabled: boolean;
  count: number;
};

export type TelegramDedupeFeedbackAction = "merge" | "split" | "clear";

type ClientJsonUnknownResult = Awaited<ReturnType<typeof fetchClientJson<unknown>>>;

function withOptionalSignal(signal?: AbortSignal): { signal?: AbortSignal } {
  return signal ? { signal } : {};
}

export async function fetchTelegramFeed<T>(signal?: AbortSignal): Promise<T | null> {
  const result = await fetchPublicJson<T>("/api/telegram", withOptionalSignal(signal));
  return result.ok ? result.data : null;
}

export async function fetchTelegramDedupeFeedbackStatus(signal?: AbortSignal): Promise<TelegramDedupeFeedbackStatus | null> {
  const result = await fetchClientJson<{ count?: unknown }>("/api/telegram/dedupe-feedback", withOptionalSignal(signal));
  if (!result.ok) {
    if (result.status === 403) {
      return { ownerEnabled: false, count: 0 };
    }
    return null;
  }
  const count =
    typeof result.data.count === "number" && Number.isFinite(result.data.count)
      ? Math.max(0, Math.floor(result.data.count))
      : 0;
  return { ownerEnabled: true, count };
}

export async function postTelegramDedupeFeedback(args: {
  action: TelegramDedupeFeedbackAction;
  signatures: string[];
  targetCluster?: string;
}): Promise<ClientJsonUnknownResult> {
  return fetchClientJson<unknown>("/api/telegram/dedupe-feedback", {
    method: "POST",
    body: JSON.stringify({
      action: args.action,
      signatures: args.signatures,
      ...(args.targetCluster ? { targetCluster: args.targetCluster } : {}),
    }),
  });
}
