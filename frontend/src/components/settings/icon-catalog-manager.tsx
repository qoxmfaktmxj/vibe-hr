"use client";

import * as LucideIcons from "lucide-react";
import { type ComponentType, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MENU_ICON_OPTIONS } from "@/lib/menu-icon-options";
import { renderMenuIcon } from "@/lib/menu-icon-render";

function isLucideComponentName(name: string): boolean {
  if (!/^[A-Z][A-Za-z0-9]+$/.test(name)) return false;
  const v = (LucideIcons as Record<string, unknown>)[name];
  return typeof v === "function";
}

const ALL_LUCIDE_ICON_NAMES = Object.keys(LucideIcons)
  .filter((name) => isLucideComponentName(name))
  .sort((a, b) => a.localeCompare(b));

export function IconCatalogManager() {
  const [query, setQuery] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const source = advanced ? ALL_LUCIDE_ICON_NAMES : MENU_ICON_OPTIONS;
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return source;
    return source.filter((name) => name.toLowerCase().includes(q));
  }, [query, source]);

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
          <p className="text-sm text-slate-600">
            기본은 엔터프라이즈 화이트리스트 아이콘만 보여줘. 고급검색을 켜면 Lucide 전체 아이콘 탐색이 가능해.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="max-w-md"
              placeholder={advanced ? "Lucide 전체 아이콘 검색" : "화이트리스트 아이콘 검색"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <Button
              type="button"
              variant={advanced ? "action" : "outline"}
              onClick={() => setAdvanced((prev) => !prev)}
            >
              {advanced ? "고급검색 ON" : "고급검색 OFF"}
            </Button>
            <span className="text-xs text-slate-500">{items.length.toLocaleString()}개</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {items.map((name) => {
          const Icon = (LucideIcons as Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>>)[name];
          return (
            <button
              key={name}
              type="button"
              onClick={() => void handleCopy(name)}
              className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border bg-white px-2 py-3 text-center hover:border-primary/40 hover:bg-primary/5"
            >
              {advanced
                ? Icon
                  ? <Icon className="h-5 w-5" aria-hidden="true" />
                  : renderMenuIcon(name, "h-5 w-5")
                : renderMenuIcon(name, "h-5 w-5")}
              <span className="font-mono text-xs">{name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
