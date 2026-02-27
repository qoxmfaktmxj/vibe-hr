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
  if (!node.path) return null;

  return (
    <Link
      href={node.path}
      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive ? "bg-primary/10 text-primary" : "text-gray-500 hover:bg-white hover:text-gray-800"
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

function MenuGroupItem({
  node,
  currentPath,
  depth = 0,
  menuControlVersion,
  menuControlMode,
}: {
  node: MenuNode;
  currentPath: string;
  depth?: number;
  menuControlVersion: number;
  menuControlMode: "expand" | "collapse" | null;
}) {
  const active = hasActiveDescendant(node, currentPath);
  const [isOpen, setIsOpen] = useState(
    menuControlMode === "expand" ? true : menuControlMode === "collapse" ? false : active,
  );

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
          active ? "text-primary" : "text-gray-500 hover:bg-white hover:text-gray-800"
        }`}
        style={{ paddingLeft: `${16 + depth * 12}px` }}
      >
        {renderIcon(node.icon, "h-4 w-4")}
        <span className="flex-1 text-left">{node.name}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className={`mt-0.5 space-y-0.5 ${depth >= 0 ? "ml-4 border-l border-gray-200 pl-3" : ""}`}>
          {node.children.map((child) =>
            child.children.length > 0 ? (
              <MenuGroupItem
                key={`${child.code}-${menuControlVersion}`}
                node={child}
                currentPath={currentPath}
                depth={depth + 1}
                menuControlVersion={menuControlVersion}
                menuControlMode={menuControlMode}
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
  const [menuControlVersion, setMenuControlVersion] = useState(0);
  const [menuControlMode, setMenuControlMode] = useState<"expand" | "collapse" | null>(null);

  // pathname이 바뀌면(메뉴 클릭 후 이동) menuControlMode를 null로 리셋
  // → 이전에 전체 접기/펼치기를 눌렀더라도 개별 열림 상태가 active 기준으로 복원됨
  // pathname이 바뀌면(메뉴 클릭 후 이동) menuControlMode를 null로 리셋하고
  // version을 올려 MenuGroupItem을 리마운트 → active 기준으로 열림 상태 재계산
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname;
      setMenuControlMode(null);
      setMenuControlVersion((v) => v + 1);
    }
  }, [pathname]);
  const [menuExpanded, setMenuExpanded] = useState(true);
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
            <p className="text-lg font-bold leading-tight text-gray-900">Vibe-HR</p>
            <p className="text-xs text-[var(--vibe-accent-muted)]">인사 관리 시스템</p>
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
                setMenuControlMode("collapse");
              } else {
                setMenuControlMode("expand");
              }
              setMenuControlVersion((prev) => prev + 1);
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
                key={`${node.code}-${menuControlVersion}`}
                node={node}
                currentPath={pathname}
                menuControlVersion={menuControlVersion}
                menuControlMode={menuControlMode}
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
            <span className="text-sm font-semibold text-gray-900">{displayName}</span>
            <span className="text-xs text-[var(--vibe-accent-muted)]">내 정보 보기</span>
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
                  <p className="text-lg font-semibold text-gray-900">{displayName}</p>
                  <p className="text-sm text-slate-500">{user?.email ?? "-"}</p>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md border p-2 text-slate-500 hover:bg-slate-50"
                onClick={() => setProfileOpen(false)}
                aria-label="프로필 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileLoading ? <p className="mb-4 text-sm text-slate-500">불러오는 중...</p> : null}
            {profileError ? <p className="mb-4 text-sm text-red-500">{profileError}</p> : null}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {profileRows.map((row) => (
                <div key={row.label} className="rounded-md border bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">{row.label}</p>
                  <p className="mt-1 text-sm font-medium text-slate-800">{row.value}</p>
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
