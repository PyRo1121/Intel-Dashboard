import { createMemo, createResource, createSignal, For, Show } from "solid-js";
import { useLiveRefresh } from "~/lib/live-refresh";

interface ChatHistoryMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  model?: string;
  provider?: string;
}

interface ChatHistorySession {
  sessionId: string;
  updatedAt: string;
  messageCount: number;
  messages: ChatHistoryMessage[];
}

interface ChatHistoryResponse {
  generatedAt: string;
  totalSessions: number;
  returnedSessions: number;
  sessions: ChatHistorySession[];
}

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

async function loadChatHistory(
  sessions: number,
  messages: number,
): Promise<ChatHistoryResponse | null> {
  try {
    const params = new URLSearchParams({
      sessions: String(sessions),
      messages: String(messages),
    });
    const res = await fetch(`/api/chat-history?${params.toString()}`, {
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ChatHistoryResponse;
  } catch {
    return null;
  }
}

export default function ChatHistoryPage() {
  const [sessionLimit, setSessionLimit] = createSignal(6);
  const [messageLimit, setMessageLimit] = createSignal(25);

  const [data, { refetch }] = createResource(
    () => [sessionLimit(), messageLimit()] as const,
    ([sessions, messages]) => loadChatHistory(sessions, messages),
  );

  const response = createMemo(() => data.latest ?? data() ?? null);
  const sessions = createMemo(() => response()?.sessions ?? []);
  const loadingInitial = createMemo(() => data.state === "pending" && !response());

  useLiveRefresh(() => {
    void refetch();
  }, 60_000, { runImmediately: false });

  return (
    <div class="space-y-6 animate-fade-in">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-white tracking-tight">Chat History</h1>
          <p class="text-sm text-zinc-500 mt-1.5">
            Recent OpenClaw conversation sessions from local JSONL transcripts
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <label class="text-xs text-zinc-500">
            Sessions
            <select
              class="ml-2 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-zinc-200"
              value={sessionLimit()}
              onInput={(event) => setSessionLimit(Number(event.currentTarget.value))}
            >
              <option value={4}>4</option>
              <option value={6}>6</option>
              <option value={10}>10</option>
              <option value={15}>15</option>
            </select>
          </label>

          <label class="text-xs text-zinc-500">
            Messages
            <select
              class="ml-2 bg-zinc-900 border border-white/10 rounded-lg px-2 py-1 text-zinc-200"
              value={messageLimit()}
              onInput={(event) => setMessageLimit(Number(event.currentTarget.value))}
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={40}>40</option>
              <option value={60}>60</option>
            </select>
          </label>

          <button
            class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5"
            onClick={() => refetch()}
          >
            Refresh
          </button>
        </div>
      </div>

      <Show when={loadingInitial()}>
        <div class="surface-card p-6 text-sm text-zinc-500">Loading chat history...</div>
      </Show>

      <Show when={!loadingInitial() && !response()}>
        <div class="surface-card p-6 text-sm text-zinc-500">
          Chat history endpoint is unavailable.
        </div>
      </Show>

      <Show when={response() && sessions().length === 0}>
        <div class="surface-card p-6 text-sm text-zinc-500">No sessions found.</div>
      </Show>

      <Show when={response() && sessions().length > 0}>
        <div class="flex items-center gap-3 text-xs text-zinc-500">
          <span>Total sessions: {response()?.totalSessions ?? 0}</span>
          <span>Returned: {response()?.returnedSessions ?? 0}</span>
          <span>Generated: {formatTimestamp(response()?.generatedAt ?? "")}</span>
        </div>

        <div class="space-y-4">
          <For each={sessions()}>
            {(session) => (
              <div class="surface-card p-4 space-y-3">
                <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <h2 class="text-sm font-semibold text-white break-all">{session.sessionId}</h2>
                  <div class="text-xs text-zinc-500">
                    {session.messageCount} messages · updated {formatTimestamp(session.updatedAt)}
                  </div>
                </div>

                <div class="space-y-2">
                  <For each={session.messages}>
                    {(message) => (
                      <div class="rounded-xl border border-white/5 bg-black/20 p-3">
                        <div class="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <span class="rounded-md bg-white/10 px-2 py-0.5 text-zinc-200 uppercase">
                            {message.role}
                          </span>
                          <span class="text-zinc-500">{formatTimestamp(message.timestamp)}</span>
                          <Show when={message.provider && message.model}>
                            <span class="text-zinc-600">{message.provider}/{message.model}</span>
                          </Show>
                        </div>
                        <pre class="whitespace-pre-wrap break-words text-sm text-zinc-300 font-sans">
                          {message.text}
                        </pre>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
