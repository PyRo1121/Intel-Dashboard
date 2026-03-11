import input from "input";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";

function trim(value) {
  return (value || "").trim();
}

function readRequiredEnv(name) {
  const value = trim(process.env[name]);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

async function main() {
  const apiIdRaw = readRequiredEnv("TELEGRAM_API_ID");
  const apiHash = readRequiredEnv("TELEGRAM_API_HASH");
  const apiId = Number.parseInt(apiIdRaw, 10);
  if (!Number.isFinite(apiId) || apiId <= 0) {
    throw new Error("TELEGRAM_API_ID must be a positive integer");
  }

  const phoneHint = trim(process.env.TELEGRAM_PHONE_NUMBER);
  const session = new StringSession("");
  const client = new TelegramClient(session, apiId, apiHash, {
    connectionRetries: 5,
  });

  console.log("Starting Telegram user authorization...");

  await client.start({
    phoneNumber: async () => {
      if (phoneHint) return phoneHint;
      return input.text("Telegram phone number");
    },
    phoneCode: async (isCodeViaApp) =>
      input.text(isCodeViaApp ? "Telegram login code (from app)" : "Telegram login code"),
    password: async (hint) =>
      input.password(hint ? `Telegram 2FA password (${hint})` : "Telegram 2FA password"),
    onError: async (err) => {
      console.error(`Telegram auth error: ${err.message}`);
      return false;
    },
  });

  const me = await client.getMe();
  const sessionString = session.save();

  console.log("");
  console.log("Telegram session generated.");
  console.log(`User: ${me?.username || me?.id || "unknown"}`);
  console.log("");
  console.log("Set this secret on the collector:");
  console.log("TELEGRAM_SESSION_STRING=");
  console.log(sessionString);

  await client.disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
