import type { useAuth } from "~/lib/auth";

export function resolveFeedAccessNoticeAuth(
  readAuth: () => ReturnType<typeof useAuth>,
): ReturnType<typeof useAuth> {
  try {
    return readAuth();
  } catch {
    return {
      user: () => null,
      loading: () => false,
      logout: () => {},
    };
  }
}
