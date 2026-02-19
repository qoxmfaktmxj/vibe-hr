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
    case "Settings":
      return <Settings className={className} aria-hidden="true" />;
    case "Shield":
      return <Shield className={className} aria-hidden="true" />;
    case "Menu":
      return <Menu className={className} aria-hidden="true" />;
    case "PanelLeft":
      return <PanelLeft className={className} aria-hidden="true" />;
    default:
      return <LayoutDashboard className={className} aria-hidden="true" />;
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
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
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
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

  const displayName = user?.display_name ?? "User";
  const roleLabels = user?.roles?.join(", ") ?? "";
  const initials = getInitials(displayName);

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <CalendarCheck2 className="h-5 w-5" aria-hidden="true" />
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
          ),
        )}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 p-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">{initials}</AvatarFallback>
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
        aria-label="Open menu"
      >
        <PanelLeft className="h-4 w-4" aria-hidden="true" />
        Menu
      </button>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu backdrop"
          />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-gray-200 bg-[var(--vibe-sidebar-bg)]">
            <div className="flex justify-end p-3">
              <button
                type="button"
                className="rounded-md border bg-white p-2"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X className="h-4 w-4" aria-hidden="true" />
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
