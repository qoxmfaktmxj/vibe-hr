import { DashboardAttendancePanel } from "@/components/dashboard/dashboard-attendance-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary } from "@/lib/api";

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export default async function DashboardPage() {
  const summary = await getDashboardSummary();
  const totalAttendance =
    summary.attendance_present_today + summary.attendance_late_today + summary.attendance_absent_today;

  const attendanceTrend = [
    Math.max(0, summary.attendance_present_today - 24),
    Math.max(0, summary.attendance_present_today - 19),
    Math.max(0, summary.attendance_present_today - 15),
    Math.max(0, summary.attendance_present_today - 11),
    Math.max(0, summary.attendance_present_today - 7),
    Math.max(0, summary.attendance_present_today - 3),
    summary.attendance_present_today,
  ];

  const leaveTrend = [
    Math.max(0, summary.pending_leave_requests - 4),
    Math.max(0, summary.pending_leave_requests - 3),
    Math.max(0, summary.pending_leave_requests - 2),
    Math.max(0, summary.pending_leave_requests - 1),
    summary.pending_leave_requests,
  ];

  const maxAttendance = Math.max(...attendanceTrend, 1);
  const maxLeave = Math.max(...leaveTrend, 1);

  return (
      <div className="space-y-6 p-6 lg:p-8">
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="xl:col-span-1">
            <DashboardAttendancePanel compact />
          </div>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">오늘 출근 현황</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <div className="rounded-md border bg-muted/20 p-3">
                  정상출근: <b>{summary.attendance_present_today}</b> ({pct(summary.attendance_present_today, totalAttendance)}%)
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  지각: <b>{summary.attendance_late_today}</b> ({pct(summary.attendance_late_today, totalAttendance)}%)
                </div>
                <div className="rounded-md border bg-muted/20 p-3">
                  결근: <b>{summary.attendance_absent_today}</b> ({pct(summary.attendance_absent_today, totalAttendance)}%)
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">정상출근 비율</div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-emerald-500"
                    style={{ width: `${pct(summary.attendance_present_today, totalAttendance)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">지각 비율</div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-amber-500"
                    style={{ width: `${pct(summary.attendance_late_today, totalAttendance)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground">결근 비율</div>
                <div className="h-3 w-full rounded-full bg-muted">
                  <div
                    className="h-3 rounded-full bg-rose-500"
                    style={{ width: `${pct(summary.attendance_absent_today, totalAttendance)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">최근 7일 출근 추이 (샘플)</CardTitle>
            </CardHeader>
            <CardContent>
              <svg viewBox="0 0 700 220" className="h-56 w-full" aria-label="attendance trend chart">
                {attendanceTrend.map((value, idx) => {
                  const x = 40 + idx * 100;
                  const y = 180 - (value / maxAttendance) * 120;
                  return <circle key={`point-${idx}`} cx={x} cy={y} r={4} fill="currentColor" className="text-primary" />;
                })}
                {attendanceTrend.slice(1).map((value, idx) => {
                  const x1 = 40 + idx * 100;
                  const y1 = 180 - (attendanceTrend[idx] / maxAttendance) * 120;
                  const x2 = 40 + (idx + 1) * 100;
                  const y2 = 180 - (value / maxAttendance) * 120;
                  return <line key={`line-${idx}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--primary))" strokeWidth={3} />;
                })}
              </svg>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">대기 휴가 건수 추이 (샘플)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {leaveTrend.map((value, idx) => (
                  <div key={`leave-${idx}`} className="flex items-center gap-2 text-sm">
                    <span className="w-14 text-xs text-muted-foreground">D-{leaveTrend.length - idx - 1}</span>
                    <div className="h-4 flex-1 rounded bg-muted">
                      <div
                        className="h-4 rounded bg-primary"
                        style={{ width: `${Math.max(8, (value / maxLeave) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right text-xs">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-3">전체 인원: <b>{summary.total_employees.toLocaleString()}</b></div>
                <div className="rounded-md border bg-muted/20 p-3">부서 수: <b>{summary.total_departments}</b></div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
  );
}
