import http from "node:http";
import { readTelegramCollectorRuntimeConfig } from "./runtime-config.mjs";
import { forwardCollectorBatch, signCollectorRequest } from "./edge-client.mjs";
import { isLikelyChannelEvent, normalizeTelegramEventMessage } from "./event-routing.mjs";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const config = readTelegramCollectorRuntimeConfig(process.env);

const state = {
  configured: config.missingConfig.length === 0,
  connected: false,
  connecting: false,
  lastForwardAt: null,
  lastError: null,
  receivedMessages: 0,
  matchedMessages: 0,
  forwardedMessages: 0,
  droppedMessages: 0,
  unmatchedMessages: 0,
  bufferSize: 0,
  lastEventAt: null,
  lastUnmatchedEvent: null,
  joinedChannels: [],
  missingChannels: [],
  mappedChannelIds: 0,
  controlSyncAttempts: 0,
  lastControlSyncAt: null,
  lastControlSyncError: null,
  joinBlockedUntil: null,
  joinWaitSeconds: 0,
  connectAttempts: 0,
  lastConnectAttemptAt: null,
  lastConnectSuccessAt: null,
};

const CONNECT_RETRY_MS = 15000;
const JOIN_RETRY_MS = 300000;
const AVAILABILITY_REFRESH_MS = 60000;

function extractJoinWaitSeconds(message) {
  const match = String(message || '').match(/wait of\s+(\d+)\s+seconds/i);
  return match ? Number.parseInt(match[1], 10) : null;
}
let client = null;
let flushTimer = null;
let reconnectTimer = null;
let joinRetryTimer = null;
let availabilityRefreshTimer = null;
let TelegramApi = null;
const buffer = [];
const channelMap = new Map(config.channels.map((item) => [item.username, item]));
const channelIdMap = new Map();

let controlFlushTimer = null;

function buildControlStatePayload() {
  return {
    accountId: config.accountId,
    configured: state.configured,
    missingConfig: config.missingConfig,
    connected: state.connected,
    connecting: state.connecting,
    watchedChannels: config.channels.map((item) => item.username),
    joinedChannels: state.joinedChannels,
    missingChannels: state.missingChannels,
    mappedChannelIds: state.mappedChannelIds,
    lastEventAt: state.lastEventAt,
    lastForwardAt: state.lastForwardAt,
    receivedMessages: state.receivedMessages,
    matchedMessages: state.matchedMessages,
    forwardedMessages: state.forwardedMessages,
    droppedMessages: state.droppedMessages,
    unmatchedMessages: state.unmatchedMessages,
    bufferSize: state.bufferSize,
    lastUnmatchedEvent: state.lastUnmatchedEvent,
    lastError: state.lastError,
    connectAttempts: state.connectAttempts,
    lastConnectAttemptAt: state.lastConnectAttemptAt,
    lastConnectSuccessAt: state.lastConnectSuccessAt,
    updatedAt: new Date().toISOString(),
  };
}

async function pushControlState() {
  if (!config.selfUrl || !config.sharedSecret) return;
  state.controlSyncAttempts += 1;
  try {
    const url = new URL('/control/state-update', config.selfUrl);
    const headers = signCollectorRequest({ method: 'POST', path: url.pathname, secret: config.sharedSecret });
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(buildControlStatePayload()),
    });
    state.lastControlSyncAt = new Date().toISOString();
    state.lastControlSyncError = response.ok ? null : `HTTP ${response.status}`;
  } catch (error) {
    state.lastControlSyncAt = new Date().toISOString();
    state.lastControlSyncError = error instanceof Error ? error.message : String(error);
  }
}

function scheduleControlStatePush() {
  if (controlFlushTimer) return;
  controlFlushTimer = setTimeout(async () => {
    controlFlushTimer = null;
    await pushControlState();
  }, 250);
}

function scheduleReconnect() {
  if (reconnectTimer || !state.configured || state.connected || state.connecting) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectClient();
  }, CONNECT_RETRY_MS);
}

