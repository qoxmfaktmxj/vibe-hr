"use client";

import { useCallback, useState } from "react";

const STORAGE_KEY = "vibe-sidebar-collapsed";

export function useSidebarCollapsed() {
  // lazy initializer로 localStorage 초기값 복원
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    localStorage.setItem(STORAGE_KEY, String(value));
  }, []);

  return { collapsed, toggle, setCollapsed };
}
