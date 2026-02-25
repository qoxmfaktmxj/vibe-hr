"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import type { ColDef } from "ag-grid-community";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MngSimpleGrid } from "@/components/mng/mng-simple-grid";
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

  const { data: companyData } = useSWR<MngCompanyDropdownResponse>("/api/mng/companies/dropdown", fetcher, {
    revalidateOnFocus: false,
  });
  const { data: masterData, mutate: mutateMasters } = useSWR<MngInfraMasterListResponse>(
    "/api/mng/infra-masters",
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
  const masterColumnDefs: ColDef<MngInfraMasterItem>[] = [
    { field: "company_name", headerName: "고객사", width: 170 },
    { field: "service_type", headerName: "서비스구분", width: 150 },
    {
      field: "env_type",
      headerName: "환경",
      width: 110,
      cellRenderer: (params: { value?: string }) =>
        params.value === "prod" ? "운영(prod)" : "개발(dev)",
    },
  ];
  const configColumnDefs: ColDef<MngInfraConfigItem>[] = [
    { field: "section", headerName: "섹션", width: 150 },
    { field: "config_key", headerName: "키", width: 180 },
    { field: "config_value", headerName: "값", flex: 1, minWidth: 180 },
    { field: "sort_order", headerName: "정렬", width: 90 },
  ];

  async function createMaster() {
    if (!masterForm.company_id || !masterForm.service_type.trim()) {
      toast.error("고객사/서비스구분은 필수입니다.");
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
    if (!confirm("선택한 인프라 마스터를 삭제할까요? 하위 구성이 함께 삭제됩니다.")) return;
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
      await mutateMasters();
      await mutateConfigs();
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
      toast.error("섹션/키는 필수입니다.");
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
    <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-6">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>인프라 마스터 등록</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            value={masterForm.company_id}
            onChange={(event) => setMasterForm((prev) => ({ ...prev, company_id: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
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
            placeholder="서비스구분"
          />
          <select
            value={masterForm.env_type}
            onChange={(event) => setMasterForm((prev) => ({ ...prev, env_type: event.target.value }))}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="dev">개발</option>
            <option value="prod">운영</option>
          </select>
          <Button variant="save" onClick={() => void createMaster()} disabled={saving}>
            마스터 등록
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-4">
        <CardHeader>
          <CardTitle>인프라 마스터 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <MngSimpleGrid<MngInfraMasterItem>
              rowData={masters}
              columnDefs={masterColumnDefs}
              onRowClick={(row) => setSelectedMasterId(row.id)}
              getRowId={(row) => String(row.id)}
              selectedRowId={selectedMasterId ? String(selectedMasterId) : null}
              height={280}
            />
            <div className="flex flex-wrap gap-2">
              {masters.map((item) => (
                <Button
                  key={item.id}
                  size="sm"
                  variant="outline"
                  onClick={() => void deleteMaster(item)}
                  disabled={saving}
                >
                  {item.company_name ?? "마스터"}{" "}
                  <Badge variant={item.env_type === "prod" ? "destructive" : "secondary"} className="ml-1">
                    {item.env_type}
                  </Badge>
                  <span className="ml-1">삭제</span>
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-6">
        <CardHeader>
          <CardTitle>인프라 구성 상세 {selectedMaster ? `(${selectedMaster.company_name} / ${selectedMaster.env_type})` : ""}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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

          <MngSimpleGrid<MngInfraConfigItem>
            rowData={configs}
            columnDefs={configColumnDefs}
            getRowId={(row) => String(row.id)}
            height={280}
          />
          <div className="flex flex-wrap gap-2">
            {configs.map((item) => (
              <Button key={item.id} size="sm" variant="outline" onClick={() => void deleteConfig(item)} disabled={saving}>
                {item.section}/{item.config_key} 삭제
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
