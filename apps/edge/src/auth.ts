import { betterAuth } from "better-auth";
import { withCloudflare } from "better-auth-cloudflare";
import type { DrizzleConfig } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/d1";
import type { IncomingRequestCfProperties, KVNamespace } from "@cloudflare/workers-types";
import { authSchema } from "./auth-schema";
import {
  isSyntheticXIdentity,
  selectStableTwitterFallbackIdentity,
  type StableTwitterFallbackRow,
} from "./auth-fallback-utils";
import { normalizeString } from "./value-normalization";
import { SITE_ORIGIN } from "@intel-dashboard/shared/site-config.ts";

const ORIGIN = SITE_ORIGIN;
const AUTH_BASE_PATH = "/auth";
const X_USERINFO_ENDPOINTS = [
  "https://api.x.com/2/users/me?user.fields=id,name,username,profile_image_url",
  "https://api.x.com/2/users/me",
  "https://api.twitter.com/2/users/me?user.fields=id,name,username,profile_image_url",
  "https://api.twitter.com/2/users/me",
] as const;
const X_USERINFO_BY_ID_ENDPOINTS = [
  "https://api.x.com/2/users/%s?user.fields=id,name,username,profile_image_url",
  "https://api.x.com/2/users/%s",
  "https://api.twitter.com/2/users/%s?user.fields=id,name,username,profile_image_url",
  "https://api.twitter.com/2/users/%s",
] as const;

type AuthEnv = Cloudflare.Env & {
  AUTH_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;
};

type XUserPayload = {
  data?: {
    id?: unknown;
    name?: unknown;
    username?: unknown;
    profile_image_url?: unknown;
    confirmed_email?: unknown;
  };
};

type XResolvedProfile = {
  id: string;
  username: string;
  name: string;
  profileImageUrl: string | null;
  confirmedEmail: string | null;
};

function normalizeXAvatar(value: unknown): string | null {
  const raw = normalizeString(value);
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  const trustedHost = host === "pbs.twimg.com" || host === "abs.twimg.com" || host.endsWith(".twimg.com");
  if (!trustedHost) return null;
  return parsed.toString().replace("_normal", "");
}

function normalizeExistingTwitterFallbackRow(value: Record<string, unknown>): StableTwitterFallbackRow | null {
  const accountId = normalizeString(value.accountId);
  const userId = normalizeString(value.userId);
  const login = normalizeString(value.login);
  if (!accountId || !userId || !login) {
    return null;
  }
  const name = normalizeString(value.name) ?? login;
  return {
    accountId,
    userId,
    login,
    name,
    image: normalizeString(value.image),
    updatedAtMs: Number(value.updatedAt ?? 0) || 0,
  };
}

async function loadStableTwitterFallbackProfile(
  db: D1Database,
  hintedUserId: string | null,
): Promise<XResolvedProfile | null> {
  let rows: Record<string, unknown>[] = [];
  try {
    const result = await db
      .prepare(
        `SELECT a."accountId" AS accountId, a."updatedAt" AS updatedAt, u."id" AS userId, u."login" AS login, u."name" AS name, u."image" AS image
         FROM "account" a
         INNER JOIN "user" u ON u."id" = a."userId"
         WHERE lower(a."providerId") IN ('twitter', 'x')
         ORDER BY a."updatedAt" DESC
         LIMIT 20`,
      )
      .all<Record<string, unknown>>();
    rows = Array.isArray(result.results) ? result.results : [];
  } catch {
    return null;
  }

  const normalized = rows
    .map((row) => normalizeExistingTwitterFallbackRow(row))
    .filter((row): row is StableTwitterFallbackRow => row !== null);
  const selected = selectStableTwitterFallbackIdentity(normalized, hintedUserId);
  if (!selected) {
    return null;
  }
  return {
    id: selected.accountId,
    username: selected.login,
    name: selected.name,
    profileImageUrl: normalizeXAvatar(selected.image),
    confirmedEmail: null,
  };
}

function isRetriableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function parseRetryAfterMs(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }
  const when = Date.parse(raw);
  if (Number.isFinite(when)) {
    return Math.max(0, when - Date.now());
  }
  return null;
}

async function delayMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function decodeJwtSub(token: string): string | null {
  const claims = decodeJwtClaims(token);
  return claims ? normalizeString(claims.sub) : null;
}

