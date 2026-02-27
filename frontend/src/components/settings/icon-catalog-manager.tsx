"use client";

import {
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarCheck2,
  CalendarDays,
  Clock,
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
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MENU_ICON_OPTIONS } from "@/lib/menu-icon-options";

const ICONS: Record<string, LucideIcon> = {
  Briefcase: BriefcaseBusiness,
  Building: Building2,
  Building2,
  Calculator,
  CalendarCheck: CalendarCheck2,
  CalendarCheck2,
  CalendarDays,
  Clock,
  Code: BriefcaseBusiness,
  FileText,
  FolderKanban: FolderTree,
  FolderTree,
  LayoutDashboard,
  ListOrdered,
  ListPlus: ListOrdered,
  Menu,
  MessageSquare: Mail,
  PanelLeft,
  Server: Settings,
  Settings,
  Shield,
  UserCheck: UsersRound,
  UserPlus: UserRound,
  UserRound,
  Users: UsersRound,
  UsersRound,
  Wallet,
};

export function IconCatalogManager() {
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MENU_ICON_OPTIONS;
    return MENU_ICON_OPTIONS.filter((name) => name.toLowerCase().includes(q));
  }, [query]);

  async function handleCopy(name: string) {
    try {
      await navigator.clipboard.writeText(name);
      toast.success(`${name} 복사 완료`);
    } catch {
      toast.error("클립보드 복사 실패");
    }
  }

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>아이콘 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">클릭하면 아이콘 이름이 복사됩니다. 메뉴관리의 아이콘 필드에 그대로 사용하세요. (예: ListOrdered)</p>
          <Input placeholder="아이콘 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {items.map((name) => {
          const Icon = ICONS[name] ?? LayoutDashboard;
          return (
            <button
              key={name}
              type="button"
              onClick={() => void handleCopy(name)}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border bg-white px-2 py-3 text-center hover:border-primary/40 hover:bg-primary/5"
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="font-mono text-xs">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
