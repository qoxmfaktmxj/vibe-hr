"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export type GridToolbarAction = {
  key: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  variant?: "outline" | "save";
};

type GridToolbarActionsProps = {
  actions: GridToolbarAction[];
  saveAction?: GridToolbarAction;
};

export function GridToolbarActions({ actions, saveAction }: GridToolbarActionsProps) {
  const orderedActions = [...actions];
  if (saveAction) {
    const downloadIndex = orderedActions.findIndex((action) => action.key === "download");
    orderedActions.splice(downloadIndex < 0 ? orderedActions.length : downloadIndex, 0, { ...saveAction, variant: saveAction.variant ?? "save" });
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {orderedActions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.key}
            size="sm"
            variant={action.variant ?? "outline"}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {action.label}
          </Button>
        );
      })}
    </div>
  );
}
