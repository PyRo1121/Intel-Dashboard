import { A, useLocation } from "@solidjs/router";
import {
  For,
  Show,
  createSignal,
  createEffect,
  onMount,
  onCleanup,
  type JSX,
} from "solid-js";
import { resolveAuthUserRole } from "~/lib/auth-user";
import {
  LayoutDashboard,
  Radio,
  Globe,
  Anchor,
  FileText,
  MessageSquare,
  Shield,
  PanelLeftClose,
  PanelLeft,
  Menu,
  X,
  Activity,
  LogOut,
  CreditCard,
  Users,
} from "lucide-solid";
import { useAuth } from "~/lib/auth";
import { DASHBOARD_HOME_PATH } from "@intel-dashboard/shared/auth-next-routes.ts";
import { formatDelayMinutesShortLabel, UPGRADE_INSTANT_FEED_LABEL } from "@intel-dashboard/shared/access-offers.ts";
import { resolveEntitlementRole, resolveEntitlementView } from "@intel-dashboard/shared/entitlement.ts";
import { SITE_NAME, SITE_OPERATIONS_LABEL } from "@intel-dashboard/shared/site-config.ts";

// ============================================================================
// Types
// ============================================================================

interface NavItem {
  href: string;
  label: string;
  icon: (props: { class?: string; size?: number }) => JSX.Element;
}

// ============================================================================
// Nav config
// ============================================================================

const mainNavItems: NavItem[] = [
  { href: DASHBOARD_HOME_PATH, label: "Overview", icon: LayoutDashboard },
  { href: "/osint", label: "OSINT Feed", icon: Radio },
  { href: "/map", label: "Threat Map", icon: Globe },
  { href: "/air-sea", label: "Air/Sea Ops", icon: Anchor },
  { href: "/briefings", label: "Briefings", icon: FileText },
  { href: "/telegram", label: "Telegram", icon: MessageSquare },
  { href: "/billing", label: "Billing", icon: CreditCard },
];

const ownerNavItem: NavItem = { href: "/crm", label: "CRM", icon: Users };

// ============================================================================
// Component
// ============================================================================

