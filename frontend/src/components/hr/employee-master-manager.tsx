"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  DepartmentItem,
  DepartmentListResponse,
  EmployeeDetailResponse,
  EmployeeItem,
  EmployeeListResponse,
} from "@/types/employee";

type FormState = {
  display_name: string;
  email: string;
  department_id: string;
  position_title: string;
  hire_date: string;
  employment_status: "active" | "leave" | "resigned";
  is_active: boolean;
  password: string;
};

const EMPTY_FORM: FormState = {
  display_name: "",
  email: "",
  department_id: "",
  position_title: "Staff",
  hire_date: "",
  employment_status: "active",
  is_active: true,
  password: "admin",
};

export function EmployeeMasterManager() {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const filteredEmployees = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((employee) => {
      return (
        employee.display_name.toLowerCase().includes(q) ||
        employee.login_id.toLowerCase().includes(q) ||
        employee.employee_no.toLowerCase().includes(q) ||
        employee.department_name.toLowerCase().includes(q)
      );
    });
  }, [employees, keyword]);

  async function loadBase() {
    setLoading(true);
    const [employeeRes, departmentRes] = await Promise.all([
      fetch("/api/employees", { cache: "no-store" }),
      fetch("/api/employees/departments", { cache: "no-store" }),
    ]);

    if (!employeeRes.ok) {
      throw new Error("사원 목록을 불러오지 못했습니다.");
    }
    if (!departmentRes.ok) {
      throw new Error("부서 목록을 불러오지 못했습니다.");
    }

    const employeeJson = (await employeeRes.json()) as EmployeeListResponse;
    const departmentJson = (await departmentRes.json()) as DepartmentListResponse;

    setEmployees(employeeJson.employees);
    setDepartments(departmentJson.departments);
    setSelectedEmployeeId((prev) => prev ?? employeeJson.employees[0]?.id ?? null);
    setLoading(false);
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch (error) {
        setNoticeType("error");
        setNotice(error instanceof Error ? error.message : "초기 로딩에 실패했습니다.");
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isCreateMode) {
      const defaultDepartmentId = departments[0]?.id;
      setForm(() => ({
        ...EMPTY_FORM,
        department_id: defaultDepartmentId ? String(defaultDepartmentId) : "",
      }));
      return;
    }

    if (!selectedEmployee) {
      return;
    }

    setForm({
      display_name: selectedEmployee.display_name,
      email: selectedEmployee.email,
      department_id: String(selectedEmployee.department_id),
      position_title: selectedEmployee.position_title,
      hire_date: selectedEmployee.hire_date,
      employment_status: selectedEmployee.employment_status,
      is_active: selectedEmployee.is_active,
      password: "",
    });
  }, [departments, isCreateMode, selectedEmployee]);

  function startCreateMode() {
    setIsCreateMode(true);
    setSelectedEmployeeId(null);
    setNotice(null);
    setNoticeType(null);
  }

  function cancelCreateMode() {
    setIsCreateMode(false);
    setSelectedEmployeeId(employees[0]?.id ?? null);
    setNotice(null);
    setNoticeType(null);
  }

  async function saveEmployee() {
    if (!form.display_name.trim()) {
      setNoticeType("error");
      setNotice("이름을 입력하세요.");
      return;
    }
    if (!form.department_id) {
      setNoticeType("error");
      setNotice("부서를 선택하세요.");
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      if (isCreateMode) {
        const payload = {
          display_name: form.display_name.trim(),
          department_id: Number(form.department_id),
          position_title: form.position_title.trim() || "Staff",
          hire_date: form.hire_date || null,
          employment_status: form.employment_status,
          email: form.email.trim() || null,
          password: form.password || "admin",
        };

        const res = await fetch("/api/employees", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as EmployeeDetailResponse | { detail?: string } | null;
        if (!res.ok) {
          throw new Error((data as { detail?: string } | null)?.detail ?? "등록 실패");
        }

        await loadBase();
        if (data && "employee" in data) {
          setSelectedEmployeeId(data.employee.id);
          setIsCreateMode(false);
        }
      } else {
        if (!selectedEmployeeId) {
          throw new Error("수정할 사원을 선택하세요.");
        }

        const payload = {
          display_name: form.display_name.trim(),
          department_id: Number(form.department_id),
          position_title: form.position_title.trim() || "Staff",
          hire_date: form.hire_date || null,
          employment_status: form.employment_status,
          email: form.email.trim(),
          is_active: form.is_active,
          password: form.password.trim() ? form.password.trim() : undefined,
        };

        const res = await fetch(`/api/employees/${selectedEmployeeId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as EmployeeDetailResponse | { detail?: string } | null;
        if (!res.ok) {
          throw new Error((data as { detail?: string } | null)?.detail ?? "수정 실패");
        }

        await loadBase();
        setSelectedEmployeeId(selectedEmployeeId);
      }

      setNoticeType("success");
      setNotice("저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEmployee() {
    if (!selectedEmployeeId || isCreateMode) return;
    if (!confirm("선택한 사원을 삭제하시겠습니까?")) return;

    setSaving(true);
    setNotice(null);

    try {
      const res = await fetch(`/api/employees/${selectedEmployeeId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "삭제 실패");
      }

      await loadBase();
      setSelectedEmployeeId(null);
      setNoticeType("success");
      setNotice("삭제가 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-5">
      <Card className="xl:col-span-2">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle>사원 마스터 ({employees.length.toLocaleString()}명)</CardTitle>
            <Button size="sm" onClick={startCreateMode}>신규 등록</Button>
          </div>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="이름/로그인ID/사번/부서 검색"
          />
        </CardHeader>
        <CardContent>
          <div className="max-h-[640px] overflow-auto rounded-md border">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  <th className="border px-2 py-2 text-left">사번</th>
                  <th className="border px-2 py-2 text-left">이름</th>
                  <th className="border px-2 py-2 text-left">로그인ID</th>
                  <th className="border px-2 py-2 text-left">부서</th>
                  <th className="border px-2 py-2 text-left">상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => {
                  const selected = employee.id === selectedEmployeeId && !isCreateMode;
                  return (
                    <tr
                      key={employee.id}
                      className={`cursor-pointer ${selected ? "bg-primary/10" : "odd:bg-white even:bg-slate-50"}`}
                      onClick={() => {
                        setIsCreateMode(false);
                        setSelectedEmployeeId(employee.id);
                        setNotice(null);
                        setNoticeType(null);
                      }}
                    >
                      <td className="border px-2 py-2">{employee.employee_no}</td>
                      <td className="border px-2 py-2">{employee.display_name}</td>
                      <td className="border px-2 py-2">{employee.login_id}</td>
                      <td className="border px-2 py-2">{employee.department_name}</td>
                      <td className="border px-2 py-2">{employee.is_active ? "Active" : "Inactive"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-3">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{isCreateMode ? "신규 사원 등록" : "사원 상세"}</CardTitle>
          <div className="flex gap-2">
            {isCreateMode ? (
              <Button variant="outline" onClick={cancelCreateMode} disabled={saving}>
                취소
              </Button>
            ) : (
              <Button variant="destructive" onClick={deleteEmployee} disabled={saving || !selectedEmployeeId}>
                삭제
              </Button>
            )}
            <Button onClick={saveEmployee} disabled={saving}>
              저장
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice ? (
            <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>
              {notice}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>이름</Label>
              <Input
                value={form.display_name}
                onChange={(event) => setForm((prev) => ({ ...prev, display_name: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>이메일</Label>
              <Input
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="비워두면 자동 생성"
              />
            </div>

            <div className="space-y-2">
              <Label>부서</Label>
              <select
                className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                value={form.department_id}
                onChange={(event) => setForm((prev) => ({ ...prev, department_id: event.target.value }))}
              >
                <option value="">부서 선택</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name} ({department.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>직책</Label>
              <Input
                value={form.position_title}
                onChange={(event) => setForm((prev) => ({ ...prev, position_title: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>입사일</Label>
              <Input
                type="date"
                value={form.hire_date}
                onChange={(event) => setForm((prev) => ({ ...prev, hire_date: event.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>재직상태</Label>
              <select
                className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                value={form.employment_status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    employment_status: event.target.value as FormState["employment_status"],
                  }))
                }
              >
                <option value="active">active</option>
                <option value="leave">leave</option>
                <option value="resigned">resigned</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>{isCreateMode ? "초기 비밀번호" : "비밀번호 변경(선택)"}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder={isCreateMode ? "admin" : "입력 시 변경"}
              />
            </div>

            {!isCreateMode ? (
              <label className="mt-8 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                />
                로그인 활성 여부
              </label>
            ) : null}
          </div>

          {!isCreateMode && selectedEmployee ? (
            <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">
              <p>사번: {selectedEmployee.employee_no}</p>
              <p>로그인ID: {selectedEmployee.login_id}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
