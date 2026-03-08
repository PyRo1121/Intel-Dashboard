export function shouldFetchInitialSession(publicRoute?: boolean): boolean {
  return publicRoute !== true;
}