export default function Sidebar() {
  const location = useLocation();
  const auth = useAuth();

  const readStoredCollapsed = (): boolean => {
    if (typeof window === "undefined") return false;
    const storage = window.localStorage;
    if (!storage || typeof storage.getItem !== "function") return false;
    return storage.getItem("sidebar-collapsed") === "true";
  };

  const [collapsed, setCollapsed] = createSignal(readStoredCollapsed());

  const [mobileOpen, setMobileOpen] = createSignal(false);

  createEffect(() => {
    if (typeof window !== "undefined") {
      const storage = window.localStorage;
      if (!storage || typeof storage.setItem !== "function") return;
      storage.setItem("sidebar-collapsed", String(collapsed()));
      window.dispatchEvent(new CustomEvent("sidebar-toggle"));
    }
  });

  // Ctrl+B shortcut
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    onCleanup(() => document.removeEventListener("keydown", handler));
  });

  // Close mobile nav on route change
  createEffect(() => {
    location.pathname;
    setMobileOpen(false);
  });

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    return location.pathname.startsWith(href);
  };

  const role = () => resolveAuthUserRole(auth.user());
  const navItems = () => (role() === "owner" ? [...mainNavItems, ownerNavItem] : mainNavItems);

  const renderNavItem = (item: NavItem, index: number, opts?: { collapsed?: boolean }) => {
    const compact = opts?.collapsed === true;
    const active = () => isActive(item.href);

    return (
      <A
        href={item.href}
        aria-label={item.label}
        class={`group relative flex items-center gap-3 rounded-2xl transition-all duration-300 ease-out ${
          compact
            ? "justify-center px-3 py-3"
            : "px-3.5 py-2.5"
        } ${
          active()
            ? "bg-white/[0.08] text-white shadow-sm"
            : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
        }`}
        style={`animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: ${index * 40}ms`}
      >
        {/* Active indicator bar */}
        <Show when={active()}>
          <div class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
        </Show>

        {/* Icon container */}
        <div
          class={`relative flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-300 ${
            active()
              ? "bg-emerald-500/20 text-emerald-400 shadow-[0_0_12px_rgba(34,197,94,0.15)]"
              : "text-zinc-500 group-hover:text-zinc-300 group-hover:bg-white/[0.04]"
          }`}
        >
          <item.icon size={18} />
        </div>

        <Show when={!compact}>
          <span
            class={`text-[13px] font-medium flex-1 truncate transition-colors duration-200 ${
              active() ? "text-white" : ""
            }`}
          >
            {item.label}
          </span>
        </Show>

        {/* Collapsed tooltip */}
        <Show when={compact}>
          <div aria-hidden="true" class="absolute left-full ml-3 px-3 py-1.5 bg-zinc-900/95 backdrop-blur-xl border border-white/10 text-zinc-200 text-xs font-medium rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-all duration-200 whitespace-nowrap z-50 shadow-2xl shadow-black/50">
            {item.label}
          </div>
        </Show>
      </A>
    );
  };

  const SidebarContent = (opts?: { collapsed?: boolean; mobile?: boolean }) => {
    const compact = () => opts?.collapsed === true;
    const isMobile = () => opts?.mobile === true;
    return (
    <div class="flex flex-col h-full">
      {/* Brand */}
      <div
        class={`flex items-center ${
          compact() ? "justify-center px-3 py-5" : "justify-between px-5 py-5"
        }`}
      >
        <A href={DASHBOARD_HOME_PATH} aria-label="Intel Dashboard home" class="flex items-center gap-3 group">
          <div class="relative">
            <div class="w-10 h-10 rounded-2xl gradient-accent flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-all duration-300 group-hover:scale-105">
              <Shield size={18} class="text-white drop-shadow-sm" />
            </div>
            <div class="absolute -inset-1 rounded-2xl bg-emerald-500/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
          </div>
          <Show when={!compact()}>
            <div class="flex flex-col">
              <span class="text-[15px] font-bold text-white tracking-tight leading-none">
                {SITE_NAME}
              </span>
              <span class="text-[10px] font-medium text-zinc-600 tracking-widest uppercase mt-0.5">
                {SITE_OPERATIONS_LABEL}
              </span>
            </div>
          </Show>
        </A>

        <Show when={!compact() && !isMobile()}>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
            aria-controls="desktop-navigation"
            aria-expanded={!collapsed()}
            class="hidden md:flex items-center justify-center w-8 h-8 rounded-xl text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all duration-200"
            title="Collapse sidebar (Ctrl+B)"
          >
            <PanelLeftClose size={16} />
          </button>
        </Show>
      </div>

      {/* Separator */}
      <div class={`h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent ${compact() ? "mx-2" : "mx-4"}`} />

      {/* Expand button when collapsed */}
      <Show when={compact() && !isMobile()}>
        <div class="flex justify-center px-3 pt-4 pb-1">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-label="Expand sidebar"
            aria-controls="desktop-navigation"
            aria-expanded={!collapsed()}
            class="flex items-center justify-center w-8 h-8 rounded-xl text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all duration-200"
            title="Expand sidebar (Ctrl+B)"
          >
            <PanelLeft size={16} />
          </button>
        </div>
      </Show>

      {/* Navigation */}
      <nav class="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <Show when={!compact()}>
          <p class="text-[10px] font-semibold text-zinc-700 uppercase tracking-[0.15em] px-3.5 mb-2">
            Navigation
          </p>
        </Show>
        <For each={navItems()}>
          {(item, index) => renderNavItem(item, index(), { collapsed: compact() })}
        </For>
      </nav>

      {/* User + Status footer */}
      <div class={`border-t border-white/[0.04] ${compact() ? "px-3 py-3" : "px-4 py-3"} space-y-3`}>
        {/* User profile */}
        {(() => {
          try {
            const u = auth.user();
            return (
              <Show when={u}>
                {(currentUser) => (
                  <div class={`flex items-center gap-2.5 ${compact() ? "justify-center" : ""}`}>
                    {(() => {
                      const [avatarFailed, setAvatarFailed] = createSignal(false);
                      const login = () => (currentUser().login || "").trim();
                      const name = () => (currentUser().name || "").trim();
                      const avatarUrl = () => (currentUser().avatar_url || "").trim();
                      const displayName = () => {
                        return name() || login() || "User";
                      };
                      const displayLogin = () => {
                        const value = login();
                        if (!value) return "";
                        return value.includes("@") ? value : `@${value}`;
                      };
                      const avatarLetter = () => displayName().slice(0, 1).toUpperCase();
                      const entitlement = () => currentUser().entitlement;
                      const entitlementView = () => resolveEntitlementView(entitlement());
                      const role = () => entitlementView().role;
                      const entitled = () => entitlementView().entitled;
                      const delayMinutes = () => entitlementView().delayMinutes;
                      const planLabel = () => entitlementView().planLabel;
                      const planTone = () => entitlementView().planTone;

                      return (
                        <>
                          <Show
                            when={avatarUrl().length > 0 && !avatarFailed()}
                            fallback={
                              <div class="w-7 h-7 rounded-xl flex-shrink-0 ring-1 ring-white/[0.06] bg-zinc-800 text-zinc-300 flex items-center justify-center text-[11px] font-semibold uppercase">
                                {avatarLetter()}
                              </div>
                            }
                          >
                            <img
                              src={avatarUrl()}
                              alt={displayName()}
                              class="w-7 h-7 rounded-xl flex-shrink-0 ring-1 ring-white/[0.06]"
                              referrerpolicy="no-referrer"
                              onError={() => setAvatarFailed(true)}
                            />
                          </Show>
                          <Show when={!compact()}>
                            <div class="flex-1 min-w-0">
                              <p class="text-[12px] font-medium text-zinc-300 truncate leading-tight">
                                {displayName()}
                              </p>
                              <p class="text-[10px] text-zinc-600 truncate leading-tight">
                                {displayLogin()}
                              </p>
                              <p class={`text-[10px] truncate leading-tight ${planTone()}`}>
                                <span>{planLabel()}</span>
                                <Show when={!entitled()}>
                                  <span>{` • ${formatDelayMinutesShortLabel(delayMinutes())} delay`}</span>
                                </Show>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => auth.logout()}
                              aria-label="Sign out"
                              class="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-xl text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-all duration-200"
                              title="Sign out"
                            >
                              <LogOut size={14} />
                            </button>
                          </Show>
                        </>
                      );
                    })()}
                  </div>
                )}
              </Show>
            );
          } catch {
            return null;
          }
        })()}

        {/* Status indicator */}
        <div class={`flex items-center gap-2.5 ${compact() ? "justify-center" : ""}`}>
          <div class="relative flex-shrink-0">
            <div class="w-2 h-2 rounded-full bg-emerald-400 glow-emerald-dot" />
            <div class="absolute inset-0 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-20" />
          </div>
          <Show when={!compact()}>
            <div class="flex items-center justify-between flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <Activity size={12} class="text-emerald-500/60" />
                <span class="text-[11px] text-zinc-500 font-medium glow-emerald-text">Live</span>
              </div>
              <span class="text-[10px] text-zinc-700 font-mono-data">v0.2</span>
            </div>
          </Show>
        </div>
        {(() => {
          try {
            const current = auth.user();
            const role = resolveEntitlementRole(current?.entitlement?.role, current?.entitlement?.tier);
            const entitled = current?.entitlement?.entitled === true || role === "owner" || role === "subscriber";
            if (compact() || entitled) return null;
            return (
                              <A
                                href="/billing"
                                class="block w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-[11px] font-medium text-amber-200 hover:bg-amber-500/15 transition-colors"
                              >
                                {UPGRADE_INSTANT_FEED_LABEL}
                              </A>
            );
          } catch {
            return null;
          }
        })()}
      </div>
    </div>
    );
  };

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        id="desktop-navigation"
        class={`hidden md:flex fixed left-0 top-0 h-screen flex-col z-40 transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          collapsed() ? "w-[4.5rem]" : "w-[17rem]"
        }`}
        style="background: rgba(9, 9, 11, 0.85); backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%); border-right: 1px solid rgba(255, 255, 255, 0.04);"
      >
        {SidebarContent({ collapsed: collapsed(), mobile: false })}
      </aside>

      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-expanded={mobileOpen()}
        aria-controls="mobile-navigation"
        class="md:hidden fixed top-4 left-4 z-50 flex items-center justify-center w-11 h-11 rounded-2xl surface-card border border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-all duration-200 shadow-2xl shadow-black/40"
        aria-label="Open navigation"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      <Show when={mobileOpen()}>
        <button
          type="button"
          class="md:hidden fixed inset-0 bg-black/70 backdrop-blur-md z-50 animate-fade-in"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      </Show>

      {/* Mobile sidebar */}
      <aside
        id="mobile-navigation"
        class={`md:hidden fixed left-0 top-0 h-screen w-[17rem] flex flex-col z-50 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          mobileOpen() ? "translate-x-0" : "-translate-x-full"
        }`}
        style="background: rgba(9, 9, 11, 0.95); backdrop-filter: blur(40px) saturate(180%); -webkit-backdrop-filter: blur(40px) saturate(180%); border-right: 1px solid rgba(255, 255, 255, 0.06);"
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-controls="mobile-navigation"
          class="absolute top-5 right-4 flex items-center justify-center w-8 h-8 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all duration-200"
          aria-label="Close navigation"
        >
          <X size={16} />
        </button>
        {SidebarContent({ collapsed: false, mobile: true })}
      </aside>
    </>
  );
}
