"use client";

import {
  Building2,
  Calculator,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  Clock,
  Minus,
  Plus,
  FileText,
  FolderTree,
  LayoutDashboard,
  ListOrdered,
  Menu,
  PanelLeft,
  Settings,
  Shield,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

function MenuLeafItem({ node, isActive }: { node: MenuNode; isActive: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isActive && ref.current) {
      ref.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  if (!node.path) return null;

  return (
    <Link
      ref={ref}
      href={node.path}
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileEmployee, setProfileEmployee] = useState<EmployeeItem | null>(null);

  const displayName = user?.display_name ?? "User";
  const roleLabels = user?.roles?.join(", ") ?? "";
  const initials = getInitials(displayName) || "U";

  const profileRows = useMemo(
    () => [
      { label: "이름", value: displayName },
      { label: "이메일", value: user?.email ?? "-" },
      { label: "권한", value: roleLabels || "-" },
      { label: "로그인ID", value: profileEmployee?.login_id ?? "-" },
      { label: "사번", value: profileEmployee?.employee_no ?? "-" },
      { label: "부서", value: profileEmployee?.department_name ?? "-" },
      { label: "직책", value: profileEmployee?.position_title ?? "-" },
      { label: "입사일", value: profileEmployee?.hire_date ?? "-" },
      {
        label: "재직상태",
        value: profileEmployee ? toEmploymentStatusLabel(profileEmployee.employment_status) : "-",
      },
      {
        label: "로그인 활성",
        value: profileEmployee ? (profileEmployee.is_active ? "Y" : "N") : "-",
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
    } catch (error) {
      setProfileEmployee(null);
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

        <nav className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
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
          <div className="relative z-10 w-full max-w-xl rounded-xl border bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border border-slate-200">
                  <AvatarFallback className="bg-primary/10 text-xl font-semibold text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-semibold text-[color:var(--vibe-nav-text-strong)]">{displayName}</p>
                  <p className="text-sm text-[color:var(--vibe-nav-text-muted)]">{user?.email ?? "-"}</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border p-2 text-[color:var(--vibe-nav-text-muted)] hover:bg-slate-50 hover:text-[color:var(--vibe-nav-text-strong)]"
                onClick={() => setProfileOpen(false)}
                aria-label="프로필 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileLoading ? <p className="mb-4 text-sm text-[color:var(--vibe-nav-text-muted)]">불러오는 중...</p> : null}
            {profileError ? <p className="mb-4 text-sm text-red-500">{profileError}</p> : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {profileRows.map((row) => (
                <div key={row.label} className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-[color:var(--vibe-nav-text-muted)]">{row.label}</p>
                  <p className="mt-1 text-sm font-medium text-[color:var(--vibe-nav-text-strong)]">{row.value}</p>
                </div>
              ))}
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
