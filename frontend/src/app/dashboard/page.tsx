import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Search,
  Star,
  Users,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SurveyMeter } from "@/components/dashboard/survey-meter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDashboardSummary } from "@/lib/api";

const recognitionFeedPromise = Promise.resolve([
  {
    actor: "James Wilson",
    target: "Elena Rodriguez",
    message: "Outstanding leadership on the Q3 launch reduced our rework cycle time.",
    tagA: "Leadership",
    tagB: "Innovation",
    ago: "2h ago",
  },
  {
    actor: "Emily Chen",
    target: "Design Team",
    message: "Thank you for keeping the team calm and aligned during sprint deadlines.",
    tagA: "Team Player",
    tagB: "",
    ago: "Yesterday",
  },
]);

export default async function DashboardPage() {
  const [summary, recognitions] = await Promise.all([
    getDashboardSummary(),
    recognitionFeedPromise,
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--vibe-background-light)] text-[var(--vibe-text-base)]">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 lg:px-8">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Employee Engagement Overview</h1>
            <p className="text-sm text-gray-500">Real-time insights for the last 30 days</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <Input
                className="h-10 w-64 border-gray-200 bg-gray-100 pl-10"
                placeholder="Search insights..."
                aria-label="Search insights"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-gray-500"
              aria-label="Open notifications"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
            </Button>
            <Button className="gap-2 font-bold">
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              Create Survey
            </Button>
            <LogoutButton />
          </div>
        </header>

        <div className="space-y-8 p-6 lg:p-8">
          <section className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Total Employees"
              value={summary.total_employees.toLocaleString()}
              trend="+2.4%"
              trendColor="text-emerald-600"
              icon={Users}
              iconBg="bg-primary/10"
              iconColor="text-primary"
            />
            <KpiCard
              title="Departments"
              value={summary.total_departments.toString()}
              trend="+1"
              trendColor="text-emerald-600"
              icon={CalendarDays}
              iconBg="bg-[var(--vibe-accent-rose)]/10"
              iconColor="text-[var(--vibe-accent-rose)]"
            />
            <KpiCard
              title="Late Today"
              value={summary.attendance_late_today.toString()}
              trend="-1.2%"
              trendColor="text-rose-500"
              icon={Star}
              iconBg="bg-[var(--vibe-accent-red)]/10"
              iconColor="text-[var(--vibe-accent-red)]"
            />
            <KpiCard
              title="Pending Leaves"
              value={summary.pending_leave_requests.toString()}
              trend="Stable"
              trendColor="text-gray-400"
              icon={CalendarDays}
              iconBg="bg-[var(--vibe-primary-light)]/10"
              iconColor="text-[var(--vibe-primary-light)]"
            />
          </section>

          <section className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <Card className="border-gray-100 shadow-sm xl:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Engagement Score Trend</CardTitle>
                  <p className="text-sm text-gray-500">Historical performance data</p>
                </div>
                <Badge variant="secondary" className="rounded-lg bg-gray-100 text-gray-600">
                  Last 6 Months
                </Badge>
              </CardHeader>
              <CardContent>
                <svg className="h-64 w-full" viewBox="0 0 1000 300" aria-label="Engagement score line chart">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#3c6dee" stopOpacity="0.2" />
                      <stop offset="100%" stopColor="#3c6dee" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M0,250 Q100,220 200,240 T400,180 T600,200 T800,120 T1000,150 L1000,300 L0,300 Z"
                    fill="url(#chartGradient)"
                  />
                  <path
                    d="M0,250 Q100,220 200,240 T400,180 T600,200 T800,120 T1000,150"
                    fill="none"
                    stroke="#3c6dee"
                    strokeLinecap="round"
                    strokeWidth="4"
                  />
                  <circle cx="200" cy="240" fill="#3c6dee" r="5" />
                  <circle cx="400" cy="180" fill="#3c6dee" r="5" />
                  <circle cx="600" cy="200" fill="#3c6dee" r="5" />
                  <circle cx="800" cy="120" fill="#3c6dee" r="5" />
                </svg>
              </CardContent>
            </Card>

            <Card className="border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Pulse Survey Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="text-primary">
                  <SurveyMeter label="Work-Life Balance" score="8.4/10" value={84} colorClass="text-primary" />
                </div>
                <div className="text-[var(--vibe-accent-rose)]">
                  <SurveyMeter
                    label="Growth Opportunities"
                    score="6.8/10"
                    value={68}
                    colorClass="text-[var(--vibe-accent-rose)]"
                  />
                </div>
                <div className="text-[var(--vibe-primary-light)]">
                  <SurveyMeter
                    label="Management Support"
                    score="9.1/10"
                    value={91}
                    colorClass="text-[var(--vibe-primary-light)]"
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="grid grid-cols-1 gap-8 xl:grid-cols-2">
            <Card className="border-gray-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Recent Recognitions</CardTitle>
                <Button variant="link" className="text-primary">
                  View All
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {recognitions.map((item) => (
                  <article key={`${item.actor}-${item.target}`} className="rounded-lg border border-gray-100 p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <p className="text-sm">
                        <span className="font-bold text-gray-900">{item.actor}</span>{" "}
                        <span className="text-gray-500">recognized</span>{" "}
                        <span className="font-bold text-gray-900">{item.target}</span>
                      </p>
                      <span className="text-[10px] font-bold uppercase text-[var(--vibe-accent-muted)]">
                        {item.ago}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{item.message}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className="bg-primary/10 text-primary">{item.tagA}</Badge>
                      {item.tagB ? (
                        <Badge className="bg-[var(--vibe-accent-rose)]/10 text-[var(--vibe-accent-rose)]">
                          {item.tagB}
                        </Badge>
                      ) : null}
                    </div>
                  </article>
                ))}
              </CardContent>
            </Card>

            <Card className="border-gray-100 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Milestones This Week</CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400"
                    aria-label="Show previous milestones"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-400"
                    aria-label="Show next milestones"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border-2 border-[var(--vibe-primary-light)]">
                    <AvatarFallback>M</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Marcus T.</p>
                    <p className="text-xs text-gray-500">Today - Birthday</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--vibe-accent-red)] text-xs font-bold text-white">
                    3y
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Lisa Kim</p>
                    <p className="text-xs text-gray-500">Tomorrow - Anniversary</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/5 p-4">
                  <p className="text-xs font-medium text-primary">
                    Schedule automatic celebratory posts?
                  </p>
                  <Button variant="link" className="text-xs font-bold text-primary">
                    Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
