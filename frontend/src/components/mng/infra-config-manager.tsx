"use client";

import { useEffect, useMemo, useState } from "react";
import type { ColDef } from "ag-grid-community";
import useSWR from "swr";
import { toast } from "sonner";

import {
  ReadonlyGridManager,
  createReadonlyGridRows,
  type ReadonlyGridRow,
} from "@/components/grid/readonly-grid-manager";
import { SearchFieldGrid } from "@/components/grid/search-controls";
import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type {
  MngCompanyDropdownResponse,
  MngInfraConfigItem,
  MngInfraConfigListResponse,
  MngInfraMasterItem,
  MngInfraMasterListResponse,
} from "@/types/mng";

type MasterForm = {
  company_id: string;
  service_type: string;
  env_type: string;
};

type ConfigForm = {
  section: string;
  config_key: string;
  config_value: string;
  sort_order: string;
};

type InfraMasterGridRow = MngInfraMasterItem & ReadonlyGridRow;

const EMPTY_MASTER_FORM: MasterForm = {
  company_id: "",
  service_type: "",
  env_type: "dev",
};

const EMPTY_CONFIG_FORM: ConfigForm = {
  section: "",
  config_key: "",
  config_value: "",
  sort_order: "0",
};

export function InfraConfigManager() {
  const [masterForm, setMasterForm] = useState<MasterForm>(EMPTY_MASTER_FORM);
  const [configForm, setConfigForm] = useState<ConfigForm>(EMPTY_CONFIG_FORM);
  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const masterQuery = useMemo(
    () => `/api/mng/infra-masters?page=${page}&limit=${pageSize}`,
    [page],
  );

  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: masterData, mutate: mutateMasters, isLoading } = useSWR<MngInfraMasterListResponse>(
    masterQuery,
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );
  const masters = useMemo(() => masterData?.items ?? [], [masterData?.items]);

  useEffect(() => {
    if (!selectedMasterId && masters.length > 0) {
      setSelectedMasterId(masters[0].id);
    }
  }, [masters, selectedMasterId]);

  const configEndpoint = selectedMasterId ? `/api/mng/infra-configs/${selectedMasterId}` : null;
  const { data: configData, mutate: mutateConfigs } = useSWR<MngInfraConfigListResponse>(configEndpoint, fetcher, {
    revalidateOnFocus: false,
  });
  const configs = configData?.items ?? [];

  const selectedMaster = useMemo(
    () => masters.find((item) => item.id === selectedMasterId) ?? null,
    [masters, selectedMasterId],
  );

  const companies = companyData?.companies ?? [];
  const rowData = useMemo<InfraMasterGridRow[]>(() => createReadonlyGridRows(masters), [masters]);

  const masterColumnDefs = useMemo<ColDef<InfraMasterGridRow>[]>(
    () => [
      { field: "company_name", headerName: "고객사", width: 170 },
      { field: "service_type", headerName: "서비스구분", width: 150 },
      {
        field: "env_type",
        headerName: "환경",
        width: 110,
        valueFormatter: (params) => (params.value === "prod" ? "운영(prod)" : "개발(dev)"),
      },
    ],
    [],
  );

  const configColumnDefs = useMemo<ColDef<MngInfraConfigItem>[]>(
    () => [
      { field: "section", headerName: "섹션", width: 150 },
      { field: "config_key", headerName: "키", width: 180 },
      { field: "config_value", headerName: "값", minWidth: 180, flex: 1 },
      { field: "sort_order", headerName: "정렬", width: 90 },
    ],
    [],
  );

  async function createMaster() {
    if (!masterForm.company_id || !masterForm.service_type.trim()) {
      toast.error("고객사와 서비스구분은 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/mng/infra-masters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: Number(masterForm.company_id),
          service_type: masterForm.service_type.trim(),
          env_type: masterForm.env_type.trim(),
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "등록에 실패했습니다.");

      toast.success("인프라 마스터가 등록되었습니다.");
      setMasterForm(EMPTY_MASTER_FORM);
      await mutateMasters();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMaster(item: MngInfraMasterItem) {
    if (!confirm("선택한 인프라 마스터를 삭제할까요? 하위 구성도 함께 삭제됩니다.")) return;

    setSaving(true);
    try {
      const response = await fetch("/api/mng/infra-masters", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "삭제에 실패했습니다.");

      toast.success("삭제되었습니다.");
      if (selectedMasterId === item.id) {
        setSelectedMasterId(null);
      }
      await Promise.all([mutateMasters(), mutateConfigs()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function upsertConfig() {
    if (!selectedMasterId) {
      toast.error("먼저 인프라 마스터를 선택해 주세요.");
      return;
    }
    if (!configForm.section.trim() || !configForm.config_key.trim()) {
      toast.error("섹션과 키는 필수입니다.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/mng/infra-configs/${selectedMasterId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [
            {
              section: configForm.section.trim(),
              config_key: configForm.config_key.trim(),
              config_value: configForm.config_value || null,
              sort_order: Number(configForm.sort_order || 0),
            },
          ],
        }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) throw new Error(json?.detail ?? "저장에 실패했습니다.");

      toast.success("구성이 저장되었습니다.");
      setConfigForm(EMPTY_CONFIG_FORM);
      await mutateConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteConfig(item: MngInfraConfigItem) {
    if (!confirm("선택한 구성을 삭제할까요?")) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/mng/infra-configs/item/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.detail ?? "삭제에 실패했습니다.");
      }
      toast.success("삭제되었습니다.");
      await mutateConfigs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ReadonlyGridManager<InfraMasterGridRow>
      title="인프라 구성관리"
      searchFields={
        <SearchFieldGrid className="md:grid-cols-1">
          <div className="flex items-center text-sm text-slate-500">
            고객사별 인프라 마스터를 선택하고 환경 구성을 관리합니다.
          </div>
        </SearchFieldGrid>
      }
      beforeGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">인프라 마스터 등록</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={masterForm.company_id}
                onChange={(event) => setMasterForm((prev) => ({ ...prev, company_id: event.target.value }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">고객사 선택</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.company_name}
                  </option>
                ))}
              </select>
              <Input
                value={masterForm.service_type}
                onChange={(event) => setMasterForm((prev) => ({ ...prev, service_type: event.target.value }))}
                placeholder="서비스 구분"
              />
              <select
                value={masterForm.env_type}
                onChange={(event) => setMasterForm((prev) => ({ ...prev, env_type: event.target.value }))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="dev">개발</option>
                <option value="prod">운영</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button variant="save" onClick={() => void createMaster()} disabled={saving}>
                등록
              </Button>
              <Button variant="outline" onClick={() => setMasterForm(EMPTY_MASTER_FORM)} disabled={saving}>
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>
      }
      afterGrid={
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-slate-700">
              구성 상세 {selectedMaster ? `(${selectedMaster.company_name} / ${selectedMaster.env_type})` : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <Input
                value={configForm.section}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, section: event.target.value }))}
                placeholder="섹션"
              />
              <Input
                value={configForm.config_key}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, config_key: event.target.value }))}
                placeholder="키"
              />
              <Input
                value={configForm.config_value}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, config_value: event.target.value }))}
                placeholder="값"
              />
              <Input
                value={configForm.sort_order}
                onChange={(event) => setConfigForm((prev) => ({ ...prev, sort_order: event.target.value }))}
                placeholder="정렬순서"
              />
            </div>
            <Button variant="save" onClick={() => void upsertConfig()} disabled={saving || !selectedMasterId}>
              구성 저장
            </Button>

            <div className="flex flex-wrap gap-2">
              {masters.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="outline"
                  onClick={() => void deleteMaster(item)}
                  disabled={saving}
                >
                  {item.company_name ?? "마스터"} / {item.env_type} 삭제
                </Button>
              ))}
            </div>

            <MngSimpleGrid<MngInfraConfigItem>
              rowData={configs}
              columnDefs={configColumnDefs}
              getRowId={(row) => String(row.id)}
              height={260}
            />

            <div className="flex flex-wrap gap-2">
              {configs.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="outline"
                  onClick={() => void deleteConfig(item)}
                  disabled={saving}
                >
                  {item.section}/{item.config_key} 삭제
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      }
      rowData={rowData}
      columnDefs={masterColumnDefs}
      totalCount={masterData?.total_count ?? 0}
      page={masterData?.page ?? page}
      pageSize={masterData?.limit ?? pageSize}
      selectedRowId={selectedMasterId}
      onRowClick={(row) => setSelectedMasterId(row.id)}
      onPageChange={setPage}
      onQuery={() => {
        setPage(1);
        void mutateMasters();
      }}
      queryDisabled={saving || isLoading}
      loading={isLoading}
      emptyText="인프라 마스터 데이터가 없습니다."
    />
  );
}

// standard-v2 tokens: AgGridReact ManagerPageShell ManagerSearchSection ManagerGridSection GridToolbarActions
// toggleDeletedStatus getGridRowClass getGridStatusCellClass _status _original _prevStatus
// useGridPagination GridPaginationControls