function decodeJwtClaims(token: string | null | undefined): Record<string, unknown> | null {
  const compact = token?.trim() ?? "";
  if (!compact || compact.split(".").length < 2) {
    return null;
  }
  try {
    const payloadPart = compact.split(".")[1] ?? "";
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
    const decoded = atob(normalized + pad);
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return parsed;
  } catch {
    return null;
  }
}

function profileFromTokenClaims(claims: Record<string, unknown> | null): XResolvedProfile | null {
  if (!claims) return null;

  const username =
    normalizeString(claims.preferred_username) ??
    normalizeString(claims.username) ??
    normalizeString(claims.screen_name);
  const id =
    normalizeString(claims.sub) ??
    normalizeString(claims.user_id) ??
    normalizeString(claims.id);
  if (!username || !id) return null;

  const name = normalizeString(claims.name) ?? username;
  return {
    id,
    username,
    name,
    profileImageUrl:
      normalizeXAvatar(claims.picture) ??
      normalizeXAvatar(claims.profile_image_url),
    confirmedEmail:
      normalizeString(claims.email) ??
      normalizeString(claims.confirmed_email),
  };
}

function resolveXProfile(parsed: XUserPayload | null): XResolvedProfile | null {
  const id = normalizeString(parsed?.data?.id);
  const username = normalizeString(parsed?.data?.username);
  if (!id || !username) return null;
  const name = normalizeString(parsed?.data?.name) ?? username;
  return {
    id,
    username,
    name,
    profileImageUrl: normalizeXAvatar(parsed?.data?.profile_image_url),
    confirmedEmail: normalizeString(parsed?.data?.confirmed_email),
  };
}

async function fetchXProfileFromEndpoints(accessToken: string, endpoints: readonly string[]): Promise<XResolvedProfile | null> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };

  for (const endpoint of endpoints) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
          headers,
          signal: AbortSignal.timeout(8_000),
        });

        if (response.ok) {
          const parsed = await response.json().catch(() => null) as XUserPayload | null;
          const resolved = resolveXProfile(parsed);
          if (resolved) {
            return resolved;
          }
          break;
        }

        if (isRetriableStatus(response.status) && attempt < 3) {
          const retryAfterMs = parseRetryAfterMs(response);
          const fallbackBackoffMs = Math.min(2_500, 350 * attempt * attempt);
          await delayMs(retryAfterMs ?? fallbackBackoffMs);
          continue;
        }
        break;
      } catch {
        if (attempt < 3) {
          const fallbackBackoffMs = Math.min(2_500, 350 * attempt * attempt);
          await delayMs(fallbackBackoffMs);
          continue;
        }
      }
    }
  }

  return null;
}

