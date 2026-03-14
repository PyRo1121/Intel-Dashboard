export const LATEST_TELEGRAM_STATE_DO_MAX_LENGTH = 450_000;

export function shouldPersistLatestTelegramStateLocally(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.length > 0 && raw.length <= LATEST_TELEGRAM_STATE_DO_MAX_LENGTH;
}

