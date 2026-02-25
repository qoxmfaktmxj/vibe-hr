"use client";

import { CalendarCheck2, Home, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

export function AppShell({ title, description, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { menus } = useMenu();
  const [storedTabs, setStoredTabs] = useState<OpenTab[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as OpenTab[];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((tab) => typeof tab.path === "string" && typeof tab.label === "string");
    } catch {
      return [];
    }
  });

  const isAdmin = useMemo(() => Boolean(user?.roles?.includes("admin")), [user?.roles]);

  const resolveLabel = useCallback(
    (path: string) => findMenuLabel(menus, path) ?? getFallbackLabel(path),
    [menus],
  );

  const openTabs = useMemo(() => {
    const normalized = storedTabs.map((tab) => ({
      ...tab,
      label: resolveLabel(tab.path),
    }));

    if (!pathname || pathname === "/login" || pathname === "/unauthorized") {
      return normalized.slice(-MAX_OPEN_TABS);
    }

    const exists = normalized.some((tab) => tab.path === pathname);
    const next = exists ? normalized : [...normalized, { path: pathname, label: resolveLabel(pathname) }];
    return next.slice(-MAX_OPEN_TABS);
  }, [pathname, resolveLabel, storedTabs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TAB_STORAGE_KEY, JSON.stringify(openTabs));
  }, [openTabs]);

  function closeTab(path: string) {
    const next = openTabs.filter((tab) => tab.path !== path);
    setStoredTabs(next);

    if (pathname === path) {
      const fallbackPath = next[next.length - 1]?.path ?? "/dashboard";
      router.push(fallbackPath);
    }
  }

  function closeAllTabs() {
    setStoredTabs([]);
    router.push("/dashboard");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b border-border bg-card text-card-foreground">
          <div className="grid grid-cols-3 items-center px-4 py-2 lg:px-6">
            <div className="flex items-center gap-2">
              {isAdmin ? <ImpersonationPopover /> : <span className="h-8 w-8" aria-hidden="true" />}
            </div>

            <div className="flex justify-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-semibold text-primary transition hover:bg-primary/10"
                aria-label="대시보드로 이동"
                title="대시보드로 이동"
              >
                <CalendarCheck2 className="h-4 w-4" />
                <span>Vibe-HR</span>
              </Link>
            </div>

            <div className="flex items-center justify-end gap-2">
              <ThemeSettingsPopover />
              <LogoutButton />
            </div>
          </div>

          <div
            className="flex items-center gap-1 overflow-x-auto border-t border-border/70 px-3 py-2 lg:px-6"
            onContextMenu={(event) => {
              event.preventDefault();
              if (window.confirm("모든 탭을 닫고 홈으로 이동할까요?")) closeAllTabs();
            }}
            title="우클릭: 모든 탭 닫기"
          >
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

        <section className="border-b border-border bg-card px-6 py-3 lg:px-8">
          <h1 className="text-lg font-bold text-card-foreground">{title}</h1>
          {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
        </section>

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <ChatAssistantFab />
    </div>
  );
}
