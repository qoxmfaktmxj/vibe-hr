"use client";

import { ChevronRight, Home, MoreHorizontal, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { requestWorkspaceNavigation } from "@/lib/grid/use-unsaved-navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { SessionCountdown } from "@/components/layout/session-countdown";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { WorkspaceNavigator } from "@/components/layout/workspace-navigator";
import type { MenuNode } from "@/types/menu";

const AccountMenuNoSsr = dynamic(
  () => import("@/components/layout/account-menu").then((mod) => mod.AccountMenu),
  {
    ssr: false,
    loading: () => <span className="inline-block h-11 w-14" aria-hidden="true" />,
  },
);

const ImpersonationPopoverNoSsr = dynamic(
  () => import("@/components/layout/impersonation-popover").then((mod) => mod.ImpersonationPopover),
  {
    ssr: false,
    loading: () => <span className="inline-block h-9 w-9" aria-hidden="true" />,
  },
);

const ChatAssistantFabNoSsr = dynamic(
  () => import("@/components/layout/chat-assistant-fab").then((mod) => mod.ChatAssistantFab),
  { ssr: false },
);

function useIdleMount() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setReady(true);
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(run, { timeout: 1500 });
      return () => {
        cancelled = true;
        if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(run, 1);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  return ready;
}

type AppShellProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

type OpenTab = {
  path: string;
  label: string;
};

type TabContextMenuState = {
  x: number;
  y: number;
  targetPath: string;
} | null;

const TAB_STORAGE_KEY = "vibe_hr_open_tabs";
const TAB_STORAGE_CHANGE_EVENT = "vibehr-open-tabs-change";
const MAX_OPEN_TABS = 10;

function subscribeToStoredTabs(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(TAB_STORAGE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(TAB_STORAGE_CHANGE_EVENT, onChange);
  };
}

function getStoredTabsSnapshot(): string {
  try {
    return window.localStorage.getItem(TAB_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerTabsSnapshot(): null {
  return null;
}

function readStoredTabs(raw: string | null): OpenTab[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((tab): tab is OpenTab => Boolean(tab) && typeof tab.path === "string" && typeof tab.label === "string" && tab.path !== "/dashboard")
      : [];
  } catch {
    return [];
  }
}

function buildMenuLabelIndex(menus: MenuNode[]): Map<string, string> {
  const labelByPath = new Map<string, string>();
  const stack: MenuNode[] = [...menus];
  const visited = new Set<MenuNode>();

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || visited.has(node)) continue;
    visited.add(node);

    if (node.path) {
      labelByPath.set(node.path, node.name);
    }

    if (node.children.length > 0) {
      for (const child of node.children) {
        stack.push(child);
      }
    }
  }

  return labelByPath;
}

function getFallbackLabel(path: string): string {
  if (path === "/dashboard") return "대시보드";
  return path;
}

export function AppShell({ title, description, children }: AppShellProps) {
  const router = useRouter();
  const navigate = useCallback((path: string) => requestWorkspaceNavigation(() => router.push(path)), [router]);
  const pathname = usePathname();
  const { user } = useAuth();
  const { menus } = useMenu();
  const tabsSnapshot = useSyncExternalStore<string | null>(subscribeToStoredTabs, getStoredTabsSnapshot, getServerTabsSnapshot);
  const tabsHydrated = tabsSnapshot !== null;
  const tabStripRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const contextMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0 });

  const [contextMenu, setContextMenu] = useState<TabContextMenuState>(null);

  const isAdmin = useMemo(() => Boolean(user?.roles?.includes("admin")), [user?.roles]);
  const idleReady = useIdleMount();

  const menuLabelByPath = useMemo(() => buildMenuLabelIndex(menus), [menus]);

  const resolveLabel = useCallback(
    (path: string) => menuLabelByPath.get(path) ?? getFallbackLabel(path),
    [menuLabelByPath],
  );

  const pageTitle = title === "VIBE-HR" ? resolveLabel(pathname) : title;
  const headingInContent = ["/hr/employee", "/hr/basic", "/hri/tasks/approvals"].includes(pathname);
  const sectionLabel = useMemo(
    () => menus.find((menu) => buildMenuLabelIndex([menu]).has(pathname))?.name,
    [menus, pathname],
  );

  const userId = user?.id ?? null;
  const [tabState, setTabState] = useState(() => ({
    snapshot: tabsSnapshot,
    userId,
    pathname,
    menuIndex: menuLabelByPath,
    initialized: false,
    tabs: readStoredTabs(tabsSnapshot),
    suppressNextAutoAdd: false,
  }));
  if (tabState.snapshot !== tabsSnapshot || tabState.userId !== userId || tabState.pathname !== pathname || tabState.menuIndex !== menuLabelByPath || (tabsHydrated && !tabState.initialized)) {
    const userChanged = tabState.userId !== userId;
    const restored = userChanged ? [] : tabState.snapshot !== tabsSnapshot ? readStoredTabs(tabsSnapshot) : tabState.tabs;
    const nextTabs = restored
      .filter((tab) => tab.path !== "/dashboard" && (menus.length === 0 || menuLabelByPath.has(tab.path)))
      .map((tab) => ({ ...tab, label: resolveLabel(tab.path) }));
    const isHomePath = pathname === "/dashboard" || pathname === "/login" || pathname === "/unauthorized";
    const shouldAutoAdd = tabsHydrated && !userChanged && !tabState.suppressNextAutoAdd && (
      !tabState.initialized || tabState.pathname !== pathname || tabState.menuIndex !== menuLabelByPath
    );
    if (shouldAutoAdd && pathname && !isHomePath && (menus.length === 0 || menuLabelByPath.has(pathname)) && !nextTabs.some((tab) => tab.path === pathname)) {
      nextTabs.push({ path: pathname, label: resolveLabel(pathname) });
    }
    setTabState({
      snapshot: tabsSnapshot,
      userId,
      pathname,
      menuIndex: menuLabelByPath,
      initialized: tabsHydrated,
      tabs: nextTabs.slice(-MAX_OPEN_TABS),
      suppressNextAutoAdd: userChanged || isHomePath ? false : tabState.suppressNextAutoAdd,
    });
  }

  const openTabs = useMemo(
    () =>
      tabState.tabs
        .map((tab) => ({
          ...tab,
          label: resolveLabel(tab.path),
        }))
        .slice(-MAX_OPEN_TABS),
    [resolveLabel, tabState.tabs],
  );
  const contextTabIndex = contextMenu ? openTabs.findIndex((tab) => tab.path === contextMenu.targetPath) : -1;

  useEffect(() => {
    const strip = tabStripRef.current;
    if (!strip) return;
    const update = () => {
      const active = strip.querySelector<HTMLElement>('[data-active-tab="true"]');
      setTabIndicator(active ? { left: active.offsetLeft, width: active.offsetWidth } : { left: 0, width: 0 });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(strip);
    return () => observer.disconnect();
  }, [openTabs, pathname]);

  useEffect(() => {
    if (typeof window === "undefined" || !tabsHydrated) return;
    const next = JSON.stringify(openTabs);
    if (window.localStorage.getItem(TAB_STORAGE_KEY) === next) return;
    window.localStorage.setItem(TAB_STORAGE_KEY, next);
    window.dispatchEvent(new Event(TAB_STORAGE_CHANGE_EVENT));
  }, [openTabs, tabsHydrated]);

  function closeTab(path: string) {
    const next = openTabs.filter((tab) => tab.path !== path);
    if (pathname === path) {
      requestWorkspaceNavigation(() => {
        setTabState((previous) => ({ ...previous, tabs: next }));
        router.push(next[next.length - 1]?.path ?? "/dashboard");
      });
    } else setTabState((previous) => ({ ...previous, tabs: next }));
  }

  function closeAllTabs() {
    setContextMenu(null);
    requestWorkspaceNavigation(() => {
      setTabState((previous) => ({ ...previous, tabs: [], suppressNextAutoAdd: true }));
      router.push("/dashboard");
    });
  }

  function closeLeftTabs(targetPath: string) {
    const targetIndex = openTabs.findIndex((tab) => tab.path === targetPath);
    if (targetIndex <= 0) return;
    const next = openTabs.slice(targetIndex);
    const apply = () => { setTabState((previous) => ({ ...previous, tabs: next })); };
    if (!next.some((tab) => tab.path === pathname) && pathname !== "/dashboard") requestWorkspaceNavigation(() => { apply(); router.push(targetPath); });
    else apply();
    setContextMenu(null);
    contextMenuAnchorRef.current?.focus();
  }

  function closeRightTabs(targetPath: string) {
    const targetIndex = openTabs.findIndex((tab) => tab.path === targetPath);
    if (targetIndex < 0 || targetIndex >= openTabs.length - 1) return;
    const next = openTabs.slice(0, targetIndex + 1);
    const apply = () => { setTabState((previous) => ({ ...previous, tabs: next })); };
    if (!next.some((tab) => tab.path === pathname) && pathname !== "/dashboard") requestWorkspaceNavigation(() => { apply(); router.push(targetPath); });
    else apply();
    setContextMenu(null);
    contextMenuAnchorRef.current?.focus();
  }

  useEffect(() => {
    if (!contextMenu) return;
    contextMenuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();

    function handleClose() {
      setContextMenu(null);
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setContextMenu(null);
        contextMenuAnchorRef.current?.focus();
      }
    }

    window.addEventListener("click", handleClose);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [contextMenu]);

  return (
    <div className="vibe-workspace flex h-screen overflow-hidden bg-background text-[var(--vibe-text-base)]">
      <a href="#workspace-content" className="sr-only z-[100] rounded-lg bg-card px-4 py-3 font-semibold text-primary shadow-lg focus:not-sr-only focus:fixed focus:left-4 focus:top-4">본문으로 건너뛰기</a>
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-border/80 bg-card/95 text-card-foreground">
          <div className="flex min-h-17 items-center justify-between gap-2 px-3 py-2 lg:px-6">
            <div className="min-w-0 flex-1">
              {sectionLabel && sectionLabel !== pageTitle ? <p className="mb-1 hidden items-center gap-1 text-xs text-muted-foreground sm:flex">{sectionLabel}<ChevronRight className="h-3 w-3" aria-hidden="true" /></p> : null}
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard"
                  className="flex h-6 w-6 shrink-0 items-center justify-center lg:hidden"
                  aria-label="대시보드로 이동"
                  title="대시보드로 이동"
                >
                  <Image
                    src="/brand/vibehr-mark-color.svg"
                    alt=""
                    width={20}
                    height={20}
                    className="h-5 w-5"
                    aria-hidden="true"
                  />
                </Link>
                {headingInContent ? <span className="truncate text-sm text-[color:var(--vibe-nav-text)]">{pageTitle}</span> : <h1 className="truncate text-base font-bold tracking-[-0.02em] text-[color:var(--vibe-nav-text-strong)] sm:text-lg">
                  {pageTitle}
                </h1>}
              </div>
              {description && !headingInContent ? (
                <p className="mt-0.5 hidden truncate text-xs text-[color:var(--vibe-nav-text-muted)] md:block">{description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center justify-end gap-1 sm:gap-2">
              <WorkspaceNavigator key={user?.id ?? "anonymous"} tabs={openTabs} />
              <SessionCountdown />
              {isAdmin ? <div className="border-l border-border pl-1 sm:pl-2"><ImpersonationPopoverNoSsr /></div> : null}
              <AccountMenuNoSsr />
            </div>
          </div>

          <nav aria-label="열린 업무" className="overflow-x-auto border-t border-border/60 bg-[var(--vibe-surface-sunken)]/80 px-3 lg:px-6">
          <div ref={tabStripRef} className="relative flex min-w-max items-center gap-1">
            <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary transition-[transform,width] duration-200 ease-out motion-reduce:transition-none" style={{ width: tabIndicator.width, transform: `translateX(${tabIndicator.left}px)` }} />
            <button
              type="button"
              data-active-tab={pathname === "/dashboard"}
              aria-current={pathname === "/dashboard" ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-t-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                pathname === "/dashboard"
                  ? "bg-card text-[color:var(--vibe-nav-text-strong)]"
                  : "text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
              }`}
              onClick={() => navigate("/dashboard")}
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              홈
            </button>
            {openTabs.map((tab) => {
              const active = pathname === tab.path;
              return (
                <div
                  key={tab.path}
                  data-active-tab={active}
                  className={`inline-flex items-center rounded-t-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-card text-[color:var(--vibe-nav-text-strong)]"
                      : "text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
                  }`}
                >
                  <button
                    type="button"
                    className="min-h-11 max-w-40 truncate px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
                    onClick={() => navigate(tab.path)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      contextMenuAnchorRef.current = event.currentTarget;
                      setContextMenu({ x: event.clientX, y: event.clientY, targetPath: tab.path });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                        event.preventDefault();
                        contextMenuAnchorRef.current = event.currentTarget;
                        const rect = event.currentTarget.getBoundingClientRect();
                        setContextMenu({ x: rect.left, y: rect.bottom + 4, targetPath: tab.path });
                      }
                    }}
                    aria-current={active ? "page" : undefined}
                    aria-haspopup="menu"
                    title={`${tab.label} 탭`}
                  >
                    {tab.label}
                  </button>
                  <button
                    type="button"
                    aria-label={`${tab.label} 탭 관리`}
                    aria-haspopup="menu"
                    aria-expanded={contextMenu?.targetPath === tab.path}
                    aria-controls={contextMenu?.targetPath === tab.path ? "work-tab-menu" : undefined}
                    className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/70 lg:hidden"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (contextMenu?.targetPath === tab.path) { setContextMenu(null); return; }
                      contextMenuAnchorRef.current = event.currentTarget;
                      const rect = event.currentTarget.getBoundingClientRect();
                      setContextMenu({ x: rect.left, y: rect.bottom + 4, targetPath: tab.path });
                    }}
                  ><MoreHorizontal className="h-4 w-4" aria-hidden="true" /></button>
                  <button
                    type="button"
                    aria-label={`${tab.label} 탭 닫기`}
                    className="mr-1 flex h-10 w-8 items-center justify-center rounded-lg outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/70"
                    onClick={() => closeTab(tab.path)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

          </div>
          </nav>
        </header>

        <main id="workspace-content" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">{children}</main>
      </div>

      {idleReady ? <ChatAssistantFabNoSsr /> : null}

      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="fixed z-[80] min-w-40 rounded-md border border-border bg-card p-1 shadow-lg"
          style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 208)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 140)) }}
          onClick={(event) => event.stopPropagation()}
          role="menu"
          id="work-tab-menu"
          aria-label="탭 관리 메뉴"
          onKeyDown={(event) => {
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              buttons[(index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length]?.focus();
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              buttons[event.key === "Home" ? 0 : buttons.length - 1]?.focus();
            } else if (event.key === "Tab") {
              contextMenuAnchorRef.current?.focus();
              setContextMenu(null);
            }
          }}
        >
          <p className="border-b border-border px-2 py-2 text-xs font-semibold text-muted-foreground">{resolveLabel(contextMenu.targetPath)}</p>
          <button
            type="button"
            role="menuitem"
            disabled={contextTabIndex <= 0}
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => closeLeftTabs(contextMenu.targetPath)}
          >
            좌측 탭 모두 닫기
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={contextTabIndex < 0 || contextTabIndex >= openTabs.length - 1}
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)] disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => closeRightTabs(contextMenu.targetPath)}
          >
            우측 탭 모두 닫기
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
            onClick={closeAllTabs}
          >
            전체 탭 닫기 (홈 이동)
          </button>
        </div>
      ) : null}
    </div>
  );
}
