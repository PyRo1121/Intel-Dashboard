export const HIGH_SIGNAL_TELEGRAM_SCORE_THRESHOLD = 70;
export const CONFIRMED_FIRST_REPORT_MIN_SOURCE_COUNT = 6;

export function hasConfirmedFirstReporter(sourceCount: number | null | undefined): boolean {
  return typeof sourceCount === "number" && Number.isFinite(sourceCount) && sourceCount >= CONFIRMED_FIRST_REPORT_MIN_SOURCE_COUNT;
}

export function isHighSignalTelegramGrade(grade: string | null | undefined): boolean {
  return grade === "A" || grade === "B";
}
