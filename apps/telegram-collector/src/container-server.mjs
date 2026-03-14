import http from "node:http";
import { Api } from "telegram";
import { readTelegramCollectorRuntimeConfig } from "./runtime-config.mjs";
import { forwardCollectorBatch } from "./edge-client.mjs";
import { normalizeTelegramEventMessage } from "./container-message.mjs";

const port = Number.parseInt(process.env.PORT || "8080", 10);
const config = readTelegramCollectorRuntimeConfig(process.env);

const state = {
  configured: config.missingConfig.length === 0,
  connected: false,
  connecting: false,
  lastForwardAt: null,
  lastError: null,
  forwardedMessages: 0,
  droppedMessages: 0,
  bufferSize: 0,
  joinedChannels: [],
  missingChannels: [],
  connectAttempts: 0,
  lastConnectAttemptAt: null,
  lastConnectSuccessAt: null,
};

const CONNECT_RETRY_MS = 15000;
let client = null;
let flushTimer = null;
let reconnectTimer = null;
const buffer = [];
const channelMap = new Map(config.channels.map((item) => [item.username, item]));

function scheduleReconnect() {
  if (reconnectTimer || !state.configured || state.connected || state.connecting) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connectClient();
  }, CONNECT_RETRY_MS);
}

process.on("unhandledRejection", (error) => {
  state.lastError = error instanceof Error ? error.message : String(error);
  state.connected = false;
  state.connecting = false;
  scheduleReconnect();
});

process.on("uncaughtException", (error) => {
  state.lastError = error instanceof Error ? error.message : String(error);
  state.connected = false;
  state.connecting = false;
  scheduleReconnect();
});

async function refreshChannelAvailability() {
  if (!client) return;
  try {
    const dialogs = await client.getDialogs({ limit: 500 });
    const available = new Set(
      dialogs
        .map((dialog) => String(dialog?.entity?.username || "").trim().toLowerCase())
        .filter(Boolean),
    );
    state.joinedChannels = config.channels
      .map((item) => item.username)
      .filter((username) => available.has(username));
    state.missingChannels = config.channels
      .map((item) => item.username)
      .filter((username) => !available.has(username));
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  }
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
  if (buffer.length > 0) {
    scheduleFlush();
  }
}

async function forwardBatchMessages(batchMessages) {
  if (!state.configured || batchMessages.length === 0) {
    return { ok: true, applied: 0 };
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
    return {
      ok: true,
      applied:
        typeof payload?.appliedAccepted === "number" && Number.isFinite(payload.appliedAccepted)
          ? payload.appliedAccepted
          : batchMessages.length,
    };
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
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
        const normalized = normalizeTelegramEventMessage({ event, channelMap });
        if (!normalized) return;
        buffer.push(normalized);
        state.bufferSize = buffer.length;
        scheduleFlush();
      } catch (error) {
        state.lastError = error instanceof Error ? error.message : String(error);
      }
    }, new NewMessage({ chats: config.channels.map((item) => item.username) }));
    client = nextClient;
    state.connected = true;
    state.lastError = null;
    state.lastConnectSuccessAt = new Date().toISOString();
    await refreshChannelAvailability();
  } catch (error) {
    state.connected = false;
    state.lastError = error instanceof Error ? error.message : String(error);
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
      ok: true,
      runtime: "telegram-collector-container",
        configured: state.configured,
        missingConfig: config.missingConfig,
      connected: state.connected,
      connecting: state.connecting,
      watchedChannels: config.channels.map((item) => item.username),
      joinedChannels: state.joinedChannels,
      missingChannels: state.missingChannels,
      lastForwardAt: state.lastForwardAt,
      forwardedMessages: state.forwardedMessages,
      droppedMessages: state.droppedMessages,
      bufferSize: state.bufferSize,
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
    }));
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "Not Found" }));
});

server.listen(port, "0.0.0.0");
server.on("listening", () => {
  setTimeout(() => {
    void connectClient();
  }, 250);
});
