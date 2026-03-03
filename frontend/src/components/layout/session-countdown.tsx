"use client";

import { Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function fmt(sec: number): string {
  const clamped = Math.max(0, sec);
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SessionCountdown() {
  const router = useRouter();
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState(false);
  const expiredRef = useRef(false);
  // 서버에서 최초 응답을 받기 전에는 tick이 0 → 만료 처리하지 않도록 방어
  const initializedRef = useRef(false);
  // 클릭 핸들러에서 fetchSession을 호출할 수 있도록 ref로 노출
  const fetchSessionRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    let mounted = true;

    async function handleExpire() {
      if (expiredRef.current) return;
      expiredRef.current = true;
      await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
      if (mounted) router.replace("/login");
    }

    async function fetchSession() {
      const res = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
      if (!mounted || !res || !res.ok) return;
      const data = (await res.json()) as {
        authenticated?: boolean;
        remaining_sec?: number;
        show_countdown?: boolean;
      };

      // 서버에서 이미 인증 해제 → 자동 로그아웃
      if (!data.authenticated) {
        void handleExpire();
        return;
      }

      const sec = Math.max(0, Number(data.remaining_sec ?? 0));
      setVisible(data.show_countdown !== false);
      setRemainingSec(sec);
      // 최초 서버 응답 수신 완료 → 이제부터 tick의 만료 처리 허용
      initializedRef.current = true;
      // 서버가 이미 0초라고 응답한 경우 즉시 만료 처리
      if (sec === 0) void handleExpire();
    }

    fetchSessionRef.current = fetchSession;

    void fetchSession();
    const refreshTimer = window.setInterval(() => {
      void fetchSession();
    }, 30_000);

    const tick = window.setInterval(() => {
      setRemainingSec((prev) => {
        const next = Math.max(0, prev - 1);
        // 초기화 완료 후 + 실제로 카운터가 줄어 0에 도달했을 때만 만료 처리
        if (initializedRef.current && prev > 0 && next === 0) void handleExpire();
        return next;
      });
    }, 1000);

    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(tick);
    };
  }, [router]);

  // 클릭 시 토큰 강제 갱신 후 카운트다운 동기화
  const handleClick = useCallback(async () => {
    if (refreshing || expiredRef.current) return;
    setRefreshing(true);
    try {
      await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" }).catch(() => null);
      await fetchSessionRef.current?.();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  const { pillCls } = useMemo(() => {
    if (remainingSec <= 180) {
      return {
        pillCls:
          "border-red-400/70 bg-red-50 text-red-600 animate-pulse dark:bg-red-900/30 dark:text-red-400",
      };
    }
    if (remainingSec <= 600) {
      return {
        pillCls:
          "border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      };
    }
    return {
      pillCls: "border-border bg-muted/40 text-muted-foreground",
    };
  }, [remainingSec]);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => { void handleClick(); }}
      disabled={refreshing}
      className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-all hover:brightness-95 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${pillCls}`}
      title="클릭하여 세션 시간 초기화"
      aria-label={`세션 남은 시간 ${fmt(remainingSec)}. 클릭하면 초기화됩니다.`}
    >
      <Timer
        className={`h-3.5 w-3.5 shrink-0 ${refreshing ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      <span>{fmt(remainingSec)}</span>
    </button>
  );
}
