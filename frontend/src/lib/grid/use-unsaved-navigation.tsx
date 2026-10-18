"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const EVENT = "vibehr:before-navigation";
type NavigationCheck = { blocked: boolean; dirty: boolean; confirm: (proceed: () => void) => void };

export function requestWorkspaceNavigation(proceed: () => void) {
  const checks: NavigationCheck[] = [];
  window.dispatchEvent(new CustomEvent(EVENT, { detail: checks }));
  if (checks.some(check => check.blocked)) return;
  const dirty = checks.find(check => check.dirty);
  if (dirty) dirty.confirm(proceed);
  else proceed();
}

export function useUnsavedNavigation(isDirty: () => boolean, blocked: () => boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const requestLeave = useCallback((proceed: () => void) => {
    if (blocked()) return;
    if (isDirty()) setPending(() => proceed);
    else proceed();
  }, [blocked, isDirty]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (blocked() || isDirty()) event.preventDefault(); };
    const navigate = (event: Event) => {
      (event as CustomEvent<NavigationCheck[]>).detail.push({ blocked: blocked(), dirty: isDirty(), confirm: proceed => setPending(() => proceed) });
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin !== location.origin || url.pathname + url.search === location.pathname + location.search) return;
      event.preventDefault(); event.stopPropagation();
      requestWorkspaceNavigation(() => router.push(url.pathname + url.search + url.hash));
    };
    window.addEventListener(EVENT, navigate);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    return () => { window.removeEventListener(EVENT, navigate); window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", click, true); };
  }, [blocked, isDirty, requestLeave, router]);
  const dialog = <ConfirmDialog open={pending !== null} onOpenChange={open => { if (!open) setPending(null); }} title="저장되지 않은 변경 사항이 있습니다." description="현재 변경 내용을 저장하지 않고 이동하면 수정 내용이 사라집니다. 계속 진행하시겠습니까?" confirmLabel="무시하고 이동" cancelLabel="취소" onConfirm={() => { const action = pending; setPending(null); action?.(); }} />;
  return { requestLeave, dialog };
}
