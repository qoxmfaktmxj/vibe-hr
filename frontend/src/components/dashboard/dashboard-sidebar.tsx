"use client";

import {
  ChevronDown,
  Minus,
  Plus,
  PanelLeft,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type UIEvent, type MouseEvent, useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmployeeProfileDialog } from "@/components/dashboard/employee-profile-dialog";
import { renderMenuIcon } from "@/lib/menu-icon-render";
import type { MenuNode } from "@/types/menu";
import { cn } from "@/lib/utils";

import styles from "./dashboard-sidebar.module.css";

function renderIcon(iconName: string | null, className: string) {
  return renderMenuIcon(iconName, className);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function MenuLeafItem({ node, isActive }: { node: MenuNode; isActive: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!isActive || !ref.current) return;

    const element = ref.current;
    const container = element.closest("nav");
    if (!(container instanceof HTMLElement)) return;

    if (consumeCenterTargetPath(node.path)) {
      element.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const isVisible = elementRect.top >= containerRect.top && elementRect.bottom <= containerRect.bottom;
    if (!isVisible) {
      element.scrollIntoView({ block: "nearest" });
    }
  }, [isActive, node.path]);

  if (!node.path) return null;

  return (
    <Link
      ref={ref}
      href={node.path}
      onClick={() => setCenterTargetPath(node.path)}
      className={`flex min-h-10 items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
        isActive
          ? styles.menuLeafActive
          : "font-medium text-[color:var(--vibe-nav-text)] hover:bg-accent/70 hover:text-[color:var(--vibe-nav-text-strong)]"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      {renderIcon(node.icon, "h-4 w-4")}
      {node.name}
    </Link>
  );
}

function hasActiveDescendant(node: MenuNode, currentPath: string): boolean {
  if (node.path && currentPath.startsWith(node.path)) return true;
  return node.children.some((child) => hasActiveDescendant(child, currentPath));
}

/** 현재 경로를 포함하는 모든 상위 그룹의 code를 수집한다 */
function collectActiveCodes(nodes: MenuNode[], currentPath: string, acc: Set<string> = new Set()): Set<string> {
  for (const node of nodes) {
    if (node.children.length > 0 && hasActiveDescendant(node, currentPath)) {
      acc.add(node.code);
      collectActiveCodes(node.children, currentPath, acc);
    }
  }
  return acc;
}

const OPEN_CODES_STORAGE_KEY = "vibe_hr_sidebar_open_codes";
const OPEN_CODES_CHANGE_EVENT = "vibehr-sidebar-open-codes-change";
const SIDEBAR_SCROLL_TOP_STORAGE_KEY = "vibe_hr_sidebar_scroll_top";
const SIDEBAR_CENTER_TARGET_PATH_STORAGE_KEY = "vibe_hr_sidebar_center_target_path";

function subscribeToOpenCodes(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(OPEN_CODES_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(OPEN_CODES_CHANGE_EVENT, onChange);
  };
}

function getOpenCodesSnapshot(): string {
  try {
    return window.sessionStorage.getItem(OPEN_CODES_STORAGE_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function getServerOpenCodesSnapshot(): null {
  return null;
}

/** sessionStorage에서 열린 그룹 코드 Set 복원 */
function loadOpenCodes(raw: string | null): Set<string> {
  try {
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed.filter((code): code is string => typeof code === "string"));
  } catch {
    // 파싱 실패 시 무시
  }
  return new Set();
}

/** sessionStorage에 열린 그룹 코드 Set 저장 */
function saveOpenCodes(codes: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    const next = JSON.stringify([...codes]);
    if (window.sessionStorage.getItem(OPEN_CODES_STORAGE_KEY) === next) return;
    window.sessionStorage.setItem(OPEN_CODES_STORAGE_KEY, next);
    window.dispatchEvent(new Event(OPEN_CODES_CHANGE_EVENT));
  } catch {
    // 저장 실패 시 무시
  }
}

function loadSidebarScrollTop(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SIDEBAR_SCROLL_TOP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
}

function saveSidebarScrollTop(scrollTop: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SIDEBAR_SCROLL_TOP_STORAGE_KEY, String(Math.max(0, Math.floor(scrollTop))));
  } catch {
    // 저장 실패 시 무시
  }
}

function setCenterTargetPath(path: string | null | undefined): void {
  if (!path) return;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SIDEBAR_CENTER_TARGET_PATH_STORAGE_KEY, path);
  } catch {
    // 저장 실패 시 무시
  }
}

function consumeCenterTargetPath(path: string | null | undefined): boolean {
  if (!path) return false;
  if (typeof window === "undefined") return false;
  try {
    const target = window.sessionStorage.getItem(SIDEBAR_CENTER_TARGET_PATH_STORAGE_KEY);
    if (!target || target !== path) return false;
    window.sessionStorage.removeItem(SIDEBAR_CENTER_TARGET_PATH_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function MenuGroupItem({
  node,
  currentPath,
  depth = 0,
  openCodes,
  onToggle,
}: {
  node: MenuNode;
  currentPath: string;
  depth?: number;
  openCodes: Set<string>;
  onToggle: (code: string) => void;
}) {
  const active = hasActiveDescendant(node, currentPath);
  const isOpen = openCodes.has(node.code);
  const childrenId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.code)}
        aria-expanded={isOpen}
        aria-controls={childrenId}
        className={`flex min-h-10 w-full items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium transition-colors ${
          active
            ? "text-[color:var(--vibe-nav-text-strong)]"
            : "text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
        }`}
        style={{ paddingLeft: `${12 + depth * 12}px` }}
      >
        {renderIcon(node.icon, "h-4 w-4")}
        <span className="flex-1 text-left">{node.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      <div
        id={childrenId}
        aria-hidden={!isOpen}
        inert={isOpen ? undefined : true}
        className={cn(styles.menuGroupBody, isOpen && styles.menuGroupBodyOpen)}
      >
        <div className={cn(styles.menuGroupBodyInner, "mt-0.5 space-y-0.5")}>
          {node.children.map((child) =>
            child.children.length > 0 ? (
              <MenuGroupItem
                key={child.code}
                node={child}
                currentPath={currentPath}
                depth={depth + 1}
                openCodes={openCodes}
                onToggle={onToggle}
              />
            ) : (
              <MenuLeafItem
                key={child.code}
                node={child}
                isActive={child.path ? currentPath.startsWith(child.path) : false}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function DomainRailItem({
  node,
  active,
  onSelect,
  compact = false,
  panelId,
  expanded,
}: {
  node: MenuNode;
  active: boolean;
  onSelect: () => void;
  compact?: boolean;
  panelId?: string;
  expanded?: boolean;
}) {
  const content = (
    <>
      <span className={styles.railIcon}>{renderIcon(node.icon, "h-4.5 w-4.5")}</span>
      <span className={styles.railLabel}>{node.name}</span>
    </>
  );

  const className = cn(
    styles.railItem,
    compact && styles.railItemMobile,
    styles.railButton,
    active && styles.railItemActive,
  );

  if (node.path) {
    return (
      <Link
        href={node.path}
        onClick={onSelect}
        className={className}
        aria-current={active ? "page" : undefined}
        aria-label={node.name}
        aria-controls={panelId}
        aria-expanded={expanded}
        title={expanded === false ? `${node.name} 세부 메뉴 열기` : node.name}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
    type="button"
    onClick={onSelect}
    className={className}
    aria-pressed={active}
    aria-label={node.name}
    aria-controls={panelId}
    aria-expanded={expanded}
    title={expanded === false ? `${node.name} 세부 메뉴 열기` : node.name}
  >
    {content}
  </button>
  );
}

export function DashboardSidebar() {
  const { user } = useAuth();
  const { menus } = useMenu();
  const navigationMenus = useMemo(() => menus.filter((node) => node.path !== "/dashboard"), [menus]);
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileReturnFocusRef = useRef<HTMLButtonElement | null>(null);
  const openingMobileProfileRef = useRef(false);
  const [contextPanelCollapsed, setContextPanelCollapsed] = useState(false);
  const contextPanelId = useId();
  const domainRailRef = useRef<HTMLElement>(null);
  const routeDomainCode = navigationMenus.find((node) => hasActiveDescendant(node, pathname))?.code;
  const [domainSelection, setDomainSelection] = useState({ pathname, menus: navigationMenus, code: routeDomainCode ?? null });
  if (domainSelection.pathname !== pathname || domainSelection.menus !== navigationMenus) {
    setDomainSelection({ pathname, menus: navigationMenus, code: routeDomainCode ?? domainSelection.code });
  }
  const selectedDomainCode = domainSelection.code;

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeMobileMenu = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeMobileMenu);
    return () => desktop.removeEventListener("change", closeMobileMenu);
  }, []);

  const openCodesSnapshot = useSyncExternalStore<string | null>(subscribeToOpenCodes, getOpenCodesSnapshot, getServerOpenCodesSnapshot);
  const sidebarHydrated = openCodesSnapshot !== null;
  const [groupState, setGroupState] = useState(() => ({
    snapshot: openCodesSnapshot,
    pathname,
    menusInitialized: false,
    codes: loadOpenCodes(openCodesSnapshot),
  }));
  const initializeMenus = sidebarHydrated && menus.length > 0 && !groupState.menusInitialized;
  if (groupState.snapshot !== openCodesSnapshot || groupState.pathname !== pathname || initializeMenus) {
    const next = groupState.snapshot !== openCodesSnapshot ? loadOpenCodes(openCodesSnapshot) : new Set(groupState.codes);
    if (initializeMenus || groupState.pathname !== pathname) {
      for (const code of collectActiveCodes(menus, pathname)) next.add(code);
    }
    setGroupState({ snapshot: openCodesSnapshot, pathname, menusInitialized: groupState.menusInitialized || initializeMenus, codes: next });
  }
  const openCodes = groupState.codes;

  // openCodes 변경 시 sessionStorage에 저장 (hydration 완료 후에만)
  useEffect(() => {
    if (!sidebarHydrated) return;
    saveOpenCodes(openCodes);
  }, [openCodes, sidebarHydrated]);

  const toggleGroup = useCallback((code: string) => {
    setGroupState((previous) => {
      const next = new Set(previous.codes);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...previous, codes: next };
    });
  }, []);
  const restoreMenuScroll = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const stored = loadSidebarScrollTop();
    if (stored === null) return;
    element.scrollTop = stored;
  }, []);
  const handleMenuScroll = useCallback((event: UIEvent<HTMLElement>) => {
    saveSidebarScrollTop(event.currentTarget.scrollTop);
  }, []);

  const displayName = user?.display_name ?? "User";
  const initials = getInitials(displayName) || "U";

  const activeDomain = useMemo(
    () => navigationMenus.find((node) => node.code === selectedDomainCode) ?? navigationMenus[0] ?? null,
    [navigationMenus, selectedDomainCode],
  );

  const contextNodes = useMemo(() => {
    if (!activeDomain) return [];
    return activeDomain.children.length > 0 ? activeDomain.children : [activeDomain];
  }, [activeDomain]);

  const contextGroupCodes = useMemo(() => {
    const codes: string[] = [];
    function collect(nodes: MenuNode[]) {
      for (const node of nodes) {
        if (node.children.length > 0) {
          codes.push(node.code);
          collect(node.children);
        }
      }
    }
    collect(contextNodes);
    return codes;
  }, [contextNodes]);
  const menuExpanded = contextGroupCodes.some((code) => openCodes.has(code));

  const toggleContextGroups = () => {
    setGroupState((previous) => {
      const next = new Set(previous.codes);
      const shouldCollapse = contextGroupCodes.some((code) => previous.codes.has(code));
      for (const code of contextGroupCodes) {
        if (shouldCollapse) next.delete(code);
        else next.add(code);
      }
      return { ...previous, codes: next };
    });
  };

  const openProfile = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    openingMobileProfileRef.current = mobileOpen;
    profileReturnFocusRef.current = mobileOpen ? mobileTriggerRef.current : event.currentTarget;
    setMobileOpen(false);
    setProfileOpen(true);
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-17 items-center gap-2 border-b border-border/80 px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-[color:var(--vibe-nav-text-muted)]">업무 영역</p>
            <p className="truncate text-base font-bold tracking-[-0.02em] text-[color:var(--vibe-nav-text-strong)]">
              {activeDomain?.name ?? "메뉴"}
            </p>
          </div>
          {contextGroupCodes.length > 0 && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 shrink-0 rounded-sm shadow-none"
              onClick={toggleContextGroups}
              title={menuExpanded ? "메뉴 전체 접기" : "메뉴 전체 펼치기"}
              aria-label={menuExpanded ? "메뉴 전체 접기" : "메뉴 전체 펼치기"}
            >
              {menuExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            </Button>
          )}
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="hidden h-8 w-8 shrink-0 rounded-sm lg:inline-flex"
            onClick={() => {
              domainRailRef.current?.querySelector<HTMLElement>('[aria-expanded="true"]')?.focus();
              setContextPanelCollapsed(true);
            }}
            title="세부 메뉴 닫기"
            aria-label="세부 메뉴 닫기"
            aria-controls={contextPanelId}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <nav
          ref={restoreMenuScroll}
          onScroll={handleMenuScroll}
          className={cn(styles.sidebarScroll, "mt-2 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2")}
        >
          {contextNodes.map((node) =>
            node.children.length > 0 ? (
              <MenuGroupItem
                key={node.code}
                node={node}
                currentPath={pathname}
                openCodes={openCodes}
                onToggle={toggleGroup}
              />
            ) : (
              <MenuLeafItem
                key={node.code}
                node={node}
                isActive={node.path ? pathname.startsWith(node.path) : false}
              />
            ),
          )}
        </nav>
      </div>

      <div className="shrink-0 border-t border-border bg-[var(--vibe-sidebar-bg)] p-3 lg:hidden">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-accent"
          onClick={openProfile}
        >
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-[color:var(--vibe-nav-text-strong)]">{displayName}</span>
            <span className="text-xs text-[color:var(--vibe-nav-text-muted)]">내 정보 보기</span>
          </div>
        </button>
      </div>
    </>
  );

  const domainRail = (
    <nav ref={domainRailRef} className="vibe-rail flex shrink-0" style={{ width: "4.5rem" }} aria-label="업무 영역">
      <Link
        href="/dashboard"
        className="mx-auto mt-2 flex h-10 w-10 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        aria-label="VIBE-HR 대시보드"
        title="VIBE-HR 대시보드"
      >
        <Image
          src="/vibehr_mark.svg"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8"
          aria-hidden="true"
        />
      </Link>
      <div className={cn(styles.sidebarScroll, "mt-1 flex min-h-0 flex-1 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden px-1 pb-2")}>
        {navigationMenus.map((node) => (
          <DomainRailItem
            key={node.code}
            node={node}
            active={activeDomain?.code === node.code}
            panelId={contextPanelId}
            expanded={activeDomain?.code === node.code && !contextPanelCollapsed}
            onSelect={() => {
              setDomainSelection((previous) => ({ ...previous, code: node.code }));
              setContextPanelCollapsed(false);
            }}
          />
        ))}
      </div>

      <div className={cn(styles.railFooter, "hidden lg:block")}>
        <button
          type="button"
          onClick={openProfile}
          className={cn(styles.railItem, styles.railButton, styles.profileTrigger)}
          aria-label="내 정보 보기"
          title="내 정보 보기"
          data-full-label="내 정보 보기"
        >
          <span className={styles.railIcon}>
            <Avatar className="h-8 w-8">
              <AvatarFallback className={styles.profileAvatarFallback}>{initials}</AvatarFallback>
            </Avatar>
          </span>
          <span className={styles.railLabel}>내 정보</span>
        </button>
      </div>
    </nav>
  );

  const mobileDomainRail = (
    <nav className={cn(styles.sidebarScroll, "vibe-rail vibe-rail--mobile flex shrink-0 items-start gap-1 overflow-x-auto p-2")} aria-label="업무 영역">
      {navigationMenus.map((node) => (
        <DomainRailItem
          key={node.code}
          node={node}
          active={activeDomain?.code === node.code}
          compact
          onSelect={() => {
            setDomainSelection((previous) => ({ ...previous, code: node.code }));
            setContextPanelCollapsed(false);
          }}
        />
      ))}
    </nav>
  );

  return (
    <>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <button ref={mobileTriggerRef} type="button" className="fixed bottom-5 right-5 z-50 flex min-h-11 items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-lg lg:hidden" aria-label="메뉴 열기">
            <PanelLeft className="h-4 w-4" aria-hidden="true" />메뉴
          </button>
        </DialogTrigger>
        <DialogContent
          showClose={false}
          onCloseAutoFocus={(event) => {
            if (openingMobileProfileRef.current) event.preventDefault();
          }}
          className="fixed inset-0 z-[60] lg:hidden left-0 top-0 right-auto h-[100dvh] w-[min(21rem,calc(100vw-2.5rem))] translate-x-0 translate-y-0 rounded-r-md rounded-l-none border-r border-border bg-[var(--vibe-sidebar-bg)] p-0 shadow-[var(--vibe-shadow-floating)] [--radius:0.5rem]"
        >
          <div className="flex h-full min-h-0 flex-col">
            <DialogTitle className="sr-only">업무 영역 메뉴</DialogTitle>
            <DialogDescription className="sr-only">
              업무 영역을 선택하고 세부 메뉴를 확인할 수 있습니다.
            </DialogDescription>
            <div className="flex items-center justify-between border-b border-[var(--vibe-rail-border)] bg-[var(--vibe-rail-bg)] px-3 py-2 text-white">
              <span className="text-sm font-bold">VIBE-HR</span>
              <button
                type="button"
                className="rounded-md p-2 text-white hover:bg-[var(--vibe-rail-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {mobileDomainRail}
            {sidebarContent}
          </div>
        </DialogContent>
      </Dialog>

      <EmployeeProfileDialog open={profileOpen} returnFocusRef={profileReturnFocusRef} onOpenChange={(nextOpen) => {
        setProfileOpen(nextOpen);
        if (!nextOpen) openingMobileProfileRef.current = false;
      }} />

      <div className="hidden shrink-0 lg:flex">
        {domainRail}
        <aside
          id={contextPanelId}
          className={cn(
            "flex w-[13rem] flex-col border-r border-border bg-[var(--vibe-sidebar-bg)]",
            styles.desktopContextPanel,
            contextPanelCollapsed && styles.desktopContextPanelCollapsed,
          )}
          inert={contextPanelCollapsed ? true : undefined}
        >
          <div className={styles.desktopContextPanelInner}>{sidebarContent}</div>
        </aside>
      </div>
    </>
  );
}
