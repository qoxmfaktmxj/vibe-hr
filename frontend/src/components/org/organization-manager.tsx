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
        data?.detail ?? "\uC870\uC9C1 \uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
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
            : "\uCD08\uAE30 \uB85C\uB529\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
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
          error instanceof Error ? error.message : "\uC870\uD68C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
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
      setNotice("\uC870\uC9C1\uCF54\uB4DC\uB97C \uC785\uB825\uD558\uC138\uC694.");
      return;
    }
    if (!form.name.trim()) {
      setNoticeType("error");
      setNotice("\uC870\uC9C1\uBA85\uC744 \uC785\uB825\uD558\uC138\uC694.");
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
        throw new Error((data as { detail?: string } | null)?.detail ?? "\uC800\uC7A5 \uC2E4\uD328");
      }

      await loadBase();
      if (data && "department" in data) {
        setSelectedDepartmentId(data.department.id);
      }
      setIsCreateMode(false);
      setNoticeType("success");
      setNotice("\uC800\uC7A5\uC774 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (error) {
      setNoticeType("error");
      setNotice(
        error instanceof Error ? error.message : "\uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function removeDepartment() {
    if (!selectedDepartmentId || isCreateMode) return;
    if (!confirm("\uC120\uD0DD\uD55C \uC870\uC9C1\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;

    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/org/departments/${selectedDepartmentId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(data?.detail ?? "\uC0AD\uC81C \uC2E4\uD328");
      }

      await loadBase();
      setIsCreateMode(false);
      setSelectedDepartmentId(null);
      setNoticeType("success");
      setNotice("\uC0AD\uC81C\uAC00 \uC644\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4.");
    } catch (error) {
      setNoticeType("error");
      setNotice(
        error instanceof Error ? error.message : "\uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6">{"\uBD88\uB7EC\uC624\uB294 \uC911..."}</div>;
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
              <Label className="text-xs">{"\uC870\uC9C1\uCF54\uB4DC"}</Label>
              <Input
                className="h-9 w-36"
                value={searchCode}
                onChange={(event) => setSearchCode(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{"\uC870\uC9C1\uBA85"}</Label>
              <Input
                className="h-9 w-44"
                value={searchName}
                onChange={(event) => setSearchName(event.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{"\uAE30\uC900\uC77C\uC790"}</Label>
              <Input
                type="date"
                className="h-9 w-40"
                value={referenceDate}
                onChange={(event) => setReferenceDate(event.target.value)}
              />
            </div>
            <Button className="h-9 px-5" onClick={runSearch}>
              {"\uC870\uD68C"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{"\uC870\uC9C1\uCF54\uB4DC\uAD00\uB9AC"}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" onClick={startCreate} disabled={saving}>
              {"\uC785\uB825"}
            </Button>
            <Button onClick={saveDepartment} disabled={saving}>
              {"\uC800\uC7A5"}
            </Button>
            <Button variant="destructive" onClick={removeDepartment} disabled={saving || !selectedDepartmentId}>
              {"\uC0AD\uC81C"}
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
                      <th className="border px-2 py-2 text-center">{"\uC0C1\uD0DC"}</th>
                      <th className="border px-2 py-2 text-left">{"\uC870\uC9C1\uCF54\uB4DC"}</th>
                      <th className="border px-2 py-2 text-left">{"\uC870\uC9C1\uBA85"}</th>
                      <th className="border px-2 py-2 text-left">{"\uC0C1\uC704\uC870\uC9C1"}</th>
                      <th className="border px-2 py-2 text-center">{"\uC0AC\uC6A9\uC5EC\uBD80"}</th>
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
                              ? "\uC0AC\uC6A9"
                              : "\uBBF8\uC0AC\uC6A9"}
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
                          {"\uC870\uD68C\uB41C \uC870\uC9C1\uC774 \uC5C6\uC2B5\uB2C8\uB2E4."}
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
                    ? "\uC2E0\uADDC \uC870\uC9C1 \uC785\uB825"
                    : "\uC870\uC9C1 \uC0C1\uC138"}
                </h3>

                <div className="space-y-2">
                  <Label>{"\uC870\uC9C1\uCF54\uB4DC"}</Label>
                  <Input
                    value={form.code}
                    onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{"\uC870\uC9C1\uBA85"}</Label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{"\uC0C1\uC704\uC870\uC9C1"}</Label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                    value={form.parent_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, parent_id: event.target.value }))}
                  >
                    <option value="">{"(\uCD5C\uC0C1\uC704)"}</option>
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
                  {"\uC0AC\uC6A9\uC5EC\uBD80"}
                </label>

                {!isCreateMode && selectedDepartment ? (
                  <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                    <p>
                      {"\uC0DD\uC131\uC77C"}: {new Date(selectedDepartment.created_at).toLocaleString()}
                    </p>
                    <p>
                      {"\uC218\uC815\uC77C"}: {new Date(selectedDepartment.updated_at).toLocaleString()}
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
