export type StableTwitterFallbackRow = {
  accountId: string;
  userId: string;
  login: string;
  name: string;
  image: string | null;
  updatedAtMs: number;
};

export function isSyntheticXIdentity(login: string, name: string): boolean {
  const normalizedLogin = login.trim().toLowerCase();
  const normalizedName = name.trim().toLowerCase();
  if (!normalizedLogin) return true;
  if (normalizedLogin.startsWith("x_") || normalizedLogin.startsWith("xacct_") || normalizedLogin.startsWith("xid_")) {
    return true;
  }
  if (normalizedName === "x user" || normalizedName === "x account") {
    return true;
  }
  return false;
}

export function selectStableTwitterFallbackIdentity(
  rows: StableTwitterFallbackRow[],
  hintedUserId: string | null,
): StableTwitterFallbackRow | null {
  if (rows.length === 0) {
    return null;
  }

  const hinted = (hintedUserId ?? "").trim().toLowerCase();
  if (hinted.length > 0) {
    const hintedMatch = rows.find((row) => {
      const accountId = row.accountId.trim().toLowerCase();
      const userId = row.userId.trim().toLowerCase();
      return (accountId === hinted || userId === hinted) && !isSyntheticXIdentity(row.login, row.name);
    });
    if (hintedMatch) {
      return hintedMatch;
    }
  }

  const nonSyntheticCandidates = rows.filter((row) => !isSyntheticXIdentity(row.login, row.name));
  if (nonSyntheticCandidates.length !== 1) {
    return null;
  }

  return nonSyntheticCandidates[0];
}

