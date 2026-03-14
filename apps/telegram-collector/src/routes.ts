export function isCollectorPushBatchPath(pathname: string): boolean {
  return pathname === "/push-batch" || pathname === "/control/push-batch";
}
