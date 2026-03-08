import {
  createContext,
  useContext,
  createSignal,
  onMount,
  onCleanup,
  type JSX,
  Show,
} from "solid-js";
import { shouldFetchInitialSession } from "./auth-route";
import { fetchAuthSessionState } from "./auth-session.ts";
import { buildClientAuthHref, normalizeClientPostAuthPath } from "./auth-next.ts";
import { buildAuthProviderHref } from "@intel-dashboard/shared/auth-flow.ts";
import { getAuthCopy } from "@intel-dashboard/shared/auth-copy.ts";
import { SITE_NAME, SITE_PLATFORM_LABEL } from "@intel-dashboard/shared/site-config.ts";

// ============================================================================
// Types
// ============================================================================

export interface AuthUser {
  login: string;
  name: string;
  avatar_url: string;
  id: number | string;
  provider?: string | null;
  entitlement?: {
    tier?: string;
    role?: string;
    entitled?: boolean;
    delayMinutes?: number;
    limits?: {
      intelMaxItems?: number | null;
      briefingsMaxItems?: number | null;
      airSeaMaxItems?: number | null;
      telegramTotalMessagesMax?: number | null;
      telegramChannelMessagesMax?: number | null;
    };
  };
}

interface AuthContextValue {
  user: () => AuthUser | null;
  loading: () => boolean;
  logout: () => void;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextValue>();

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ============================================================================
// Provider + Gate
// ============================================================================

export function AuthProvider(props: { children: JSX.Element; publicRoute?: boolean }) {
  const [user, setUser] = createSignal<AuthUser | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [sessionUnavailable, setSessionUnavailable] = createSignal(false);
  const protectedRouteLoginHref = (() => {
    if (typeof window === "undefined") return "/login";
    const nextPath = normalizeClientPostAuthPath(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
    return buildClientAuthHref("/login", nextPath);
  })();
  
  let disposed = false;
  const controller = new AbortController();

  const runSessionCheck = async () => {
    setLoading(true);
    setSessionUnavailable(false);
    try {
      const initialSession = await fetchAuthSessionState(fetch, controller.signal);
      if (disposed) return;
      if (initialSession.status === "authenticated") {
        setUser(initialSession.user);
        return;
      }
      setUser(null);
      if (initialSession.status === "unavailable") {
        setSessionUnavailable(true);
      }
    } catch {
      if (disposed) return;
      setUser(null);
      setSessionUnavailable(true);
    } finally {
      if (!disposed) {
        setLoading(false);
      }
    }
  };

  onMount(async () => {
    if (!shouldFetchInitialSession(props.publicRoute)) {
      setLoading(false);
      return;
    }
    await runSessionCheck();
  });

  onCleanup(() => {
    disposed = true;
    controller.abort();
  });

  const logout = () => {
    window.location.href = "/auth/logout";
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {/* Loading screen overlay */}
      <Show when={loading()}>
        <LoadingScreen />
      </Show>
      
      {/* Login screen overlay */}
      <Show when={!loading() && !user() && !props.publicRoute && !sessionUnavailable()}>
        <LoginScreen />
      </Show>

      <Show when={!loading() && !user() && !props.publicRoute && sessionUnavailable()}>
        <SessionUnavailableScreen
          onRetry={() => void runSessionCheck()}
          loginHref={protectedRouteLoginHref}
        />
      </Show>
      
      {/* Router tree always mounted, hidden behind auth screens when not authenticated */}
      <div
        style={{
          visibility: loading() || (!user() && !props.publicRoute) ? 'hidden' : 'visible',
          position: loading() || (!user() && !props.publicRoute) ? 'fixed' : 'relative',
          'pointer-events': loading() || (!user() && !props.publicRoute) ? 'none' : 'auto',
        }}
      >
        {props.children}
      </div>
    </AuthContext.Provider>
  );
}

// ============================================================================
// Loading Screen
// ============================================================================

function LoadingScreen() {
  return (
    <div class="fixed inset-0 flex items-center justify-center" style="background: radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.08) 0%, rgba(9,9,11,1) 70%);">
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-pulse">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
          </svg>
        </div>
        <div class="text-zinc-500 text-sm font-medium">Loading...</div>
      </div>
    </div>
  );
}

// ============================================================================
// Login Screen — Apple HIG dark glassmorphism
// ============================================================================

function LoginScreen() {
  const copy = getAuthCopy("login");
  const nextPath = (() => {
    if (typeof window === "undefined") return null;
    return normalizeClientPostAuthPath(
      `${window.location.pathname}${window.location.search}${window.location.hash}`,
    );
  })();
  const navigateTo = (event: MouseEvent, href: string) => {
    event.preventDefault();
    window.location.assign(href);
  };

  return (
    <div
      class="fixed inset-0 flex items-center justify-center overflow-hidden"
      style="background: radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.06) 0%, rgba(9,9,11,1) 70%);"
    >
      {/* Ambient glow orbs */}
      <div
        class="absolute w-[500px] h-[500px] rounded-full opacity-[0.03] pointer-events-none"
        style="background: radial-gradient(circle, #10b981 0%, transparent 70%); top: 10%; left: 30%; filter: blur(80px);"
      />
      <div
        class="absolute w-[400px] h-[400px] rounded-full opacity-[0.02] pointer-events-none"
        style="background: radial-gradient(circle, #6366f1 0%, transparent 70%); bottom: 20%; right: 20%; filter: blur(80px);"
      />

      {/* Login card */}
      <div
        class="relative z-10 w-full max-w-sm mx-4 rounded-3xl p-8 text-center"
        style="background: rgba(24, 24, 27, 0.65); backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.06); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset;"
      >
        {/* Shield logo */}
        <div class="flex justify-center mb-6">
          <div class="relative">
            <div class="w-16 h-16 rounded-[1.25rem] gradient-accent flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white drop-shadow-sm" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              </svg>
            </div>
            <div class="absolute -inset-2 rounded-[1.5rem] bg-emerald-500/10 blur-xl -z-10" />
          </div>
        </div>

        {/* Title */}
        <h1 class="text-[22px] font-bold text-white tracking-tight leading-tight mb-1">
          {SITE_NAME}
        </h1>
        <p class="text-[11px] font-semibold text-zinc-600 uppercase tracking-[0.2em] mb-6">
          {SITE_PLATFORM_LABEL}
        </p>

        {/* Divider */}
        <div class="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mb-6" />

        {/* Description */}
        <p class="text-[13px] text-zinc-400 leading-relaxed mb-8">
          {copy.description}
        </p>

        <div class="space-y-3">
          {/* GitHub sign-in button */}
          <a
            href={buildAuthProviderHref("github", "login", nextPath)}
            onClick={(event) => navigateTo(event, buildAuthProviderHref("github", "login", nextPath))}
            class="group relative flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-2xl font-semibold text-[14px] text-white transition-all duration-300 ease-out hover:bg-white/[0.12] hover:border-white/[0.12] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
            style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 12px rgba(0,0,0,0.2);"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="flex-shrink-0" aria-hidden="true">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            {copy.githubLabel}
          </a>

          <div class="flex items-center gap-3">
            <div class="flex-1 h-px bg-white/[0.06]" />
            <span class="text-[11px] text-zinc-600 font-medium">or</span>
            <div class="flex-1 h-px bg-white/[0.06]" />
          </div>

          {/* X (Twitter) sign-in button */}
          <a
            href={buildAuthProviderHref("x", "login", nextPath)}
            onClick={(event) => navigateTo(event, buildAuthProviderHref("x", "login", nextPath))}
            class="group relative flex items-center justify-center gap-3 w-full py-3.5 px-6 rounded-2xl font-semibold text-[14px] text-white transition-all duration-300 ease-out hover:bg-white/[0.12] hover:border-white/[0.12] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.06)_inset]"
            style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 12px rgba(0,0,0,0.2);"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="flex-shrink-0" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            {copy.xLabel}
          </a>
        </div>

        {/* Footer note */}
        <p class="text-[11px] text-zinc-600 mt-6">
          Secured by Cloudflare Workers
        </p>
      </div>

      {/* Version tag */}
      <div class="absolute bottom-6 text-[10px] text-zinc-700 font-mono">
        v0.2
      </div>
    </div>
  );
}

function SessionUnavailableScreen(props: { onRetry: () => void; loginHref: string }) {
  return (
    <div
      class="fixed inset-0 flex items-center justify-center overflow-hidden"
      style="background: radial-gradient(ellipse at 50% 30%, rgba(16,185,129,0.06) 0%, rgba(9,9,11,1) 70%);"
    >
      <div
        class="relative z-10 w-full max-w-sm mx-4 rounded-3xl p-8 text-center"
        style="background: rgba(24, 24, 27, 0.65); backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%); border: 1px solid rgba(255, 255, 255, 0.06); box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03) inset;"
      >
        <div class="flex justify-center mb-6">
          <div class="w-16 h-16 rounded-[1.25rem] bg-amber-500/15 border border-amber-400/20 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-amber-300" aria-hidden="true">
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
        </div>

        <h1 class="text-[22px] font-bold text-white tracking-tight leading-tight mb-2">
          Session Check Unavailable
        </h1>
        <p class="text-[13px] text-zinc-400 leading-relaxed mb-6">
          {SITE_NAME} could not verify your session right now. Retry the check or reopen login once connectivity is stable.
        </p>

        <div class="space-y-3">
          <button
            type="button"
            onClick={props.onRetry}
            class="w-full py-3.5 px-6 rounded-2xl font-semibold text-[14px] text-white transition-all duration-300 ease-out hover:bg-white/[0.12] hover:border-white/[0.12]"
            style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 4px 12px rgba(0,0,0,0.2);"
          >
            Retry Session Check
          </button>
          <a
            href={props.loginHref}
            class="block w-full py-3.5 px-6 rounded-2xl font-semibold text-[14px] text-zinc-300 transition-all duration-300 ease-out hover:bg-white/[0.08] hover:text-white"
            style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06);"
          >
            Open Login
          </a>
        </div>
      </div>
    </div>
  );
}
