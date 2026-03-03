export const MENU_ICON_OPTIONS = [
  // Dashboard / navigation
  "LayoutDashboard",
  "Home",
  "PanelLeft",
  "Menu",

  // Org / people
  "UsersRound",
  "UserRound",
  "UserCheck",
  "UserPlus",
  "IdCard",
  "Building2",
  "FolderTree",
  "Network",

  // HR / attendance
  "CalendarCheck2",
  "CalendarDays",
  "Clock",
  "BadgeCheck",
  "FileText",
  "BriefcaseBusiness",

  // Payroll / finance
  "Wallet",
  "Calculator",
  "Receipt",
  "Landmark",

  // Settings / security / system
  "Settings",
  "Shield",
  "Server",
  "Database",
  "KeyRound",

  // Utility / management
  "ListOrdered",
  "ListTodo",
  "Search",
  "Bell",
  "Mail",
  "MessageSquare",
  "Code",
] as const;

export const MENU_ICON_ALIASES: Record<string, string> = {
  Users: "UsersRound",
  User: "UserRound",
  Building: "Building2",
  CalendarCheck: "CalendarCheck2",
  Briefcase: "BriefcaseBusiness",
  ListPlus: "ListTodo",
  FolderKanban: "FolderTree",
};

const MENU_ICON_SET = new Set(MENU_ICON_OPTIONS);

export function normalizeMenuIconName(value?: string | null): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const aliased = MENU_ICON_ALIASES[raw] ?? raw;
  // 사전 승인된 아이콘 목록에 있으면 반환
  if (MENU_ICON_SET.has(aliased as (typeof MENU_ICON_OPTIONS)[number])) return aliased;
  // PascalCase 형식의 Lucide 아이콘 이름이면 허용 (동적 렌더링 지원)
  if (/^[A-Z][A-Za-z0-9]+$/.test(aliased)) return aliased;
  return null;
}