function scheduleJoinRetry() {
  if (joinRetryTimer || !state.configured || !state.connected || state.missingChannels.length === 0) return;
  const blockedUntilMs = state.joinBlockedUntil ? Date.parse(state.joinBlockedUntil) : Number.NaN;
  const nowMs = Date.now();
  const delay = Number.isFinite(blockedUntilMs) && blockedUntilMs > nowMs ? Math.max(blockedUntilMs - nowMs, JOIN_RETRY_MS) : JOIN_RETRY_MS;
  joinRetryTimer = setTimeout(() => {
    joinRetryTimer = null;
    void joinMissingChannels();
  }, delay);
}

function scheduleAvailabilityRefresh() {
  if (availabilityRefreshTimer || !state.configured || !state.connected) return;
  availabilityRefreshTimer = setTimeout(() => {
    availabilityRefreshTimer = null;
    void refreshChannelAvailability();
  }, AVAILABILITY_REFRESH_MS);
}

process.on("unhandledRejection", (error) => {
  state.lastError = error instanceof Error ? error.message : String(error);
  state.connected = false;
  state.connecting = false;
  if (joinRetryTimer) { clearTimeout(joinRetryTimer); joinRetryTimer = null; }
  if (availabilityRefreshTimer) { clearTimeout(availabilityRefreshTimer); availabilityRefreshTimer = null; }
  scheduleReconnect();
});

process.on("uncaughtException", (error) => {
  state.lastError = error instanceof Error ? error.message : String(error);
  state.connected = false;
  state.connecting = false;
  if (joinRetryTimer) { clearTimeout(joinRetryTimer); joinRetryTimer = null; }
  if (availabilityRefreshTimer) { clearTimeout(availabilityRefreshTimer); availabilityRefreshTimer = null; }
  scheduleReconnect();
});

async function refreshChannelAvailability() {
  if (!client) return;
  try {
    const dialogs = await client.getDialogs({ limit: 500 });
    const available = new Set();
    channelIdMap.clear();
    for (const dialog of dialogs) {
      const username = String(dialog?.entity?.username || "").trim().toLowerCase();
      if (username) available.add(username);
      const id = dialog?.entity?.id;
      const normalizedId = id === null || id === undefined ? null : String(id).trim();
      if (normalizedId && username && channelMap.has(username)) {
        channelIdMap.set(normalizedId, channelMap.get(username));
      }
    }
    state.joinedChannels = config.channels
      .map((item) => item.username)
      .filter((username) => available.has(username));
    state.missingChannels = config.channels
      .map((item) => item.username)
      .filter((username) => !available.has(username));
    state.mappedChannelIds = channelIdMap.size;
    scheduleControlStatePush();
    scheduleJoinRetry();
    scheduleAvailabilityRefresh();
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    scheduleControlStatePush();
  }
}


