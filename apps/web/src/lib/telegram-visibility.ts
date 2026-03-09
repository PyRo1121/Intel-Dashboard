import { parseTimestampMs } from "./utils.ts";

export type TelegramVisibilityMessageLike = {
  datetime: string;
  media: Array<unknown>;
  has_photo?: boolean;
  has_video?: boolean;
};

export type TelegramAgeWindow = "all" | "24h";

export function isTelegramMessageVisible(args: {
  message: TelegramVisibilityMessageLike;
  ageWindow: TelegramAgeWindow;
  mediaOnly: boolean;
  nowMs: number;
}): boolean {
  if (args.ageWindow === "24h") {
    const ts = parseTimestampMs(args.message.datetime);
    if (!ts || args.nowMs - ts > 24 * 60 * 60 * 1000) return false;
  }
  if (args.mediaOnly) {
    return args.message.media.length > 0 || args.message.has_photo === true || args.message.has_video === true;
  }
  return true;
}
