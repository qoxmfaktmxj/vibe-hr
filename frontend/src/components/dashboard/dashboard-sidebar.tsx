"use client";

import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  IdCard,
  Clock,
  Minus,
  Plus,
  FileText,
  FolderTree,
  LayoutDashboard,
  ListOrdered,
  Mail,
  Menu,
  PanelLeft,
  Settings,
  Shield,
  UserRound,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type UIEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { EmployeeItem } from "@/types/employee";
import type { MenuNode } from "@/types/menu";

function renderIcon(iconName: string | null, className: string) {
  switch (iconName) {
    case "UsersRound":
      return <UsersRound className={className} aria-hidden="true" />;
    case "UserRound":
      return <UserRound className={className} aria-hidden="true" />;
    case "Clock":
      return <Clock className={className} aria-hidden="true" />;
    case "CalendarCheck2":
      return <CalendarCheck2 className={className} aria-hidden="true" />;
    case "CalendarDays":
      return <CalendarDays className={className} aria-hidden="true" />;
    case "Wallet":
      return <Wallet className={className} aria-hidden="true" />;
    case "Calculator":
      return <Calculator className={className} aria-hidden="true" />;
    case "FileText":
      return <FileText className={className} aria-hidden="true" />;
    case "Building2":
      return <Building2 className={className} aria-hidden="true" />;
    case "FolderTree":
      return <FolderTree className={className} aria-hidden="true" />;
    case "Settings":
      return <Settings className={className} aria-hidden="true" />;
    case "Shield":
      return <Shield className={className} aria-hidden="true" />;
    case "Menu":
      return <Menu className={className} aria-hidden="true" />;
    case "ListOrdered":
      return <ListOrdered className={className} aria-hidden="true" />;
    case "PanelLeft":
      return <PanelLeft className={className} aria-hidden="true" />;
    default:
      return <LayoutDashboard className={className} aria-hidden="true" />;
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function toEmploymentStatusLabel(status: EmployeeItem["employment_status"]): string {
  switch (status) {
    case "leave":
      return "휴직";
    case "resigned":
      return "퇴사";
    default:
      return "재직";
  }
}

type ProfileTone = "primary" | "emerald" | "violet" | "rose" | "amber";

type ProfileInfoCard = {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: ProfileTone;
  mono?: boolean;
};

function formatProfileDateTime(value: Date): string {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value);
}

function getProfileToneCardClass(tone: ProfileTone): string {
  if (tone === "emerald") {
    return "border-emerald-200/70 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20";
  }
  if (tone === "violet") {
    return "border-violet-200/70 bg-violet-50/50 dark:border-violet-900/40 dark:bg-violet-950/20";
  }
  if (tone === "rose") {
    return "border-rose-200/70 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20";
  }
  if (tone === "amber") {
    return "border-amber-200/70 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20";
  }
  return "border-primary/30 bg-primary/5 dark:border-primary/40 dark:bg-primary/10";
}

function getProfileToneIconClass(tone: ProfileTone): string {
  if (tone === "emerald") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  }
  if (tone === "violet") {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300";
  }
  if (tone === "rose") {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  }
  if (tone === "amber") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300";
  }
  return "bg-primary/15 text-primary dark:bg-primary/25";
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
      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary/12 text-[color:var(--vibe-nav-text-strong)]"
          : "text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
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
const SIDEBAR_SCROLL_TOP_STORAGE_KEY = "vibe_hr_sidebar_scroll_top";
const SIDEBAR_CENTER_TARGET_PATH_STORAGE_KEY = "vibe_hr_sidebar_center_target_path";

/** sessionStorage에서 열린 그룹 코드 Set 복원 */
function loadOpenCodes(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(OPEN_CODES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return new Set(parsed as string[]);
  } catch {
    // 파싱 실패 시 무시
  }
  return new Set();
}

