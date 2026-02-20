"use client";

import { Loader2, Search, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { ImpersonationCandidate } from "@/types/auth";

type CandidateResponse = {
  users?: ImpersonationCandidate[];
  detail?: string;
};

export function ImpersonationPopover() {
  const router = useRouter();
  const { refreshSession } = useAuth();
  const { refreshMenus } = useMenu();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ImpersonationCandidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const loadUsers = useCallback(async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/auth/impersonation/users?query=${encodeURIComponent(searchQuery)}&limit=30`,
        { cache: "no-store" },
      );
      const json = (await response.json().catch(() => null)) as CandidateResponse | null;
      if (!response.ok) {
        setUsers([]);
        toast.error(json?.detail ?? "전환 대상 목록을 불러오지 못했습니다.");
        return;
      }
      const nextUsers = json?.users ?? [];
      setUsers(nextUsers);
      if (nextUsers.length > 0) {
        setSelectedUserId((prev) => prev ?? nextUsers[0].id);
      } else {
        setSelectedUserId(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      void loadUsers(query);
    }, 180);
    return () => window.clearTimeout(handle);
  }, [loadUsers, open, query]);

  async function impersonate() {
    if (!selectedUserId) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/impersonation/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selectedUserId }),
      });
      const json = (await response.json().catch(() => null)) as { detail?: string } | null;
      if (!response.ok) {
        toast.error(json?.detail ?? "전환 로그인에 실패했습니다.");
        return;
      }

      await refreshSession();
      await refreshMenus();
      setOpen(false);
      toast.success(`${selectedUser?.display_name ?? "선택 사용자"} 계정으로 전환되었습니다.`);
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label="다른 사용자로 로그인" title="다른 사용자로 로그인">
          <UsersRound className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <div className="border-b bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">다른 사용자로 로그인</div>
        <div className="space-y-2 p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="이름/로그인ID 검색"
              className="h-9 pl-7 text-sm"
            />
          </div>

          <div className="max-h-56 overflow-auto rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                불러오는 중...
              </div>
            ) : users.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">검색 결과가 없습니다.</div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className={`w-full border-b px-3 py-2 text-left last:border-b-0 ${
                    selectedUserId === user.id ? "bg-primary/10" : "hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-medium text-slate-800">{user.display_name}</p>
                  <p className="text-xs text-slate-500">{user.login_id}</p>
                </button>
              ))
            )}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="query"
              onClick={impersonate}
              disabled={!selectedUserId || isSubmitting}
            >
              {isSubmitting ? "전환 중..." : "전환"}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
