"use client";

import { useEffect, useMemo, useState } from "react";

import type { MenuActionPermissionResponse } from "@/types/menu";

const FALLBACK_ALLOWED_ACTIONS = ["query", "create", "copy", "template_download", "upload", "save", "download"];

export function useMenuActions(path: string) {
  const [allowedActions, setAllowedActions] = useState<string[]>(FALLBACK_ALLOWED_ACTIONS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ path });
        const response = await fetch(`/api/menus/actions/current?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          if (!cancelled) {
            setAllowedActions(FALLBACK_ALLOWED_ACTIONS);
          }
          return;
        }

        const data = (await response.json()) as MenuActionPermissionResponse;
        if (!cancelled) {
          setAllowedActions(data.allowed_actions ?? FALLBACK_ALLOWED_ACTIONS);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [path]);

  const allowedSet = useMemo(() => new Set(allowedActions), [allowedActions]);

  return {
    allowedActions,
    allowedSet,
    loading,
    can: (actionCode: string) => allowedSet.has(actionCode),
  };
}
