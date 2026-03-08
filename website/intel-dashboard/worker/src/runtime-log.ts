export function shouldDebugRuntimeLogs(env: { DEBUG_RUNTIME_LOGS?: string } | null | undefined): boolean {
  const raw = env?.DEBUG_RUNTIME_LOGS;
  return typeof raw === "string" && /^(1|true|yes|on)$/i.test(raw.trim());
}

export function debugRuntimeLog(
  env: { DEBUG_RUNTIME_LOGS?: string } | null | undefined,
  ...args: unknown[]
): void {
  if (!shouldDebugRuntimeLogs(env)) return;
  console.log(...args);
}
