"use client";

import { Home, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { useMenu } from "@/components/auth/menu-provider";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { ChatAssistantFab } from "@/components/layout/chat-assistant-fab";
import { ImpersonationPopover } from "@/components/layout/impersonation-popover";
import { ThemeSettingsPopover } from "@/components/layout/theme-settings-popover";
import type { MenuNode } from "@/types/menu";

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

function findMenuLabel(menus: MenuNode[], path: string): string | null {
  for (const node of menus) {
    if (node.path === path) return node.name;
    if (node.children.length > 0) {
      const found = findMenuLabel(node.children, path);
      if (found) return found;
    }
  }
  return null;
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
  const [skipAutoAddPath, setSkipAutoAddPath] = useState<string | null>(null);

  const isAdmin = useMemo(() => Boolean(user?.roles?.includes("admin")), [user?.roles]);

  // 로그인 사용자가 바뀌면(계정 전환/로그아웃 후 재로그인) 탭 전체 초기화
  const prevUserIdRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    const currentId = user?.id ?? null;
    // undefined → 최초 마운트는 스킵, null/숫자 → 실제 값이 들어온 이후 변경만 감지
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

  const resolveLabel = useCallback(
    (path: string) => findMenuLabel(menus, path) ?? getFallbackLabel(path),
    [menus],
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

  const openTabs = useMemo(() => {
    const normalized = storedTabs.map((tab) => ({
      ...tab,
      label: resolveLabel(tab.path),
    }));

    if (
      !pathname ||
      pathname === "/login" ||
      pathname === "/unauthorized" ||
      pathname === "/dashboard" ||
      pathname === skipAutoAddPath
    ) {
      return normalized.slice(-MAX_OPEN_TABS);
    }

    const exists = normalized.some((tab) => tab.path === pathname);
    const next = exists ? normalized : [...normalized, { path: pathname, label: resolveLabel(pathname) }];
    return next.slice(-MAX_OPEN_TABS);
  }, [pathname, resolveLabel, skipAutoAddPath, storedTabs]);

  useEffect(() => {
    if (typeof window === "undefined" || !tabsHydrated) return;
    window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs, tabsHydrated]);

  // 메뉴(권한) 변경 시: 새 메뉴에 없는 탭 자동 제거
  // - 계정 전환 후 이전 계정의 탭이 남아 경로 문자열 그대로 노출되는 현상 방지
  useEffect(() => {
    if (!tabsHydrated || menus.length === 0) return;
    setStoredTabs((prev) => prev.filter((tab) => findMenuLabel(menus, tab.path) !== null));
  }, [menus, tabsHydrated]);

  function closeTab(path: string) {
    const next = openTabs.filter((tab) => tab.path !== path);
    setStoredTabs(next);

    if (pathname === path) {
      const fallbackPath = next[next.length - 1]?.path ?? "/dashboard";
      router.push(fallbackPath);
    }
  }

  function closeAllTabs() {
    setSkipAutoAddPath(pathname);
    setStoredTabs([]);
    router.push("/dashboard");
    setContextMenu(null);
    window.setTimeout(() => {
      setSkipAutoAddPath(null);
    }, 0);
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
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-border bg-card text-card-foreground">
          <div className="grid grid-cols-3 items-center px-4 py-2 lg:px-6">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8" aria-hidden="true" />
            </div>

            <div className="flex justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
                aria-label="대시보드로 이동"
                title="대시보드로 이동"
              >
                <Image
                  src="/vibehr_logo-256x256.png"
                  alt="Vibe-HR"
                  width={16}
                  height={16}
                  className="h-4 w-4"
                />
                <span>Vibe-HR</span>
              </Link>
            </div>

            <div className="flex items-center justify-end gap-2">
              <ThemeSettingsPopover />
              {/* user 로드 전: 자리 유지(DOM 구조 고정)하여 Radix ID mismatch 방지 */}
              <span className={isAdmin ? undefined : "invisible pointer-events-none"}>
                <ImpersonationPopover />
              </span>
              <LogoutButton />
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto border-t border-border/70 px-3 py-2 lg:px-6">
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                pathname === "/dashboard" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
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
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${
                    active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:bg-accent"
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

      <ChatAssistantFab />

      {contextMenu ? (
        <div
          className="fixed z-[80] min-w-40 rounded-md border border-border bg-card p-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
            onClick={() => closeLeftTabs(contextMenu.targetPath)}
          >
            좌측 탭 모두 닫기
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
            onClick={() => closeRightTabs(contextMenu.targetPath)}
          >
            우측 탭 모두 닫기
          </button>
          <button
            type="button"
            className="block w-full rounded px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent"
            onClick={closeAllTabs}
          >
            전체 탭 닫기 (홈 이동)
          </button>
        </div>
      ) : null}
    </div>
  );
}
