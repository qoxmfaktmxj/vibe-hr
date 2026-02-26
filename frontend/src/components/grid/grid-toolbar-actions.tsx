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
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {actions.map((action) => {
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
      {saveAction ? (
        <>
          <div className="mx-1 h-6 w-px bg-gray-200" />
          <Button
            size="sm"
            variant={saveAction.variant ?? "save"}
            onClick={saveAction.onClick}
            disabled={saveAction.disabled}
          >
            {saveAction.icon ? <saveAction.icon className="h-3.5 w-3.5" /> : null}
            {saveAction.label}
          </Button>
        </>
      ) : null}
    </div>
  );
}