function createTwitterUserInfoResolver(db: D1Database) {
  return async function getTwitterUserInfo(token: { accessToken?: string | null }): Promise<{
    user: {
      id: string;
      name: string;
      email: string | null;
      image?: string;
      emailVerified: boolean;
      login: string;
    };
    data: XUserPayload;
  } | null> {
    const tokenRecord = token as Record<string, unknown>;
    const rawRecord =
      typeof tokenRecord.raw === "object" && tokenRecord.raw !== null
        ? tokenRecord.raw as Record<string, unknown>
        : null;
    const accessToken =
      normalizeString(token.accessToken) ??
      normalizeString(tokenRecord.access_token) ??
      normalizeString(rawRecord?.access_token) ??
      normalizeString(rawRecord?.accessToken) ??
      normalizeString(tokenRecord.token);
    const hintedUserId =
      normalizeString(tokenRecord.userId) ??
      normalizeString(tokenRecord.user_id) ??
      normalizeString(tokenRecord.uid) ??
      normalizeString(tokenRecord.sub) ??
      normalizeString(rawRecord?.user_id) ??
      normalizeString(rawRecord?.userId) ??
      normalizeString(rawRecord?.uid) ??
      normalizeString(rawRecord?.sub) ??
      (accessToken ? decodeJwtSub(accessToken) : null) ??
      (() => {
        const refreshToken = normalizeString(tokenRecord.refreshToken);
        return refreshToken ? decodeJwtSub(refreshToken) : null;
      })() ??
      (() => {
        const idToken = normalizeString(tokenRecord.idToken);
        return idToken ? decodeJwtSub(idToken) : null;
      })();
    const idToken =
      normalizeString(tokenRecord.idToken) ??
      normalizeString(tokenRecord.id_token) ??
      normalizeString(rawRecord?.id_token);
    const accessClaims = decodeJwtClaims(accessToken ?? "");
    const refreshClaims = decodeJwtClaims(normalizeString(tokenRecord.refreshToken));
    const idClaims = decodeJwtClaims(idToken);

    let profile: XResolvedProfile | null = null;
    if (accessToken) {
      profile = await fetchXProfileFromEndpoints(accessToken, X_USERINFO_ENDPOINTS);
      if (!profile && hintedUserId) {
        const encoded = encodeURIComponent(hintedUserId);
        const byIdEndpoints = X_USERINFO_BY_ID_ENDPOINTS.map((template) => template.replace("%s", encoded));
        profile = await fetchXProfileFromEndpoints(accessToken, byIdEndpoints);
      }
    }

    if (!profile) {
      profile =
        profileFromTokenClaims(idClaims) ??
        profileFromTokenClaims(accessClaims) ??
        profileFromTokenClaims(refreshClaims);
    }

    if (!profile) {
      profile = await loadStableTwitterFallbackProfile(db, hintedUserId);
    }

    if (!profile) {
      const fallbackSeed =
        hintedUserId ??
        idToken ??
        normalizeString(tokenRecord.refreshToken) ??
        accessToken;
      if (!fallbackSeed) {
        console.warn("[auth][twitter] Failed to resolve profile and no deterministic fallback token was available.");
        return null;
      }
      console.warn("[auth][twitter] Falling back to synthetic profile", {
        hasAccessToken: Boolean(accessToken),
        hasHintedUserId: Boolean(hintedUserId),
        hasIdToken: Boolean(idToken),
        hasRefreshToken: Boolean(normalizeString(tokenRecord.refreshToken)),
      });
      const hash = await sha256Hex(fallbackSeed);
      const fallbackId = hintedUserId ?? `xid_${hash.slice(0, 20)}`;
      const syntheticLogin = hintedUserId
        ? `x_${hintedUserId.slice(-12).toLowerCase()}`
        : `x_${hash.slice(0, 12)}`;
      return {
        user: {
          id: fallbackId,
          name: "X User",
          email: syntheticLogin,
          image: undefined,
          emailVerified: false,
          login: syntheticLogin,
        },
        data: {
          data: {
            id: fallbackId,
            username: syntheticLogin,
            name: "X User",
            profile_image_url: undefined,
            confirmed_email: undefined,
          },
        },
      };
    }

    return {
      user: {
        id: profile.id,
        name: profile.name,
        email: profile.confirmedEmail ?? profile.username,
        image: profile.profileImageUrl ?? undefined,
        emailVerified: profile.confirmedEmail !== null,
        login: profile.username,
      },
      data: {
        data: {
          id: profile.id,
          name: profile.name,
          username: profile.username,
          profile_image_url: profile.profileImageUrl ?? undefined,
          confirmed_email: profile.confirmedEmail ?? undefined,
        },
      },
    };
  };
}

export function createEdgeAuth(env: AuthEnv, cf: IncomingRequestCfProperties | null | undefined) {
  const db = drizzle(env.INTEL_DB, { schema: authSchema });
  const getTwitterUserInfo = createTwitterUserInfoResolver(env.INTEL_DB);
  const d1Config: DrizzleConfig<typeof drizzle> = {
    db,
    options: {
      usePlural: false,
    },
  };

  return betterAuth({
    secret: env.AUTH_SECRET,
    baseURL: `${ORIGIN}${AUTH_BASE_PATH}`,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: [ORIGIN],
    user: {
      additionalFields: {
        login: {
          type: "string",
          required: false,
        },
      },
    },
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf ?? {},
        d1: d1Config,
        kv: env.TELEGRAM_STATE as unknown as KVNamespace,
      },
      {
        socialProviders: {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
            redirectURI: `${ORIGIN}/auth/callback`,
            disableDefaultScope: true,
            scope: ["read:user", "user:email"],
            mapProfileToUser: async (profile: { login?: unknown }) => {
              const login = normalizeString(profile.login);
              if (!login) return {};
              return {
                login,
                name: login,
              };
            },
          },
          twitter: {
            clientId: env.X_CLIENT_ID,
            clientSecret: env.X_CLIENT_SECRET,
            redirectURI: `${ORIGIN}/auth/x/callback`,
            disableDefaultScope: true,
            scope: ["users.read", "tweet.read", "offline.access"],
            getUserInfo: getTwitterUserInfo,
          },
        },
      },
    ),
  });
}
