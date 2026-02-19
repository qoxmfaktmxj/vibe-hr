"use client";

import {
  Building2,
  Calculator,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  Clock,
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
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
      return "\uD734\uC9C1";
    case "resigned":
      return "\uD1F4\uC0AC";
    default:
      return "\uC7AC\uC9C1";
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
}: {
  node: MenuNode;
  currentPath: string;
  depth?: number;
}) {
  const active = hasActiveDescendant(node, currentPath);
  const [isOpen, setIsOpen] = useState(active);

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
              <MenuGroupItem key={child.code} node={child} currentPath={currentPath} depth={depth + 1} />
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileEmployee, setProfileEmployee] = useState<EmployeeItem | null>(null);

  const displayName = user?.display_name ?? "User";
  const roleLabels = user?.roles?.join(", ") ?? "";
  const initials = getInitials(displayName) || "U";

  const profileRows = useMemo(
    () => [
      { label: "\uC774\uB984", value: displayName },
      { label: "\uC774\uBA54\uC77C", value: user?.email ?? "-" },
      { label: "\uAD8C\uD55C", value: roleLabels || "-" },
      { label: "\uB85C\uADF8\uC778ID", value: profileEmployee?.login_id ?? "-" },
      { label: "\uC0AC\uBC88", value: profileEmployee?.employee_no ?? "-" },
      { label: "\uBD80\uC11C", value: profileEmployee?.department_name ?? "-" },
      { label: "\uC9C1\uCC45", value: profileEmployee?.position_title ?? "-" },
      { label: "\uC785\uC0AC\uC77C", value: profileEmployee?.hire_date ?? "-" },
      {
        label: "\uC7AC\uC9C1\uC0C1\uD0DC",
        value: profileEmployee ? toEmploymentStatusLabel(profileEmployee.employment_status) : "-",
      },
      {
        label: "\uB85C\uADF8\uC778 \uD65C\uC131",
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
        throw new Error(json?.detail ?? "\uD504\uB85C\uD544 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }

      const json = (await response.json()) as { employee?: EmployeeItem };
      setProfileEmployee(json.employee ?? null);
    } catch (error) {
      setProfileEmployee(null);
      setProfileError(
        error instanceof Error
          ? error.message
          : "\uD504\uB85C\uD544 \uC815\uBCF4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
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
      <div className="flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-lg font-bold leading-tight text-gray-900">Vibe-HR</p>
          <p className="text-xs text-[var(--vibe-accent-muted)]">\uC778\uC0AC \uAD00\uB9AC \uC2DC\uC2A4\uD15C</p>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-1 overflow-y-auto px-3">
        {menus.map((node) =>
          node.children.length > 0 ? (
            <MenuGroupItem key={node.code} node={node} currentPath={pathname} />
          ) : (
            <MenuLeafItem
              key={node.code}
              node={node}
              isActive={node.path ? pathname.startsWith(node.path) : false}
            />
          ),
        )}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white"
          onClick={openProfile}
        >
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">{displayName}</span>
            <span className="text-xs text-[var(--vibe-accent-muted)]">{roleLabels || "-"}</span>
            <span className="text-[11px] text-[var(--vibe-accent-muted)]">\uB0B4 \uC815\uBCF4 \uBCF4\uAE30</span>
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
        aria-label="\uBA54\uB274 \uC5F4\uAE30"
      >
        <PanelLeft className="h-4 w-4" aria-hidden="true" />
        \uBA54\uB274
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="\uBA54\uB274 \uB2EB\uAE30" />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-gray-200 bg-[var(--vibe-sidebar-bg)]">
            <div className="flex justify-end p-3">
              <button
                type="button"
                className="rounded-md border bg-white p-2"
                onClick={() => setMobileOpen(false)}
                aria-label="\uBA54\uB274 \uB2EB\uAE30"
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
            aria-label="\uD504\uB85C\uD544 \uB2EB\uAE30"
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
                aria-label="\uD504\uB85C\uD544 \uB2EB\uAE30"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {profileLoading ? <p className="mb-4 text-sm text-slate-500">\uBD88\uB7EC\uC624\uB294 \uC911...</p> : null}
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
