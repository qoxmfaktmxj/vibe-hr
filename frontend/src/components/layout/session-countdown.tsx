"use client";

import { useEffect, useMemo, useState } from "react";

function fmt(sec: number): string {
  const clamped = Math.max(0, sec);
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function SessionCountdown() {
  const [remainingSec, setRemainingSec] = useState<number>(0);
  const [visible, setVisible] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function fetchSession() {
      const res = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
      if (!mounted || !res || !res.ok) return;
      const data = (await res.json()) as { authenticated?: boolean; remaining_sec?: number; show_countdown?: boolean };
      if (!data.authenticated) return;
      setVisible(data.show_countdown !== false);
      setRemainingSec(Math.max(0, Number(data.remaining_sec ?? 0)));
    }

    void fetchSession();
    const refreshTimer = window.setInterval(() => {
      void fetchSession();
    }, 30_000);
    const tick = window.setInterval(() => {
      setRemainingSec((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      mounted = false;
      window.clearInterval(refreshTimer);
      window.clearInterval(tick);
    };
  }, []);

  const cls = useMemo(() => {
    if (remainingSec <= 180) return "text-red-600";
    if (remainingSec <= 600) return "text-amber-600";
    return "text-muted-foreground";
  }, [remainingSec]);

  if (!visible) return null;

  return <span className={`text-xs font-medium ${cls}`}>세션 {fmt(remainingSec)}</span>;
}
