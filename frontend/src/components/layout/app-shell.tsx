"use client";

import { Home, X } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { useMenu } from "@/components/auth/menu-provider";
import { SessionCountdown } from "@/components/layout/session-countdown";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import type { MenuNode } from "@/types/menu";

const ThemeSettingsPopoverNoSsr = dynamic(
  () => import("@/components/layout/theme-settings-popover").then((mod) => mod.ThemeSettingsPopover),
  {
    ssr: false,
    loading: () => <span className="inline-block h-9 w-9" aria-hidden="true" />,
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
const MAX_OPEN_TABS = 10;

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
  const pathname = usePathname();
  const { user } = useAuth();
  const { menus } = useMenu();
  const [storedTabs, setStoredTabs] = useState<OpenTab[]>([]);
  const [tabsHydrated, setTabsHydrated] = useState(false);

  const [contextMenu, setContextMenu] = useState<TabContextMenuState>(null);
  const [suppressNextAutoAdd, setSuppressNextAutoAdd] = useState(false);

  const isAdmin = useMemo(() => Boolean(user?.roles?.includes("admin")), [user?.roles]);
  const idleReady = useIdleMount();

  // 로그인 사용자가 바뀌면(계정 전환/로그아웃 후 재로그인) 탭 전체 초기화
  const prevUserIdRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const currentId = user?.id ?? null;
    // undefined => 최초 마운트는 스킵, null/숫자 => 실제 값이 들어온 이후 변경만 감지
    if (prevUserIdRef.current === undefined) {
      prevUserIdRef.current = currentId;
      return;
    }
    if (prevUserIdRef.current !== currentId) {
      prevUserIdRef.current = currentId;
      setStoredTabs([]);
      window.localStorage.removeItem(TAB_STORAGE_KEY);
    }
  }, [user?.id]);

  const menuLabelByPath = useMemo(() => buildMenuLabelIndex(menus), [menus]);

  const resolveLabel = useCallback(
    (path: string) => menuLabelByPath.get(path) ?? getFallbackLabel(path),
    [menuLabelByPath],
  );

  const pageTitle = title === "VIBE-HR" ? resolveLabel(pathname) : title;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (!raw) {
      setTabsHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as OpenTab[];
      if (!Array.isArray(parsed)) {
        setTabsHydrated(true);
        return;
      }

      setStoredTabs(
        parsed.filter(
          (tab) =>
            typeof tab.path === "string" &&
            typeof tab.label === "string" &&
            tab.path !== "/dashboard",
        ),
      );
    } catch {
      setStoredTabs([]);
    } finally {
      setTabsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!tabsHydrated) return;

    setStoredTabs((prev) => {
      const normalized = prev
        .filter((tab) => tab.path !== "/dashboard")
        .map((tab) => ({ ...tab, label: resolveLabel(tab.path) }));

      if (suppressNextAutoAdd) {
        if (
          pathname === "/dashboard" ||
          pathname === "/login" ||
          pathname === "/unauthorized"
        ) {
          setSuppressNextAutoAdd(false);
        }
        return normalized.slice(-MAX_OPEN_TABS);
      }

      if (
        !pathname ||
        pathname === "/login" ||
        pathname === "/unauthorized" ||
        pathname === "/dashboard"
      ) {
        return normalized.slice(-MAX_OPEN_TABS);
      }

      const exists = normalized.some((tab) => tab.path === pathname);
      if (exists) {
        return normalized.slice(-MAX_OPEN_TABS);
      }

      return [...normalized, { path: pathname, label: resolveLabel(pathname) }].slice(-MAX_OPEN_TABS);
    });
  }, [pathname, resolveLabel, suppressNextAutoAdd, tabsHydrated]);

  const openTabs = useMemo(
    () =>
      storedTabs
        .map((tab) => ({
          ...tab,
          label: resolveLabel(tab.path),
        }))
        .slice(-MAX_OPEN_TABS),
    [resolveLabel, storedTabs],
  );

  useEffect(() => {
    if (typeof window === "undefined" || !tabsHydrated) return;
    window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs, tabsHydrated]);

  // 메뉴(권한) 변경 시: 새 메뉴에 없는 탭 자동 제거
  // - 계정 전환 후 이전 계정 탭명이 그대로 노출되는 현상 방지
  useEffect(() => {
    if (!tabsHydrated || menus.length === 0) return;
    setStoredTabs((prev) => prev.filter((tab) => menuLabelByPath.has(tab.path)));
  }, [menuLabelByPath, menus.length, tabsHydrated]);

  function closeTab(path: string) {
    const next = openTabs.filter((tab) => tab.path !== path);
    setStoredTabs(next);

    if (pathname === path) {
      const fallbackPath = next[next.length - 1]?.path ?? "/dashboard";
      router.push(fallbackPath);
    }
  }

  function closeAllTabs() {
    setSuppressNextAutoAdd(true);
    setStoredTabs([]);
    router.push("/dashboard");
    setContextMenu(null);
  }

  function closeLeftTabs(targetPath: string) {
    const targetIndex = openTabs.findIndex((tab) => tab.path === targetPath);
    if (targetIndex <= 0) return;
    setStoredTabs(openTabs.slice(targetIndex));
    setContextMenu(null);
  }

  function closeRightTabs(targetPath: string) {
    const targetIndex = openTabs.findIndex((tab) => tab.path === targetPath);
    if (targetIndex < 0 || targetIndex >= openTabs.length - 1) return;
    setStoredTabs(openTabs.slice(0, targetIndex + 1));
    setContextMenu(null);
  }

  useEffect(() => {
    if (!contextMenu) return;

    function handleClose() {
      setContextMenu(null);
    }

    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setContextMenu(null);
    }

    window.addEventListener("click", handleClose);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("click", handleClose);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [contextMenu]);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-border/80 bg-card/95 text-card-foreground backdrop-blur-sm">
          <div className="flex min-h-15 items-center justify-between gap-4 border-b border-border px-4 py-2.5 lg:px-6">
            <div className="min-w-0">
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
                <h1 className="truncate text-base font-bold tracking-[-0.02em] text-[color:var(--vibe-nav-text-strong)]">
                  {pageTitle}
                </h1>
              </div>
              {description ? (
                <p className="mt-0.5 truncate text-xs text-[color:var(--vibe-nav-text-muted)]">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2">
              <SessionCountdown />
              <ThemeSettingsPopoverNoSsr />
              {/* user 로드 전 자리 유지 (DOM 구조 고정) */}
              <span className={isAdmin ? undefined : "invisible pointer-events-none"}>
                <ImpersonationPopoverNoSsr />
              </span>
              <LogoutButton />
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-t border-border/70 bg-[var(--vibe-surface-sunken)]/80 px-3 py-2 lg:px-6">
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                pathname === "/dashboard"
                  ? "bg-primary/12 text-[color:var(--vibe-nav-text-strong)]"
                  : "text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
              }`}
              onClick={() => router.push("/dashboard")}
            >
              <Home className="h-3.5 w-3.5" />
              홈
            </button>
            {openTabs.map((tab) => {
              const active = pathname === tab.path;
              return (
                <div
                  key={tab.path}
                  className={`inline-flex items-center rounded-md border text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/12 text-[color:var(--vibe-nav-text-strong)]"
                      : "border-border bg-card text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
                  }`}
                >
                  <button
                    type="button"
                    className="max-w-28 truncate px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/70"
                    onClick={() => router.push(tab.path)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setContextMenu({ x: event.clientX, y: event.clientY, targetPath: tab.path });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                        event.preventDefault();
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
                    aria-label={`${tab.label} 탭 닫기`}
                    className="mr-1 rounded p-0.5 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/70"
                    onClick={() => closeTab(tab.path)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}

          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      {idleReady ? <ChatAssistantFabNoSsr /> : null}

      {contextMenu ? (
        <div
          className="fixed z-[80] min-w-40 rounded-md border border-border bg-card p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
          role="menu"
          aria-label="탭 관리 메뉴"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
            onClick={() => closeLeftTabs(contextMenu.targetPath)}
          >
            좌측 탭 모두 닫기
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
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
