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
  "Sitemap",

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
  return MENU_ICON_SET.has(aliased as (typeof MENU_ICON_OPTIONS)[number]) ? aliased : null;
}
