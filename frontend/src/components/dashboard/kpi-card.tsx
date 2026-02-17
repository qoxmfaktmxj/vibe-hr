import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

type KpiCardProps = {
  title: string;
  value: string;
  trend: string;
  trendColor: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
};

export function KpiCard({
  title,
  value,
  trend,
  trendColor,
  icon: Icon,
  iconBg,
  iconColor,
}: KpiCardProps) {
  return (
    <Card className="border-gray-100 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <span className="text-sm font-medium text-[var(--vibe-accent-muted)]">{title}</span>
        <span className={`rounded-lg p-2 ${iconBg} ${iconColor}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end gap-2">
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          <span className={`mb-1 text-sm font-medium ${trendColor}`}>{trend}</span>
        </div>
      </CardContent>
    </Card>
  );
}
