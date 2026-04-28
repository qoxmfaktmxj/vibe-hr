"use client";

import { Bell, Home, Search, X } from "lucide-react";
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

export function AppShell({ title: _title, description: _description, children }: AppShellProps) {
  void _title;
  void _description;

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
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-border bg-card text-card-foreground">
          <div className="flex h-[73px] items-center justify-between gap-4 border-b border-border px-4 lg:px-6">
            {/* 좌측: 로고 + 검색 바 */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Link
                href="/dashboard"
                className="inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-accent"
                aria-label="대시보드로 이동"
                title="대시보드로 이동"
              >
                <Image
                  src="/vibehr_mark.svg"
                  alt="VIBE-HR"
                  width={16}
                  height={16}
                  className="h-4 w-4"
                />
                <span className="text-primary">VIBE-HR</span>
              </Link>

              {/* 검색 바 (데스크톱만) */}
              <div className="hidden md:flex items-center gap-2 flex-1 max-w-md px-3 py-1.5 rounded-full bg-muted border border-border text-muted-foreground">
                <Search className="h-4 w-4 shrink-0" />
                <input
                  type="text"
                  placeholder="메뉴 검색"
                  className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
                  aria-label="메뉴 검색"
                />
                <kbd className="hidden lg:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded bg-card border border-border text-muted-foreground">
                  <span>⌘</span>K
                </kbd>
              </div>
            </div>

            {/* 우측: 액션 cluster */}
            <div className="flex items-center gap-2 shrink-0">
              <SessionCountdown />
              <ThemeSettingsPopoverNoSsr />
              {/* user 로드 전 자리 유지 (DOM 구조 고정) */}
              <span className={isAdmin ? undefined : "invisible pointer-events-none"}>
                <ImpersonationPopoverNoSsr />
              </span>
              {/* 알림 버튼 (placeholder) */}
              <button
                type="button"
                aria-label="알림"
                className="relative h-9 w-9 flex items-center justify-center rounded-md hover:bg-accent text-muted-foreground transition-colors"
              >
                <Bell className="h-4 w-4" />
              </button>
              {/* 사용자 아바타 */}
              {user && (
                <div
                  className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0"
                  aria-label={`${user.display_name} 프로필`}
                  title={user.display_name}
                >
                  {user.display_name[0].toUpperCase()}
                </div>
              )}
              <LogoutButton />
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-t border-border/70 px-3 py-2 lg:px-6">
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
                <button
                  key={tab.path}
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary/40 bg-primary/12 text-[color:var(--vibe-nav-text-strong)]"
                      : "border-border bg-card text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
                  }`}
                  onClick={() => router.push(tab.path)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setContextMenu({ x: event.clientX, y: event.clientY, targetPath: tab.path });
                  }}
                >
                  <span className="max-w-28 truncate">{tab.label}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`${tab.label} 탭 닫기`}
                    className="rounded p-0.5 hover:bg-accent"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.path);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        closeTab(tab.path);
                      }
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                </button>
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
        >
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
            onClick={() => closeLeftTabs(contextMenu.targetPath)}
          >
            좌측 탭 모두 닫기
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
            onClick={() => closeRightTabs(contextMenu.targetPath)}
          >
            우측 탭 모두 닫기
          </button>
          <button
            type="button"
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
