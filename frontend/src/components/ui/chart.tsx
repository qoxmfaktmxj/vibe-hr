"use client";

import * as React from "react";
import { Tooltip } from "recharts";

import { cn } from "@/lib/utils";

export type ChartConfig = Record<
  string,
  {
    label?: string;
    color?: string;
  }
>;

type ChartContextValue = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextValue | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer.");
  }
  return context;
}

export function ChartContainer({
  config,
  className,
  children,
}: {
  config: ChartConfig;
  className?: string;
  children: React.ReactNode;
}) {
  const style = React.useMemo(() => {
    const cssVars: Record<string, string> = {};
    for (const [key, value] of Object.entries(config)) {
      if (value.color) cssVars[`--color-${key}`] = value.color;
    }
    return cssVars as React.CSSProperties;
  }, [config]);

  return (
    <ChartContext.Provider value={{ config }}>
      <div className={cn("h-full w-full", className)} style={style}>
        {children}
      </div>
    </ChartContext.Provider>
  );
}

export const ChartTooltip = Tooltip;

type ChartTooltipContentProps = React.ComponentProps<"div"> & {
  active?: boolean;
  payload?: Array<{
    dataKey?: string | number;
    name?: string;
    color?: string;
    value?: string | number | null;
  }>;
  label?: string | number;
  hideLabel?: boolean;
};

export function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
}: ChartTooltipContentProps) {
  const { config } = useChart();

  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className={cn("rounded-md border bg-background px-3 py-2 text-xs shadow", className)}>
      {!hideLabel ? <p className="mb-1 font-medium">{label}</p> : null}
      <div className="space-y-1">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? "value");
          const conf = config[key];
          const color = item.color ?? conf?.color ?? "hsl(var(--primary))";
          const value = typeof item.value === "number" ? item.value.toLocaleString() : String(item.value ?? "-");
          return (
            <div key={`${key}-${value}`} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
                {conf?.label ?? item.name ?? key}
              </span>
              <span className="font-medium text-foreground">{value}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
