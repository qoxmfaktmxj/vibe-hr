"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  OrganizationDepartmentDetailResponse,
  OrganizationDepartmentItem,
  OrganizationDepartmentListResponse,
} from "@/types/organization";

type DepartmentFormState = {
  code: string;
  name: string;
  parent_id: string;
  is_active: boolean;
};

const EMPTY_FORM: DepartmentFormState = {
  code: "",
  name: "",
  parent_id: "",
  is_active: true,
};

export function OrganizationManager() {
  const [departments, setDepartments] = useState<OrganizationDepartmentItem[]>([]);
  const [allDepartments, setAllDepartments] = useState<OrganizationDepartmentItem[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [form, setForm] = useState<DepartmentFormState>(EMPTY_FORM);
  const [searchCode, setSearchCode] = useState("");
  const [searchName, setSearchName] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeType, setNoticeType] = useState<"success" | "error" | null>(null);

  const selectedDepartment = useMemo(
    () => allDepartments.find((department) => department.id === selectedDepartmentId) ?? null,
    [allDepartments, selectedDepartmentId],
  );

  const parentOptions = useMemo(() => {
    return allDepartments.filter((department) => department.id !== selectedDepartmentId);
  }, [allDepartments, selectedDepartmentId]);

  const fetchDepartments = useCallback(async (filtered: boolean) => {
    const params = new URLSearchParams();
    if (filtered && searchCode.trim()) params.set("code", searchCode.trim());
    if (filtered && searchName.trim()) params.set("name", searchName.trim());
    if (referenceDate.trim()) params.set("reference_date", referenceDate.trim());

    const endpoint = params.size > 0 ? `/api/org/departments?${params.toString()}` : "/api/org/departments";
    const res = await fetch(endpoint, { cache: "no-store" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { detail?: string } | null;
      throw new Error(
        data?.detail ?? "조직 목록을 불러오지 못했습니다.",
      );
    }

    const data = (await res.json()) as OrganizationDepartmentListResponse;
    return data.departments;
  }, [referenceDate, searchCode, searchName]);

  const loadBase = useCallback(async () => {
    setLoading(true);
    try {
      const [filteredDepartments, fullDepartments] = await Promise.all([
        fetchDepartments(true),
        fetchDepartments(false),
      ]);
      setDepartments(filteredDepartments);
      setAllDepartments(fullDepartments);

      setSelectedDepartmentId((prev) => {
        if (prev && fullDepartments.some((department) => department.id === prev)) return prev;
        return filteredDepartments[0]?.id ?? null;
      });
    } finally {
      setLoading(false);
    }
  }, [fetchDepartments]);

  useEffect(() => {
    void (async () => {
      try {
        await loadBase();
      } catch (error) {
        setNoticeType("error");
        setNotice(
          error instanceof Error
            ? error.message
            : "초기 로딩에 실패했습니다.",
        );
        setLoading(false);
      }
    })();
  }, [loadBase]);

  useEffect(() => {
    if (isCreateMode) {
      setForm(EMPTY_FORM);
      return;
    }

    if (!selectedDepartment) return;

    setForm({
      code: selectedDepartment.code,
      name: selectedDepartment.name,
      parent_id: selectedDepartment.parent_id ? String(selectedDepartment.parent_id) : "",
      is_active: selectedDepartment.is_active,
    });
  }, [isCreateMode, selectedDepartment]);

  function runSearch() {
    void (async () => {
      setLoading(true);
      try {
        const filteredDepartments = await fetchDepartments(true);
        setDepartments(filteredDepartments);
        setSelectedDepartmentId(filteredDepartments[0]?.id ?? null);
      } catch (error) {
        setNoticeType("error");
        setNotice(
          error instanceof Error ? error.message : "조회에 실패했습니다.",
        );
      } finally {
        setLoading(false);
      }
    })();
  }

  function startCreate() {
    setIsCreateMode(true);
    setSelectedDepartmentId(null);
    setNotice(null);
    setNoticeType(null);
  }

  async function saveDepartment() {
    if (!form.code.trim()) {
      setNoticeType("error");
      setNotice("조직코드를 입력하세요.");
      return;
    }
    if (!form.name.trim()) {
      setNoticeType("error");
      setNotice("조직명을 입력하세요.");
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        parent_id: form.parent_id ? Number(form.parent_id) : null,
        is_active: form.is_active,
      };

      const res = await fetch(isCreateMode ? "/api/org/departments" : `/api/org/departments/${selectedDepartmentId}`, {
        method: isCreateMode ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | OrganizationDepartmentDetailResponse
        | { detail?: string }
        | null;

      if (!res.ok) {
        throw new Error((data as { detail?: string } | null)?.detail ?? "저장 실패");
      }

      await loadBase();
      if (data && "department" in data) {
        setSelectedDepartmentId(data.department.id);
      }
      setIsCreateMode(false);
      setNoticeType("success");
      setNotice("저장이 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(
        error instanceof Error ? error.message : "저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeDepartment() {
    if (!selectedDepartmentId || isCreateMode) return;
    if (!confirm("선택한 조직을 삭제하시겠습니까?")) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/org/departments/${selectedDepartmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "삭제 실패");
      }

      await loadBase();
      setIsCreateMode(false);
      setSelectedDepartmentId(null);
      setNoticeType("success");
      setNotice("삭제가 완료되었습니다.");
    } catch (error) {
      setNoticeType("error");
      setNotice(
        error instanceof Error ? error.message : "삭제에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6">{"불러오는 중..."}</div>;
  }

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-3">
            <div className="mr-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Search className="h-4 w-4 text-primary" />
              Search
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{"조직코드"}</Label>
              <Input
                className="h-9 w-36"
                value={searchCode}
                onChange={(event) => setSearchCode(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{"조직명"}</Label>
              <Input
                className="h-9 w-44"
                value={searchName}
                onChange={(event) => setSearchName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{"기준일자"}</Label>
              <Input
                type="date"
                className="h-9 w-40"
                value={referenceDate}
                onChange={(event) => setReferenceDate(event.target.value)}
              />
            </div>
            <Button variant="query" className="h-9 px-5" onClick={runSearch}>
              {"조회"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{"조직코드관리"}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={startCreate} disabled={saving}>
              {"입력"}
            </Button>
            <Button variant="save" onClick={saveDepartment} disabled={saving}>
              {"저장"}
            </Button>
            <Button variant="destructive" onClick={removeDepartment} disabled={saving || !selectedDepartmentId}>
              {"삭제"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notice ? (
            <p className={`text-sm ${noticeType === "success" ? "text-emerald-600" : "text-red-500"}`}>
              {notice}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <div className="max-h-[560px] overflow-auto rounded-md border">
                <table className="w-full min-w-[760px] border-collapse text-sm">
                  <thead className="sticky top-0 bg-slate-100">
                    <tr>
                      <th className="border px-2 py-2 text-center">No</th>
                      <th className="border px-2 py-2 text-center">{"상태"}</th>
                      <th className="border px-2 py-2 text-left">{"조직코드"}</th>
                      <th className="border px-2 py-2 text-left">{"조직명"}</th>
                      <th className="border px-2 py-2 text-left">{"상위조직"}</th>
                      <th className="border px-2 py-2 text-center">{"사용여부"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((department, index) => {
                      const selected = !isCreateMode && department.id === selectedDepartmentId;
                      return (
                        <tr
                          key={department.id}
                          className={`cursor-pointer ${selected ? "bg-primary/10" : "odd:bg-white even:bg-slate-50"}`}
                          onClick={() => {
                            setIsCreateMode(false);
                            setSelectedDepartmentId(department.id);
                            setNotice(null);
                            setNoticeType(null);
                          }}
                        >
                          <td className="border px-2 py-2 text-center">{index + 1}</td>
                          <td className="border px-2 py-2 text-center">
                            {department.is_active
                              ? "사용"
                              : "미사용"}
                          </td>
                          <td className="border px-2 py-2">{department.code}</td>
                          <td className="border px-2 py-2">{department.name}</td>
                          <td className="border px-2 py-2">{department.parent_name ?? "-"}</td>
                          <td className="border px-2 py-2 text-center">{department.is_active ? "Y" : "N"}</td>
                        </tr>
                      );
                    })}
                    {departments.length === 0 ? (
                      <tr>
                        <td className="border px-2 py-8 text-center text-slate-500" colSpan={6}>
                          {"조회된 조직이 없습니다."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="xl:col-span-2">
              <div className="space-y-4 rounded-md border p-4">
                <h3 className="text-sm font-semibold text-slate-700">
                  {isCreateMode
                    ? "신규 조직 입력"
                    : "조직 상세"}
                </h3>

                <div className="space-y-2">
                  <Label>{"조직코드"}</Label>
                  <Input
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{"조직명"}</Label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{"상위조직"}</Label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                    value={form.parent_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
                  >
                    <option value="">{"(최상위)"}</option>
                    {parentOptions.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name} ({department.code})
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: Boolean(checked) }))}
                  />
                  {"사용여부"}
                </label>

                {!isCreateMode && selectedDepartment ? (
                  <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                    <p>
                      {"생성일"}: {new Date(selectedDepartment.created_at).toLocaleString()}
                    </p>
                    <p>
                      {"수정일"}: {new Date(selectedDepartment.updated_at).toLocaleString()}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
