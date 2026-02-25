"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { ColDef } from "ag-grid-community";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomDatePicker } from "@/components/ui/custom-date-picker";
import { Input } from "@/components/ui/input";
import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
import { fetcher } from "@/lib/fetcher";
import { HOLIDAY_DATE_KEYS } from "@/lib/holiday-data";
import type { MngCompanyItem, MngCompanyListResponse } from "@/types/mng";

type CompanyForm = {
  id: number | null;
  company_code: string;
  company_name: string;
  company_group_code: string;
  company_type: string;
  management_type: string;
  representative_company: string;
  start_date: string;
  is_active: boolean;
};

const EMPTY_FORM: CompanyForm = {
  id: null,
  company_code: "",
  company_name: "",
  company_group_code: "",
  company_type: "",
  management_type: "",
  representative_company: "",
  start_date: "",
  is_active: true,
};

function toForm(item: MngCompanyItem): CompanyForm {
  return {
    id: item.id,
    company_code: item.company_code,
    company_name: item.company_name,
    company_group_code: item.company_group_code ?? "",
    company_type: item.company_type ?? "",
    management_type: item.management_type ?? "",
    representative_company: item.representative_company ?? "",
    start_date: item.start_date ?? "",
    is_active: item.is_active,
  };
}

export function CompanyManager() {
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [form, setForm] = useState<CompanyForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const endpoint = useMemo(
    () => `/api/mng/companies${appliedSearch ? `?search=${encodeURIComponent(appliedSearch)}` : ""}`,
    [appliedSearch],
  );
  const { data, isLoading, mutate } = useSWR<MngCompanyListResponse>(endpoint, fetcher, {
    revalidateOnFocus: false,
  });
  const companies = data?.companies ?? [];
  const columnDefs = useMemo<ColDef<MngCompanyItem>[]>(
    () => [
      { field: "company_code", headerName: "회사코드", width: 120 },
      { field: "company_name", headerName: "회사명", flex: 1 },
      { field: "company_type", headerName: "회사구분", width: 140 },
      { field: "management_type", headerName: "관리구분", width: 140 },
      { field: "representative_company", headerName: "대표회사", width: 140 },
      { field: "start_date", headerName: "시작일", width: 120 },
      {
        field: "is_active",
        headerName: "사용",
        width: 90,
        valueFormatter: (params) => (params.value ? "Y" : "N"),
      },
    ],
    [],
  );

  function selectCompany(item: MngCompanyItem) {
    setForm(toForm(item));
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  async function saveCompany() {
    if (!form.company_name.trim()) {
      toast.error("회사명은 필수입니다.");
      return;
    }
    if (!form.id && !form.company_code.trim()) {
      toast.error("회사코드는 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : null),
        company_code: form.company_code.trim(),
        company_name: form.company_name.trim(),
        company_group_code: form.company_group_code || null,
        company_type: form.company_type || null,
        management_type: form.management_type || null,
        representative_company: form.representative_company || null,
        start_date: form.start_date || null,
        is_active: form.is_active,
      };
      const response = await fetch("/api/mng/companies", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.detail ?? "저장에 실패했습니다.");
      }
      toast.success("저장되었습니다.");
      await mutate();
      if (json?.company) {
        setForm(toForm(json.company as MngCompanyItem));
      } else {
        resetForm();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCompany() {
    if (!form.id) return;
    if (!confirm("선택한 고객사를 삭제할까요?")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mng/companies", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [form.id] }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.detail ?? "삭제에 실패했습니다.");
      }
      toast.success("삭제되었습니다.");
      resetForm();
      await mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader className="space-y-3">
          <CardTitle>고객사 목록</CardTitle>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="코드/회사명 검색"
              onKeyDown={(event) => {
                if (event.key === "Enter") setAppliedSearch(search.trim());
              }}
            />
            <Button variant="query" onClick={() => setAppliedSearch(search.trim())}>
              조회
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? <p className="text-sm text-muted-foreground">로딩 중...</p> : null}
          <MngSimpleGrid<MngCompanyItem>
            rowData={companies}
            columnDefs={columnDefs}
            onRowClick={selectCompany}
            getRowId={(row) => String(row.id)}
            selectedRowId={form.id ? String(form.id) : null}
            height={420}
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>고객사 상세</CardTitle>
          <Button variant="outline" onClick={resetForm}>
            신규
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input
              value={form.company_code}
              onChange={(event) => setForm((prev) => ({ ...prev, company_code: event.target.value }))}
              placeholder="회사코드"
              disabled={Boolean(form.id)}
            />
            <Input
              value={form.company_name}
              onChange={(event) => setForm((prev) => ({ ...prev, company_name: event.target.value }))}
              placeholder="회사명"
            />
            <Input
              value={form.company_group_code}
              onChange={(event) => setForm((prev) => ({ ...prev, company_group_code: event.target.value }))}
              placeholder="회사그룹코드"
            />
            <Input
              value={form.company_type}
              onChange={(event) => setForm((prev) => ({ ...prev, company_type: event.target.value }))}
              placeholder="회사구분"
            />
            <Input
              value={form.management_type}
              onChange={(event) => setForm((prev) => ({ ...prev, management_type: event.target.value }))}
              placeholder="관리구분"
            />
            <Input
              value={form.representative_company}
              onChange={(event) => setForm((prev) => ({ ...prev, representative_company: event.target.value }))}
              placeholder="대표회사"
            />
            <CustomDatePicker
              value={form.start_date}
              onChange={(value) => setForm((prev) => ({ ...prev, start_date: value }))}
              holidays={HOLIDAY_DATE_KEYS}
            />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              사용 여부
            </label>
          </div>
          <div className="flex gap-2">
            <Button variant="save" onClick={() => void saveCompany()} disabled={saving}>
              저장
            </Button>
            <Button variant="destructive" onClick={() => void deleteCompany()} disabled={saving || !form.id}>
              삭제
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
