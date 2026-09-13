"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { MenuNode } from "@/types/menu";

export function WorkspaceNavigator({ tabs }: { tabs: { path: string; label: string }[] }) {
  const { menus } = useMenu();
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyTabs, setOnlyTabs] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  const storageKey = `vibe_hr_menu_pins:${user?.id ?? "anonymous"}`;
  const [pins, setPins] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); return Array.isArray(stored) ? stored.filter((p): p is string => typeof p === "string") : []; }
    catch { return []; }
  });
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); } };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);
  const destinations = useMemo(() => {
    const found = new Map<string, { path: string; label: string; group: string }>();
    function collect(nodes: MenuNode[], group: string) { for (const node of nodes) { if (node.path) found.set(node.path, { path: node.path, label: node.name, group }); collect(node.children, group ? `${group} / ${node.name}` : node.name); } }
    collect(menus, "");
    return [...found.values()];
  }, [menus]);
  const results = destinations.filter((item) => (!onlyTabs || tabs.some((tab) => tab.path === item.path)) && `${item.label} ${item.group}`.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => Number(pins.includes(b.path)) - Number(pins.includes(a.path)));
  function pin(path: string) { const next = pins.includes(path) ? pins.filter((item) => item !== path) : [...pins, path]; setPins(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Session pins remain available. */ } }
  function navigate(path: string) { setOpen(false); setQuery(""); router.push(path); }
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm" aria-label="빠른 이동"><Search className="h-4 w-4" /><span className="hidden md:inline">빠른 이동</span><kbd className="hidden text-xs text-muted-foreground lg:inline">Ctrl K</kbd></Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>빠른 이동</DialogTitle><DialogDescription>메뉴와 열린 탭을 검색하고 자주 쓰는 메뉴를 고정하세요.</DialogDescription></DialogHeader>
      <div className="space-y-3 px-6 pb-4">
        <Input aria-label="메뉴 또는 열린 탭 검색" placeholder="메뉴 또는 열린 탭 검색" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.nativeEvent.isComposing) return; if (event.key === "Enter" && results[0]) { event.preventDefault(); navigate(results[0].path); } if (event.key === "ArrowDown") { event.preventDefault(); listRef.current?.querySelector<HTMLButtonElement>("[data-destination]")?.focus(); } }} />
        <div className="flex gap-2"><Button size="sm" variant={onlyTabs ? "outline" : "secondary"} aria-pressed={!onlyTabs} onClick={() => setOnlyTabs(false)}>전체 메뉴</Button><Button size="sm" variant={onlyTabs ? "secondary" : "outline"} aria-pressed={onlyTabs} onClick={() => setOnlyTabs(true)}>열린 탭</Button></div>
        <ul ref={listRef} className="max-h-80 space-y-1 overflow-y-auto" aria-label="이동할 메뉴" onKeyDown={(event) => { if (!["ArrowDown", "ArrowUp"].includes(event.key)) return; event.preventDefault(); const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-destination]") ?? []); const index = buttons.indexOf(event.target as HTMLButtonElement); buttons[Math.max(0, Math.min(buttons.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))]?.focus(); }}>{results.map((item) => <li key={item.path} className="flex items-center gap-2 rounded-lg hover:bg-accent">
          <button data-destination={item.path} className="min-w-0 flex-1 rounded-lg px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-ring" onClick={() => navigate(item.path)}><span className="block text-sm font-medium">{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.group || "홈"}{tabs.some((tab) => tab.path === item.path) ? " / 열려 있음" : ""}</span></button>
          <Button variant="ghost" size="icon" aria-label={`${item.label} 고정`} aria-pressed={pins.includes(item.path)} onClick={() => pin(item.path)}><Star className={`h-4 w-4 ${pins.includes(item.path) ? "fill-primary text-primary" : ""}`} /></Button>
        </li>)}</ul>
        {!results.length && <p role="status" className="py-6 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
