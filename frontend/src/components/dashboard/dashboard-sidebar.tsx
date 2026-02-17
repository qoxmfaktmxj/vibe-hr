import {
  BarChart3,
  BellRing,
  CalendarCheck2,
  LayoutDashboard,
  Settings,
  Sparkles,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const navigation = [
  { icon: LayoutDashboard, label: "Dashboard", active: true, href: "/dashboard" },
  { icon: UsersRound, label: "Employees", href: "/dashboard" },
  { icon: BellRing, label: "Pulse Surveys", href: "/dashboard" },
  { icon: Sparkles, label: "Recognition", href: "/dashboard" },
  { icon: BarChart3, label: "Reports", href: "/dashboard" },
  { icon: Settings, label: "Settings", href: "/dashboard" },
];

export function DashboardSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-[var(--vibe-sidebar-bg)] lg:flex lg:flex-col">
      <div className="flex items-center gap-3 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white">
          <CalendarCheck2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-bold leading-tight text-gray-900">Vibe-HR</p>
          <p className="text-xs text-[var(--vibe-accent-muted)]">Engagement Suite</p>
        </div>
      </div>

      <nav className="mt-4 flex-1 space-y-1 px-3">
        {navigation.map((item) => (
          <Link
            href={item.href}
            key={item.label}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
              item.active
                ? "bg-primary/10 text-primary"
                : "text-gray-500 hover:bg-white hover:text-gray-800"
            }`}
            aria-current={item.active ? "page" : undefined}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-4">
        <div className="flex items-center gap-3 p-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 font-semibold text-primary">SJ</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-gray-900">Sarah Jenkins</span>
            <span className="text-xs text-[var(--vibe-accent-muted)]">HR Director</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
