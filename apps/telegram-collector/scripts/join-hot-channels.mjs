import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { readTelegramCollectorRuntimeConfig } from "../src/runtime-config.mjs";

function trim(value) {
  return (value || "").trim();
}

async function main() {
  const config = readTelegramCollectorRuntimeConfig(process.env);
  const required = ["TELEGRAM_API_ID", "TELEGRAM_API_HASH", "TELEGRAM_SESSION_STRING", "TELEGRAM_HOT_CHANNELS"];
  const missing = required.filter((name) => {
    if (name === "TELEGRAM_API_ID") return !config.apiId;
    if (name === "TELEGRAM_API_HASH") return !config.apiHash;
    if (name === "TELEGRAM_SESSION_STRING") return !config.sessionString;
    if (name === "TELEGRAM_HOT_CHANNELS") return config.channels.length === 0;
    return false;
  });
  if (missing.length > 0) {
    throw new Error(`Missing required config: ${missing.join(", ")}`);
  }

  const client = new TelegramClient(
    new StringSession(config.sessionString),
    config.apiId,
    config.apiHash,
    { connectionRetries: 5 },
  );
  await client.connect();

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

  console.log(JSON.stringify({ joined, skipped, failed }, null, 2));
  await client.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
