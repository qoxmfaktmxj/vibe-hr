"use client";

import {
  Calculator,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  Clock,
  FileText,
  LayoutDashboard,
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
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { MenuNode } from "@/types/menu";

/** 아이콘 이름 → lucide-react 컴포넌트 매핑 */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  UsersRound,
  UserRound,
  Clock,
  CalendarCheck2,
  CalendarDays,
  Wallet,
  Calculator,
  FileText,
  Settings,
  Shield,
  Menu: Menu,
  PanelLeft,
};

function getIcon(iconName: string | null) {
  if (!iconName) return LayoutDashboard;
  return ICON_MAP[iconName] ?? LayoutDashboard;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** 단일 메뉴 아이템 (리프 노드) */
function MenuLeafItem({ node, isActive }: { node: MenuNode; isActive: boolean }) {
  const Icon = getIcon(node.icon);

  if (!node.path) return null;

  return (
    <Link
      href={node.path}
      className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
        isActive
          ? "bg-primary/10 text-primary"
          : "text-gray-500 hover:bg-white hover:text-gray-800"
      }`}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {node.name}
    </Link>
  );
}

function hasActiveDescendant(node: MenuNode, currentPath: string): boolean {
  if (node.path && currentPath.startsWith(node.path)) return true;
  return node.children.some((child) => hasActiveDescendant(child, currentPath));
}

/** 자식이 있는 그룹 메뉴 (접을 수 있는 섹션) */
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
  const Icon = getIcon(node.icon);

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
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="flex-1 text-left">{node.name}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
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
            )
          )}
        </div>
      )}
    </div>
  );
}

export function DashboardSidebar() {
  const { user } = useAuth();
  const { menus } = useMenu();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = user?.display_name ?? "User";
  const roleLabels = user?.roles?.join(", ") ?? "";
  const initials = getInitials(displayName);

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <CalendarCheck2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold leading-tight text-gray-900">Vibe-HR</p>
          <p className="text-xs text-[var(--vibe-accent-muted)]">Engagement Suite</p>
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
          )
        )}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 p-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">{displayName}</span>
            <span className="text-xs text-[var(--vibe-accent-muted)]">{roleLabels}</span>
          </div>
        </div>
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
        <PanelLeft className="h-4 w-4" />
        메뉴
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-gray-200 bg-[var(--vibe-sidebar-bg)]">
            <div className="flex justify-end p-3">
              <button
                type="button"
                className="rounded-md border bg-white p-2"
                onClick={() => setMobileOpen(false)}
                aria-label="메뉴 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      ) : null}

      <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-[var(--vibe-sidebar-bg)] lg:flex lg:flex-col">
        {sidebarContent}
      </aside>
    </>
  );
}
