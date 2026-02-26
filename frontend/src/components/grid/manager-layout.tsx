"use client";

import type { ClipboardEventHandler, ReactNode, Ref } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ManagerPageShellProps = {
  children: ReactNode;
  className?: string;
  containerRef?: Ref<HTMLDivElement>;
  onPasteCapture?: ClipboardEventHandler<HTMLDivElement>;
};

export function ManagerPageShell({
  children,
  className,
  containerRef,
  onPasteCapture,
}: ManagerPageShellProps) {
  return (
    <div
      className={cn("flex h-[calc(100vh-73px)] flex-col gap-3 px-3 py-3 md:px-6 md:py-4", className)}
      ref={containerRef}
      onPasteCapture={onPasteCapture}
    >
      {children}
    </div>
  );
}

type ManagerSearchSectionProps = {
  title: string;
  children: ReactNode;
  onQuery: () => void;
  queryLabel?: string;
  queryDisabled?: boolean;
  queryButtonClassName?: string;
  className?: string;
};

export function ManagerSearchSection({
  title,
  children,
  onQuery,
  queryLabel = "조회",
  queryDisabled = false,
  queryButtonClassName,
  className,
}: ManagerSearchSectionProps) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardHeader className="px-3 pb-0 pt-4 md:px-6 md:pt-3">
        <CardTitle className="text-xl font-semibold text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 md:px-6 md:pb-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex-1">{children}</div>
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="query"
              onClick={onQuery}
              className={cn("h-8 w-16 px-3", queryButtonClassName)}
              disabled={queryDisabled}
            >
              <Search className="h-3 w-3" />
              {queryLabel}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type ManagerGridSectionProps = {
  headerLeft?: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

export function ManagerGridSection({
  headerLeft,
  headerRight,
  children,
  className,
  headerClassName,
  contentClassName,
}: ManagerGridSectionProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col rounded-xl border bg-white", className)}>
      <div
        className={cn(
          "flex flex-col gap-2 px-3 py-3 md:flex-row md:items-center md:justify-between md:px-6",
          headerClassName,
        )}
      >
        <div className="flex items-center gap-3">{headerLeft}</div>
        <div className="flex flex-wrap items-center gap-1.5">{headerRight}</div>
      </div>
      <div className={cn("min-h-0 flex-1", contentClassName)}>{children}</div>
    </div>
  );
}
