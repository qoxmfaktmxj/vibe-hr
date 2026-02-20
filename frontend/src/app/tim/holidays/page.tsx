import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { requireMenuAccess } from "@/lib/guard";

const holidays = [
  { no: 1, year: 2026, month: "01월", day: "01일", name: "신정", type: "양력" },
  { no: 2, year: 2026, month: "03월", day: "01일", name: "삼일절", type: "양력" },
  { no: 3, year: 2026, month: "05월", day: "05일", name: "어린이날", type: "양력" },
  { no: 4, year: 2026, month: "06월", day: "06일", name: "현충일", type: "양력" },
  { no: 5, year: 2026, month: "08월", day: "15일", name: "광복절", type: "양력" },
  { no: 6, year: 2026, month: "10월", day: "03일", name: "개천절", type: "양력" },
  { no: 7, year: 2026, month: "10월", day: "09일", name: "한글날", type: "양력" },
  { no: 8, year: 2026, month: "12월", day: "25일", name: "크리스마스", type: "양력" },
];

export default async function TimHolidaysPage() {
  await requireMenuAccess("/tim/holidays");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-gray-800">휴일관리</h1>
            <p className="text-sm text-gray-500">연도별 휴일 기준 관리</p>
          </div>
          <LogoutButton />
        </header>

        <div className="space-y-4 p-6">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">년도</span>
              <input className="h-10 w-24 rounded-md border px-3" defaultValue="2026" />
              <Button variant="query" className="h-10 px-4">조회</Button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">휴일관리</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">입력</Button>
                <Button variant="outline" size="sm">복사</Button>
                <Button variant="save" size="sm">저장</Button>
                <Button variant="outline" size="sm">다운로드</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[900px] w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border px-2 py-2">No</th>
                    <th className="border px-2 py-2">년도</th>
                    <th className="border px-2 py-2">월</th>
                    <th className="border px-2 py-2">일</th>
                    <th className="border px-2 py-2">휴일명</th>
                    <th className="border px-2 py-2">구분</th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.map((h) => (
                    <tr key={h.no} className="odd:bg-white even:bg-slate-50">
                      <td className="border px-2 py-2 text-center">{h.no}</td>
                      <td className="border px-2 py-2 text-center">{h.year}</td>
                      <td className="border px-2 py-2 text-center">{h.month}</td>
                      <td className="border px-2 py-2 text-center">{h.day}</td>
                      <td className="border px-2 py-2">{h.name}</td>
                      <td className="border px-2 py-2 text-center">{h.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
