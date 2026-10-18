"use client";

import type { ColDef } from "ag-grid-community";
import { useAuth } from "@/components/auth/auth-provider";
import { BatchGridManager, type BatchGridRow } from "@/components/grid/batch-grid-manager";
import type { HriFormTypeItem } from "@/types/hri";

type Row = BatchGridRow<HriFormTypeItem>;
const columns: ColDef<Row>[] = [
  { field: "form_code", headerName: "신청서 코드", minWidth: 160, valueParser: p => String(p.newValue ?? "").trim().toUpperCase() },
  { field: "form_name_ko", headerName: "신청서명", minWidth: 180, flex: 1 },
  { field: "form_name_en", headerName: "영문명", minWidth: 160 },
  { field: "module_code", headerName: "모듈", width: 120, valueParser: p => String(p.newValue ?? "").trim().toUpperCase() },
  { field: "default_priority", headerName: "우선순위", width: 110, cellDataType: "number" },
  ...([['is_active','사용'],['allow_draft','임시저장'],['allow_withdraw','회수 허용'],['requires_receive','수신 필요']] as const).map(([field, headerName]) => ({ field, headerName, width: 110, cellDataType: "boolean" })),
];
const toItem = (row: HriFormTypeItem) => ({ form_code: row.form_code.trim().toUpperCase(), form_name_ko: row.form_name_ko.trim(), form_name_en: row.form_name_en?.trim() || null, module_code: row.module_code.trim().toUpperCase() || "COMMON", default_priority: row.default_priority, is_active: row.is_active, allow_draft: row.allow_draft, allow_withdraw: row.allow_withdraw, requires_receive: row.requires_receive });
const newRow = (id: number): HriFormTypeItem => ({ id, form_code: "", form_name_ko: "", form_name_en: null, module_code: "COMMON", default_priority: 50, is_active: true, allow_draft: true, allow_withdraw: true, requires_receive: false, created_at: "", updated_at: "", created_by: null, updated_by: null });
function validate(row: HriFormTypeItem) {
  if (!row.form_code.trim() || !row.form_name_ko.trim()) return "신청서 코드와 신청서명을 입력해 주세요.";
  if (row.form_code.length > 30 || row.form_name_ko.length > 100 || (row.form_name_en?.length ?? 0) > 100 || row.module_code.length > 30) return "코드/모듈은 30자, 신청서명은 100자 이하로 입력해 주세요.";
  return Number.isInteger(row.default_priority) ? null : "우선순위를 정수로 입력해 주세요.";
}
export function HriFormTypeManager() {
  const { user } = useAuth();
  return <div className="business-workspace"><BatchGridManager title="신청서 코드" listUrl="/api/hri/form-types" saveUrl="/api/hri/form-types/batch" columns={columns} newRow={newRow} toItem={toItem} validate={validate} canSave={Boolean(user?.roles.some(role => ["hr_manager", "admin"].includes(role)))} searchText={row => `${row.form_code} ${row.form_name_ko} ${row.form_name_en ?? ""} ${row.module_code}`} searchPlaceholder="코드, 신청서명, 모듈 검색" copyRow={(row, id) => ({ ...row, id, form_code: `${row.form_code}_COPY`, form_name_ko: `${row.form_name_ko} 복사` })} /></div>;
}
