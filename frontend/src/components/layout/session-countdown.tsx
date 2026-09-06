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
  const [ready, setReady] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const expiredRef = useRef(false);
  // 서버에서 최초 응답을 받기 전에는 tick이 0 → 만료 처리하지 않도록 방어
  const initializedRef = useRef(false);
  const sessionRequestRef = useRef(0);
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
      const requestId = ++sessionRequestRef.current;
      const res = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
      if (!mounted || requestId !== sessionRequestRef.current) return;
      if (!res?.ok) {
        setSessionError("로그인 시간을 확인하지 못했습니다. 다시 확인을 눌러 재시도해 주세요.");
        return;
      }
      const data = (await res.json().catch(() => null)) as {
        authenticated?: boolean;
        remaining_sec?: number;
        show_countdown?: boolean;
      } | null;
      if (!mounted || requestId !== sessionRequestRef.current) return;
      if (!data || typeof data.authenticated !== "boolean") {
        setSessionError("로그인 시간을 확인하지 못했습니다. 다시 확인을 눌러 재시도해 주세요.");
        return;
      }

      // 서버에서 이미 인증 해제 → 자동 로그아웃
      if (!data.authenticated) {
        void handleExpire();
        return;
      }

      const sec = data.remaining_sec;
      if (typeof sec !== "number" || !Number.isFinite(sec) || sec < 0) {
        setSessionError("로그인 시간을 확인하지 못했습니다. 다시 확인을 눌러 재시도해 주세요.");
        return;
      }
      setSessionError(null);
      setVisible(data.show_countdown !== false);
      setRemainingSec(sec);
      setReady(true);
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
    setRefreshError(null);
    try {
      if (!ready || sessionError) {
        await fetchSessionRef.current?.();
        return;
      }
      const response = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" }).catch(() => null);
      if (!response?.ok) {
        setRefreshError("로그인 시간을 연장하지 못했습니다. 다시 눌러 시도해 주세요.");
        return;
      }
      // A successful renewal replaces the cookie. The old countdown is no longer authoritative.
      sessionRequestRef.current += 1;
      initializedRef.current = false;
      setReady(false);
      await fetchSessionRef.current?.();
    } finally {
      setRefreshing(false);
    }
  }, [ready, refreshing, sessionError]);

  const { pillCls } = useMemo(() => {
    if (ready && remainingSec <= 180) {
      return {
        pillCls:
          "border-red-400/70 bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      };
    }
    if (ready && remainingSec <= 600) {
      return {
        pillCls:
          "border-amber-400/60 bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      };
    }
    return {
      pillCls: "border-border bg-muted/40 text-muted-foreground",
    };
  }, [ready, remainingSec]);

  if (!visible) return null;
  const warning = ready && remainingSec <= 180
    ? "3분 안에 로그인이 종료됩니다. 작업을 저장하거나 로그인 시간을 연장해 주세요."
    : ready && remainingSec <= 600
      ? "10분 안에 로그인이 종료됩니다. 필요하면 로그인 시간을 연장해 주세요."
      : "";

  return (
    <div className="relative">
    <button
      type="button"
      onClick={() => { void handleClick(); }}
      disabled={refreshing || (!ready && !sessionError)}
      className={`flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 ${pillCls}`}
      title={sessionError || warning || "로그인 시간 연장"}
      aria-label={sessionError ? "로그인 시간 다시 확인" : ready ? `로그인 시간 연장. 남은 시간 ${fmt(remainingSec)}` : "로그인 시간 확인 중"}
    >
      <Timer
        className={`h-3.5 w-3.5 shrink-0 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
        aria-hidden="true"
      />
      <span className="tabular-nums">{ready ? fmt(remainingSec) : "--:--"}</span>
      <span>{refreshing ? "처리 중" : sessionError ? "다시 확인" : warning ? "지금 연장" : "연장"}</span>
    </button>
    <span role="status" className="sr-only">{warning}</span>
    {refreshError || sessionError ? <p role="alert" className="absolute right-0 top-full z-50 mt-2 w-60 rounded-lg border border-border bg-card p-3 text-xs leading-5 text-destructive shadow-lg">{refreshError || sessionError}</p> : null}
    </div>
  );
}
