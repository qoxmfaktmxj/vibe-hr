import {
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CalendarCheck2,
  CalendarDays,
  Clock,
  Code,
  Database,
  FileText,
  FolderTree,
  Home,
  IdCard,
  KeyRound,
  Landmark,
  LayoutDashboard,
  ListOrdered,
  ListTodo,
  Mail,
  Menu,
  MessageSquare,
  PanelLeft,
  Receipt,
  Search,
  Server,
  Settings,
  Shield,
  Network,
  UserCheck,
  UserPlus,
  UserRound,
  UsersRound,
  Wallet,
} from "lucide-react";

import { normalizeMenuIconName } from "@/lib/menu-icon-options";

export function renderMenuIcon(iconName: string | null | undefined, className: string) {
  const normalized = normalizeMenuIconName(iconName) ?? "LayoutDashboard";

  switch (normalized) {
    case "Home":
      return <Home className={className} aria-hidden="true" />;
    case "PanelLeft":
      return <PanelLeft className={className} aria-hidden="true" />;
    case "Menu":
      return <Menu className={className} aria-hidden="true" />;
    case "UsersRound":
      return <UsersRound className={className} aria-hidden="true" />;
    case "UserRound":
      return <UserRound className={className} aria-hidden="true" />;
    case "UserCheck":
      return <UserCheck className={className} aria-hidden="true" />;
    case "UserPlus":
      return <UserPlus className={className} aria-hidden="true" />;
    case "IdCard":
      return <IdCard className={className} aria-hidden="true" />;
    case "Building2":
      return <Building2 className={className} aria-hidden="true" />;
    case "FolderTree":
      return <FolderTree className={className} aria-hidden="true" />;
    case "Network":
      return <Network className={className} aria-hidden="true" />;
    case "CalendarCheck2":
      return <CalendarCheck2 className={className} aria-hidden="true" />;
    case "CalendarDays":
      return <CalendarDays className={className} aria-hidden="true" />;
    case "Clock":
      return <Clock className={className} aria-hidden="true" />;
    case "BadgeCheck":
      return <BadgeCheck className={className} aria-hidden="true" />;
    case "FileText":
      return <FileText className={className} aria-hidden="true" />;
    case "BriefcaseBusiness":
      return <BriefcaseBusiness className={className} aria-hidden="true" />;
    case "Wallet":
      return <Wallet className={className} aria-hidden="true" />;
    case "Calculator":
      return <Calculator className={className} aria-hidden="true" />;
    case "Receipt":
      return <Receipt className={className} aria-hidden="true" />;
    case "Landmark":
      return <Landmark className={className} aria-hidden="true" />;
    case "Settings":
      return <Settings className={className} aria-hidden="true" />;
    case "Shield":
      return <Shield className={className} aria-hidden="true" />;
    case "Server":
      return <Server className={className} aria-hidden="true" />;
    case "Database":
      return <Database className={className} aria-hidden="true" />;
    case "KeyRound":
      return <KeyRound className={className} aria-hidden="true" />;
    case "ListOrdered":
      return <ListOrdered className={className} aria-hidden="true" />;
    case "ListTodo":
      return <ListTodo className={className} aria-hidden="true" />;
    case "Search":
      return <Search className={className} aria-hidden="true" />;
    case "Bell":
      return <Bell className={className} aria-hidden="true" />;
    case "Mail":
      return <Mail className={className} aria-hidden="true" />;
    case "MessageSquare":
      return <MessageSquare className={className} aria-hidden="true" />;
    case "Code":
      return <Code className={className} aria-hidden="true" />;
    default:
      return <LayoutDashboard className={className} aria-hidden="true" />;
  }
}