async function joinMissingChannels() {
  if (!client || state.missingChannels.length === 0) return;
  const blockedUntilMs = state.joinBlockedUntil ? Date.parse(state.joinBlockedUntil) : Number.NaN;
  if (Number.isFinite(blockedUntilMs) && blockedUntilMs > Date.now()) {
    scheduleJoinRetry();
    return;
  }
  state.joinBlockedUntil = null;
  state.joinWaitSeconds = 0;
  if (!TelegramApi) {
    const telegramModule = await import("telegram");
    TelegramApi = telegramModule.Api;
  }
  for (const username of [...state.missingChannels]) {
    try {
      await client.invoke(new TelegramApi.channels.JoinChannel({ channel: username }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const waitSeconds = extractJoinWaitSeconds(message);
      if (waitSeconds && Number.isFinite(waitSeconds) && waitSeconds > 0) {
        state.joinWaitSeconds = waitSeconds;
        state.joinBlockedUntil = new Date(Date.now() + waitSeconds * 1000).toISOString();
        state.lastError = message;
        scheduleControlStatePush();
        break;
      }
      if (!/already participant|USER_ALREADY_PARTICIPANT|CHANNELS_TOO_MUCH/i.test(message)) {
        state.lastError = message;
      }
    }
  }
  await refreshChannelAvailability();
  scheduleJoinRetry();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(async () => {
    flushTimer = null;
    await flushBuffer();
  }, config.flushIntervalMs);
}

async function flushBuffer() {
  if (!state.configured || buffer.length === 0) return;
  const batchMessages = buffer.slice(0, buffer.length);
  const result = await forwardBatchMessages(batchMessages);
  if (!result.ok) {
    state.bufferSize = buffer.length;
    scheduleFlush();
    return;
  }
  buffer.splice(0, batchMessages.length);
  state.bufferSize = buffer.length;
  if (buffer.length > 0) scheduleFlush();
}

async function forwardBatchMessages(batchMessages) {
  if (!state.configured || batchMessages.length === 0) {
    return {
      ok: false,
      applied: 0,
      error: state.configured ? "empty_batch" : "collector_not_configured",
    };
  }
  try {
    const response = await forwardCollectorBatch({
      edgeUrl: config.edgeUrl,
      edgePath: config.edgePath,
      secret: config.sharedSecret,
      asyncApply: true,
      batch: {
        source: "mtproto",
        accountId: config.accountId,
        collectedAt: new Date().toISOString(),
        messages: batchMessages,
      },
    });
    if (!response.ok) {
      state.lastError = `collector_forward_failed:${response.status}`;
      return { ok: false, applied: 0, status: response.status };
    }
    const payload = await response.json().catch(() => null);
    state.lastForwardAt = new Date().toISOString();
    state.forwardedMessages += batchMessages.length;
    state.lastError = null;
    scheduleControlStatePush();
    return {
      ok: true,
      applied:
        typeof payload?.appliedAccepted === "number" && Number.isFinite(payload.appliedAccepted)
          ? payload.appliedAccepted
          : batchMessages.length,
    };
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    scheduleControlStatePush();
    return { ok: false, applied: 0 };
  }
}

async function connectClient() {
  if (!state.configured || state.connected || state.connecting) return;
  state.connecting = true;
  state.connectAttempts += 1;
  state.lastConnectAttemptAt = new Date().toISOString();
  try {
    const [{ TelegramClient }, { StringSession }, { NewMessage }] = await Promise.all([
      import("telegram"),
      import("telegram/sessions/index.js"),
      import("telegram/events/index.js"),
    ]);
    const nextClient = new TelegramClient(
      new StringSession(config.sessionString),
      config.apiId,
      config.apiHash,
      { connectionRetries: 5 },
    );
    await nextClient.connect();
    nextClient.addEventHandler(async (event) => {
      try {
        state.receivedMessages += 1;
        state.lastEventAt = new Date().toISOString();
        scheduleControlStatePush();
        if (!isLikelyChannelEvent(event)) return;
        const normalized = normalizeTelegramEventMessage(event, channelMap, channelIdMap);
        if (!normalized) {
          state.unmatchedMessages += 1;
          state.lastUnmatchedEvent = {
            username: String(event?.chat?.username || "").trim().toLowerCase() || null,
            chatId: event?.chatId == null ? null : String(event.chatId),
            peerChannelId: event?.message?.peerId?.channelId == null ? null : String(event.message.peerId.channelId),
            chatEntityId: event?.chat?.id == null ? null : String(event.chat.id),
            messageId: event?.message?.id == null ? null : String(event.message.id),
            at: new Date().toISOString(),
          };
          scheduleControlStatePush();
          return;
        }
        state.matchedMessages += 1;
        buffer.push(normalized);
        scheduleControlStatePush();
        state.bufferSize = buffer.length;
        scheduleFlush();
      } catch (error) {
        state.lastError = error instanceof Error ? error.message : String(error);
      }
    }, new NewMessage({}));
    client = nextClient;
    state.connected = true;
    state.lastError = null;
    state.lastConnectSuccessAt = new Date().toISOString();
    await refreshChannelAvailability();
    await joinMissingChannels();
    scheduleJoinRetry();
    scheduleAvailabilityRefresh();
    scheduleControlStatePush();
  } catch (error) {
    state.connected = false;
    state.lastError = error instanceof Error ? error.message : String(error);
    scheduleControlStatePush();
    scheduleReconnect();
  } finally {
    state.connecting = false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  console.log("[collector-container] route", req.method, url.pathname);

  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(state.configured ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: state.configured, runtime: "telegram-collector-container" }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/status") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: state.configured && state.connected,
      runtime: "telegram-collector-container",
        configured: state.configured,
        missingConfig: config.missingConfig,
      connected: state.connected,
      connecting: state.connecting,
      watchedChannels: config.channels.map((item) => item.username),
      joinedChannels: state.joinedChannels,
      missingChannels: state.missingChannels,
      mappedChannelIds: state.mappedChannelIds,
      lastControlSyncAt: state.lastControlSyncAt,
      lastControlSyncError: state.lastControlSyncError,
      controlSyncAttempts: state.controlSyncAttempts,
      lastEventAt: state.lastEventAt,
      lastForwardAt: state.lastForwardAt,
      receivedMessages: state.receivedMessages,
      matchedMessages: state.matchedMessages,
      forwardedMessages: state.forwardedMessages,
      droppedMessages: state.droppedMessages,
      unmatchedMessages: state.unmatchedMessages,
      bufferSize: state.bufferSize,
      lastUnmatchedEvent: state.lastUnmatchedEvent,
      lastError: state.lastError,
      connectAttempts: state.connectAttempts,
      lastConnectAttemptAt: state.lastConnectAttemptAt,
      lastConnectSuccessAt: state.lastConnectSuccessAt,
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/flush") {
    await flushBuffer();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, bufferSize: state.bufferSize }));
    return;
  }

  if (req.method === "POST" && (url.pathname === "/push-batch" || url.pathname === "/control/push-batch")) {
    let payload;
    try {
      payload = JSON.parse(await new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
      }));
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    const batchMessages = Array.isArray(payload?.messages) ? payload.messages : [];
    const result = await forwardBatchMessages(batchMessages);
    res.writeHead(result.ok ? 200 : 502, { "content-type": "application/json" });
    res.end(JSON.stringify(result));
    return;
  }

  if (req.method === "POST" && url.pathname === "/control/join-configured-channels") {
    if (!client) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Collector client unavailable" }));
      return;
    }

    const joined = [];
    const skipped = [];
    const failed = [];

    for (const channel of config.channels) {
      try {
        await client.invoke(new Api.channels.JoinChannel({ channel: channel.username }));
        joined.push(channel.username);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/already participant|USER_ALREADY_PARTICIPANT|CHANNELS_TOO_MUCH/i.test(message)) {
          skipped.push({ channel: channel.username, reason: message });
        } else {
          failed.push({ channel: channel.username, reason: message });
        }
      }
    }

    await refreshChannelAvailability();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      joined,
      skipped,
      failed,
      joinedChannels: state.joinedChannels,
      missingChannels: state.missingChannels,
      mappedChannelIds: state.mappedChannelIds,
    }));
    return;
  }

  if (req.method === "POST" && url.pathname === "/control/refresh-availability") {
    if (!client) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Collector client unavailable" }));
      return;
    }
    await refreshChannelAvailability();
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      joinedChannels: state.joinedChannels,
      missingChannels: state.missingChannels,
      mappedChannelIds: state.mappedChannelIds,
    }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(port, "0.0.0.0");
server.on("listening", () => {
  scheduleControlStatePush();
  setTimeout(() => {
    void connectClient();
  }, 5000);
});
