import * as LucideIcons from "lucide-react";
import { type ElementType } from "react";

import { normalizeMenuIconName } from "@/lib/menu-icon-options";

/**
 * 아이콘 이름을 받아 Lucide React 컴포넌트를 렌더링합니다.
 * normalizeMenuIconName을 통과한 PascalCase 이름이면 모든 Lucide 아이콘을 지원합니다.
 * 매칭되지 않으면 LayoutDashboard를 기본값으로 렌더링합니다.
 */
export function renderMenuIcon(iconName: string | null | undefined, className: string) {
  const name = normalizeMenuIconName(iconName) ?? "LayoutDashboard";
  const iconEntry = (LucideIcons as unknown as Record<string, unknown>)[name];

  if (iconEntry != null && (typeof iconEntry === "function" || typeof iconEntry === "object")) {
    const Icon = iconEntry as ElementType;
    return <Icon className={className} aria-hidden="true" />;
  }

  // fallback
  return <LucideIcons.LayoutDashboard className={className} aria-hidden="true" />;
}