/** sessionStorage에 열린 그룹 코드 Set 저장 */
function saveOpenCodes(codes: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(OPEN_CODES_STORAGE_KEY, JSON.stringify([...codes]));
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

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.code)}
        className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          active
            ? "text-[color:var(--vibe-nav-text-strong)]"
            : "text-[color:var(--vibe-nav-text)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
        }`}
        style={{ paddingLeft: `${16 + depth * 12}px` }}
      >
        {renderIcon(node.icon, "h-4 w-4")}
        <span className="flex-1 text-left">{node.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="mt-0.5 space-y-0.5 ml-4 border-l border-gray-200 pl-3">
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
      ) : null}
    </div>
  );
}

export function DashboardSidebar() {
  const { user } = useAuth();
  const { menus } = useMenu();
  const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(true);

  // 열림 상태를 그룹 code의 Set으로 관리
  // - SSR/CSR hydration mismatch 방지: 초기값은 빈 Set (서버와 동일)
  // - 클라이언트 마운트 후 sessionStorage에서 복원
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());
  const [sidebarHydrated, setSidebarHydrated] = useState(false);

  // 클라이언트 마운트 후 sessionStorage에서 열림 상태 복원
  useEffect(() => {
    const stored = loadOpenCodes();
    setOpenCodes(stored);
    setSidebarHydrated(true);
  }, []);

  // openCodes 변경 시 sessionStorage에 저장 (hydration 완료 후에만)
  useEffect(() => {
    if (!sidebarHydrated) return;
    saveOpenCodes(openCodes);
  }, [openCodes, sidebarHydrated]);

  // menus 로드 완료 시 현재 경로의 상위 그룹 열기 (초기 마운트 대응)
  const menusInitializedRef = useRef(false);
  useEffect(() => {
    if (!sidebarHydrated || menus.length === 0) return;
    if (menusInitializedRef.current) return;
    menusInitializedRef.current = true;
    setOpenCodes((prev) => {
      const active = collectActiveCodes(menus, pathname);
      // 기존에 사용자가 열어둔 것 + 현재 경로 상위 그룹 합산
      return new Set([...prev, ...active]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menus, sidebarHydrated]);

  // pathname 변경 시: 새 경로의 상위 그룹을 추가로 열기 (기존 열린 그룹은 유지)
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    if (menus.length === 0) return;
    setOpenCodes((prev) => {
      const active = collectActiveCodes(menus, pathname);
      return new Set([...prev, ...active]);
    });
  }, [pathname, menus]);

  const toggleGroup = useCallback((code: string) => {
    setOpenCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileEmployee, setProfileEmployee] = useState<EmployeeItem | null>(null);
  const [profileLoadedAt, setProfileLoadedAt] = useState<Date | null>(null);

  const displayName = user?.display_name ?? "User";
  const roleLabels = user?.roles?.join(", ") ?? "";
  const initials = getInitials(displayName) || "U";

  const profileRows = useMemo<ProfileInfoCard[]>(
    () => [
      { label: "이름", value: displayName, icon: UserRound, tone: "primary" },
      { label: "이메일", value: user?.email ?? "-", icon: Mail, tone: "primary" },
      { label: "권한", value: roleLabels || "-", icon: Shield, tone: "violet" },
      { label: "로그인ID", value: profileEmployee?.login_id ?? "-", icon: IdCard, tone: "primary", mono: true },
      { label: "사번", value: profileEmployee?.employee_no ?? "-", icon: BadgeCheck, tone: "primary", mono: true },
      { label: "부서", value: profileEmployee?.department_name ?? "-", icon: Building2, tone: "violet" },
      { label: "직책", value: profileEmployee?.position_title ?? "-", icon: BriefcaseBusiness, tone: "violet" },
      { label: "입사일", value: profileEmployee?.hire_date ?? "-", icon: CalendarDays, tone: "emerald", mono: true },
      {
        label: "재직상태",
        value: profileEmployee ? toEmploymentStatusLabel(profileEmployee.employment_status) : "-",
        icon: Clock,
        tone: "amber",
      },
      {
        label: "로그인 활성",
        value: profileEmployee ? (profileEmployee.is_active ? "Y" : "N") : "-",
        icon: Settings,
        tone: "rose",
        mono: true,
      },
    ],
    [displayName, profileEmployee, roleLabels, user?.email],
  );

  const loadMyProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const response = await fetch("/api/employees/me", { cache: "no-store" });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(json?.detail ?? "프로필 정보를 불러오지 못했습니다.");
      }

      const json = (await response.json()) as { employee?: EmployeeItem };
      setProfileEmployee(json.employee ?? null);
      setProfileLoadedAt(new Date());
    } catch (error) {
      setProfileEmployee(null);
      setProfileLoadedAt(null);
      setProfileError(
        error instanceof Error
          ? error.message
          : "프로필 정보를 불러오지 못했습니다.",
      );
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const openProfile = useCallback(() => {
    setProfileOpen(true);
    void loadMyProfile();
  }, [loadMyProfile]);

  const sidebarContent = (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Image
              src="/vibehr_logo-256x256.png"
              alt="Vibe-HR"
              width={20}
              height={20}
              className="h-5 w-5"
              priority
            />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight text-[color:var(--vibe-nav-text-strong)]">Vibe-HR</p>
            <p className="text-xs text-[color:var(--vibe-nav-text-muted)]">인사 관리 시스템</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-end px-3">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-6 w-6"
            onClick={() => {
              if (menuExpanded) {
                // 전체 접기: openCodes 비우기
                setOpenCodes(new Set());
              } else {
                // 전체 펼치기: 모든 그룹 code 추가
                const allCodes = new Set<string>();
                function collectAll(nodes: MenuNode[]) {
                  for (const n of nodes) {
                    if (n.children.length > 0) {
                      allCodes.add(n.code);
                      collectAll(n.children);
                    }
                  }
                }
                collectAll(menus);
                setOpenCodes(allCodes);
              }
              setMenuExpanded((prev) => !prev);
            }}
            title={menuExpanded ? "메뉴 전체 접기" : "메뉴 전체 펼치기"}
            aria-label={menuExpanded ? "메뉴 전체 접기" : "메뉴 전체 펼치기"}
          >
            {menuExpanded ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>

        <nav
          ref={restoreMenuScroll}
          onScroll={handleMenuScroll}
          className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-3"
        >
          {menus.map((node) =>
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

      <div className="shrink-0 border-t border-gray-200 bg-[var(--vibe-sidebar-bg)] p-3">
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

  return (
    <>
      <button
        type="button"
        className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-lg lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
      >
        <PanelLeft className="h-4 w-4" aria-hidden="true" />
        메뉴
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-gray-200 bg-[var(--vibe-sidebar-bg)]">
            <div className="flex justify-end p-3">
              <button
                type="button"
                className="rounded-md border bg-white p-2"
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      {profileOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="프로필 닫기"
            onClick={() => setProfileOpen(false)}
          />
          <div className="relative z-10 w-full max-w-5xl rounded-3xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border border-border">
                  <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-2xl font-bold tracking-tight text-[color:var(--vibe-nav-text-strong)]">내 정보</p>
                  <p className="mt-1 text-sm text-[color:var(--vibe-nav-text-muted)]">조회 전용 프로필 정보입니다.</p>
                  <p className="mt-1 text-xs text-[color:var(--vibe-nav-text-muted)]">
                    최근 조회: {profileLoadedAt ? formatProfileDateTime(profileLoadedAt) : "-"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border p-2 text-[color:var(--vibe-nav-text-muted)] hover:bg-accent hover:text-[color:var(--vibe-nav-text-strong)]"
                onClick={() => setProfileOpen(false)}
                aria-label="프로필 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileLoading ? <p className="mb-4 text-sm text-[color:var(--vibe-nav-text-muted)]">불러오는 중...</p> : null}
            {profileError ? <p className="mb-4 text-sm text-red-500">{profileError}</p> : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {profileRows.map((row) => {
                const Icon = row.icon;
                const displayValue = row.value || "-";
                return (
                  <article
                    key={row.label}
                    className={`rounded-2xl border p-4 transition hover:shadow-sm ${getProfileToneCardClass(row.tone)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold tracking-wide text-[color:var(--vibe-nav-text-muted)]">{row.label}</p>
                        <p
                          className={`mt-2 break-words text-sm font-semibold text-[color:var(--vibe-nav-text-strong)] ${
                            row.mono ? "font-mono" : ""
                          }`}
                        >
                          {displayValue}
                        </p>
                      </div>
                      <span
                        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${getProfileToneIconClass(row.tone)}`}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-[var(--vibe-sidebar-bg)] lg:flex lg:flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
