import { DashboardAttendancePanel } from "@/components/dashboard/dashboard-attendance-panel";
import { AttendanceTrendChart, LeaveTrendChart } from "@/components/dashboard/dashboard-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardSummary } from "@/lib/api";

type WeatherSnapshot = {
  tempC: number | null;
  windKmh: number | null;
  code: number | null;
  observedAt: string | null;
};

type FxSnapshot = {
  usdKrw: number | null;
  eurKrw: number | null;
  jpyKrw100: number | null;
  baseDate: string | null;
};

function weatherLabel(code: number | null) {
  if (code == null) return "-";
  if ([0].includes(code)) return "맑음";
  if ([1, 2].includes(code)) return "대체로 맑음";
  if ([3].includes(code)) return "흐림";
  if ([45, 48].includes(code)) return "안개";
  if ([51, 53, 55, 56, 57].includes(code)) return "이슬비";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "비";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "눈";
  if ([95, 96, 99].includes(code)) return "뇌우";
  return `코드 ${code}`;
}

async function getNoKeyWeather(): Promise<WeatherSnapshot> {
  try {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,wind_speed_10m,weather_code&timezone=Asia%2FSeoul",
      { next: { revalidate: 600 } },
    );
    if (!response.ok) throw new Error(`weather ${response.status}`);
    const json = (await response.json()) as {
      current?: { temperature_2m?: number; wind_speed_10m?: number; weather_code?: number; time?: string };
    };
    return {
      tempC: json.current?.temperature_2m ?? null,
      windKmh: json.current?.wind_speed_10m ?? null,
      code: json.current?.weather_code ?? null,
      observedAt: json.current?.time ?? null,
    };
  } catch {
    return { tempC: null, windKmh: null, code: null, observedAt: null };
  }
}

async function getNoKeyFx(): Promise<FxSnapshot> {
  try {
    const [usd, eur, jpy] = await Promise.all([
      fetch("https://api.frankfurter.app/latest?from=USD&to=KRW", { next: { revalidate: 600 } }),
      fetch("https://api.frankfurter.app/latest?from=EUR&to=KRW", { next: { revalidate: 600 } }),
      fetch("https://api.frankfurter.app/latest?from=JPY&to=KRW", { next: { revalidate: 600 } }),
    ]);
    if (!usd.ok || !eur.ok || !jpy.ok) throw new Error("fx fetch failed");

    const usdJson = (await usd.json()) as { date?: string; rates?: { KRW?: number } };
    const eurJson = (await eur.json()) as { date?: string; rates?: { KRW?: number } };
    const jpyJson = (await jpy.json()) as { date?: string; rates?: { KRW?: number } };

    return {
      usdKrw: usdJson.rates?.KRW ?? null,
      eurKrw: eurJson.rates?.KRW ?? null,
      jpyKrw100: jpyJson.rates?.KRW != null ? jpyJson.rates.KRW * 100 : null,
      baseDate: usdJson.date ?? eurJson.date ?? jpyJson.date ?? null,
    };
  } catch {
    return { usdKrw: null, eurKrw: null, jpyKrw100: null, baseDate: null };
  }
}

function pct(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export default async function DashboardPage() {
  const [summary, weather, fx] = await Promise.all([getDashboardSummary(), getNoKeyWeather(), getNoKeyFx()]);
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

  const attendanceChartData = attendanceTrend.map((count, idx) => ({
    day: `D-${attendanceTrend.length - idx - 1}`,
    count,
  }));

  const leaveChartData = leaveTrend.map((count, idx) => ({
    day: `D-${leaveTrend.length - idx - 1}`,
    count,
  }));

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
              <AttendanceTrendChart data={attendanceChartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">대기 휴가 건수 추이 (샘플)</CardTitle>
            </CardHeader>
            <CardContent>
              <LeaveTrendChart data={leaveChartData} />

              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md border bg-muted/20 p-3">전체 인원: <b>{summary.total_employees.toLocaleString()}</b></div>
                <div className="rounded-md border bg-muted/20 p-3">부서 수: <b>{summary.total_departments}</b></div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">오늘 날씨 (서울 · 무키 API)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <div className="rounded-md border bg-muted/20 p-3">상태: <b>{weatherLabel(weather.code)}</b></div>
                <div className="rounded-md border bg-muted/20 p-3">기온: <b>{weather.tempC == null ? "-" : `${weather.tempC.toFixed(1)}°C`}</b></div>
                <div className="rounded-md border bg-muted/20 p-3">풍속: <b>{weather.windKmh == null ? "-" : `${weather.windKmh.toFixed(1)} km/h`}</b></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">기준시각: {weather.observedAt ?? "-"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">주요 환율 (무키 API)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-3">
                <div className="rounded-md border bg-muted/20 p-3">USD/KRW: <b>{fx.usdKrw == null ? "-" : fx.usdKrw.toLocaleString()}</b></div>
                <div className="rounded-md border bg-muted/20 p-3">EUR/KRW: <b>{fx.eurKrw == null ? "-" : fx.eurKrw.toLocaleString()}</b></div>
                <div className="rounded-md border bg-muted/20 p-3">JPY/KRW(100엔): <b>{fx.jpyKrw100 == null ? "-" : fx.jpyKrw100.toLocaleString()}</b></div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">기준일: {fx.baseDate ?? "-"}</p>
            </CardContent>
          </Card>
        </section>
      </div>
  );
}
