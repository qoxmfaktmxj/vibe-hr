import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { Button } from "@/components/ui/button";
import { requireMenuAccess } from "@/lib/guard";

const rows = [
  { no: 1, code: "C01", name: "연차휴가", type: "휴가", unit: "전일", use: true, seq: 10, min: "1.000", max: "25.000" },
  { no: 2, code: "C01A", name: "오전반차휴가", type: "휴가", unit: "오전", use: true, seq: 20, min: "0.500", max: "0.500" },
  { no: 3, code: "C01B", name: "오후반차휴가", type: "휴가", unit: "오후", use: true, seq: 30, min: "0.500", max: "0.500" },
  { no: 4, code: "C02", name: "하계휴가", type: "휴가", unit: "전일", use: true, seq: 70, min: "1.000", max: "5.000" },
  { no: 5, code: "C03", name: "대체휴가", type: "휴가", unit: "전일", use: true, seq: 100, min: "1.000", max: "100.000" },
];

export default async function TimCodesPage() {
  await requireMenuAccess("/tim/codes");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-gray-800">근태코드관리</h1>
            <p className="text-sm text-gray-500">근태/휴가 코드 및 사용 조건 관리</p>
          </div>
          <LogoutButton />
        </header>

        <div className="space-y-4 p-6">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <input className="h-10 rounded-md border px-3" placeholder="근태명" />
              <select className="h-10 rounded-md border px-3"><option>근태종류 전체</option></select>
              <select className="h-10 rounded-md border px-3"><option>근태신청여부 전체</option></select>
              <Button variant="query" className="h-10 px-4">조회</Button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">근태코드관리</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">입력</Button>
                <Button variant="outline" size="sm">복사</Button>
                <Button variant="save" size="sm">저장</Button>
                <Button variant="outline" size="sm">다운로드</Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[1200px] w-full border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border px-2 py-2">No</th>
                    <th className="border px-2 py-2">근태코드</th>
                    <th className="border px-2 py-2">근태명</th>
                    <th className="border px-2 py-2">근태종류</th>
                    <th className="border px-2 py-2">신청단위</th>
                    <th className="border px-2 py-2">근태신청여부</th>
                    <th className="border px-2 py-2">순서</th>
                    <th className="border px-2 py-2">신청일수(최소)</th>
                    <th className="border px-2 py-2">신청일수(최대)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.no} className="odd:bg-white even:bg-slate-50">
                      <td className="border px-2 py-2 text-center">{r.no}</td>
                      <td className="border px-2 py-2">{r.code}</td>
                      <td className="border px-2 py-2">{r.name}</td>
                      <td className="border px-2 py-2">{r.type}</td>
                      <td className="border px-2 py-2">{r.unit}</td>
                      <td className="border px-2 py-2 text-center">{r.use ? "✓" : ""}</td>
                      <td className="border px-2 py-2 text-right">{r.seq}</td>
                      <td className="border px-2 py-2 text-right">{r.min}</td>
                      <td className="border px-2 py-2 text-right">{r.max}</td>
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
