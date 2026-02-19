"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ColDef, GridApi, GridReadyEvent, RowClickedEvent } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";

import { ensureAgGridRegistered } from "@/lib/ag-grid";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

ensureAgGridRegistered();

type CodeGroup = {
  id: number;
  groupCode: string;
  codeName: string;
  codeDescription: string;
  workType: string;
  category: string;
  isActive: boolean;
};

type CodeDetail = {
  id: number;
  groupId: number;
  detailCode: string;
  detailName: string;
  sortOrder: number;
  useType: "Y" | "N";
  note1: string;
  note2: string;
  note3: string;
  startDate: string;
  endDate: string;
};

const GROUP_ROWS: CodeGroup[] = [
  { id: 1, groupCode: "HR_ATTENDANCE", codeName: "근태구분", codeDescription: "근태 유형 공통코드", workType: "근태", category: "근태", isActive: true },
  { id: 2, groupCode: "HR_LEAVE", codeName: "휴가구분", codeDescription: "휴가 신청 유형", workType: "근태", category: "휴가", isActive: true },
  { id: 3, groupCode: "HR_WORK_TYPE", codeName: "근무형태", codeDescription: "근무 스케줄 관리", workType: "인사", category: "근무", isActive: true },
  { id: 4, groupCode: "HR_POSITION", codeName: "직위구분", codeDescription: "직위/직급 구분", workType: "인사", category: "직위", isActive: true },
  { id: 5, groupCode: "HR_EMP_STATUS", codeName: "재직상태", codeDescription: "입사/휴직/퇴사 상태", workType: "인사", category: "상태", isActive: true },
  { id: 6, groupCode: "PAY_ALLOWANCE", codeName: "수당코드", codeDescription: "급여 수당 구성", workType: "급여", category: "수당", isActive: true },
  { id: 7, groupCode: "PAY_DEDUCTION", codeName: "공제코드", codeDescription: "급여 공제 구성", workType: "급여", category: "공제", isActive: true },
  { id: 8, groupCode: "SYS_LANGUAGE", codeName: "언어코드", codeDescription: "다국어 지원 구성", workType: "시스템", category: "기타", isActive: false },
];

const DETAIL_ROWS: CodeDetail[] = [
  { id: 101, groupId: 1, detailCode: "PRESENT", detailName: "출근", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 102, groupId: 1, detailCode: "LATE", detailName: "지각", sortOrder: 20, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 103, groupId: 1, detailCode: "ABSENT", detailName: "결근", sortOrder: 30, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 201, groupId: 2, detailCode: "ANNUAL", detailName: "연차", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 202, groupId: 2, detailCode: "SICK", detailName: "병가", sortOrder: 20, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 301, groupId: 3, detailCode: "FULLTIME", detailName: "정규근무", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 302, groupId: 3, detailCode: "REMOTE", detailName: "재택근무", sortOrder: 20, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 401, groupId: 4, detailCode: "MANAGER", detailName: "매니저", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 501, groupId: 5, detailCode: "ACTIVE", detailName: "재직", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 502, groupId: 5, detailCode: "LEAVE", detailName: "휴직", sortOrder: 20, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 503, groupId: 5, detailCode: "RESIGNED", detailName: "퇴사", sortOrder: 30, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 601, groupId: 6, detailCode: "MEAL", detailName: "식대", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 602, groupId: 6, detailCode: "TRANSPORT", detailName: "교통비", sortOrder: 20, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 701, groupId: 7, detailCode: "NATIONAL_PENSION", detailName: "국민연금", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 702, groupId: 7, detailCode: "HEALTH_INSURANCE", detailName: "건강보험", sortOrder: 20, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 801, groupId: 8, detailCode: "KO", detailName: "한국어", sortOrder: 10, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
  { id: 802, groupId: 8, detailCode: "EN", detailName: "영어", sortOrder: 20, useType: "Y", note1: "", note2: "", note3: "", startDate: "2020-01-01", endDate: "9999-12-31" },
];

export function TimCommonCodeManager() {
  const [groupCodeKeyword, setGroupCodeKeyword] = useState("");
  const [groupNameKeyword, setGroupNameKeyword] = useState("");
  const [includedDetailKeyword, setIncludedDetailKeyword] = useState("");
  const [groupCategory, setGroupCategory] = useState("ALL");
  const [detailCodeKeyword, setDetailCodeKeyword] = useState("");
  const [detailNameKeyword, setDetailNameKeyword] = useState("");
  const [detailUseType, setDetailUseType] = useState<"ALL" | "Y" | "N">("ALL");
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(GROUP_ROWS[0]?.id ?? null);

  const groupGridApiRef = useRef<GridApi<CodeGroup> | null>(null);

  const groupDetailCountMap = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const detail of DETAIL_ROWS) {
      counts[detail.groupId] = (counts[detail.groupId] ?? 0) + 1;
    }
    return counts;
  }, []);

  const filteredGroups = useMemo(() => {
    const groupCodeQuery = groupCodeKeyword.trim().toLowerCase();
    const groupNameQuery = groupNameKeyword.trim().toLowerCase();
    const includedDetailQuery = includedDetailKeyword.trim().toLowerCase();

    return GROUP_ROWS.filter((group) => {
      const codeOk = !groupCodeQuery || group.groupCode.toLowerCase().includes(groupCodeQuery);
      const nameOk = !groupNameQuery || group.codeName.toLowerCase().includes(groupNameQuery);
      const categoryOk = groupCategory === "ALL" || group.category === groupCategory;
      const detailOk =
        !includedDetailQuery ||
        DETAIL_ROWS.some(
          (detail) =>
            detail.groupId === group.id && detail.detailName.toLowerCase().includes(includedDetailQuery),
        );

      return codeOk && nameOk && categoryOk && detailOk;
    });
  }, [groupCategory, groupCodeKeyword, groupNameKeyword, includedDetailKeyword]);

  const selectedGroup = useMemo(() => {
    if (selectedGroupId === null) return null;
    return filteredGroups.find((group) => group.id === selectedGroupId) ?? null;
  }, [filteredGroups, selectedGroupId]);

  const filteredDetails = useMemo(() => {
    if (!selectedGroup) return [];
    const codeQuery = detailCodeKeyword.trim().toLowerCase();
    const nameQuery = detailNameKeyword.trim().toLowerCase();

    return DETAIL_ROWS.filter((detail) => {
      if (detail.groupId !== selectedGroup.id) return false;
      const codeOk = !codeQuery || detail.detailCode.toLowerCase().includes(codeQuery);
      const nameOk = !nameQuery || detail.detailName.toLowerCase().includes(nameQuery);
      const useTypeOk = detailUseType === "ALL" || detail.useType === detailUseType;
      return codeOk && nameOk && useTypeOk;
    });
  }, [detailCodeKeyword, detailNameKeyword, detailUseType, selectedGroup]);

  useEffect(() => {
    if (!groupGridApiRef.current) return;
    groupGridApiRef.current.forEachNode((node) => {
      node.setSelected(node.data?.id === selectedGroupId);
    });
  }, [filteredGroups, selectedGroupId]);

  const groupColumnDefs = useMemo<ColDef<CodeGroup>[]>(
    () => [
      {
        headerName: "No",
        width: 72,
        sortable: false,
        filter: false,
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      },
      {
        headerName: "삭제",
        width: 70,
        sortable: false,
        filter: false,
        cellRenderer: () => <Checkbox checked={false} />,
      },
      {
        headerName: "상태",
        field: "isActive",
        width: 90,
        valueFormatter: (params) => (params.value ? "Y" : "N"),
      },
      { headerName: "그룹코드", field: "groupCode", width: 190 },
      { headerName: "코드명", field: "codeName", width: 190 },
      { headerName: "코드설명", field: "codeDescription", flex: 1, minWidth: 220 },
      { headerName: "업무구분", field: "workType", width: 120 },
      { headerName: "구분", field: "category", width: 110 },
      {
        headerName: "세부코드수",
        width: 110,
        valueGetter: (params) => (params.data ? (groupDetailCountMap[params.data.id] ?? 0) : 0),
      },
    ],
    [groupDetailCountMap],
  );

  const detailColumnDefs = useMemo<ColDef<CodeDetail>[]>(
    () => [
      {
        headerName: "No",
        width: 72,
        sortable: false,
        filter: false,
        valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
      },
      { headerName: "세부코드", field: "detailCode", width: 160 },
      { headerName: "세부코드명", field: "detailName", width: 180 },
      { headerName: "순서", field: "sortOrder", width: 90 },
      { headerName: "사용유무", field: "useType", width: 100 },
      { headerName: "비고1", field: "note1", width: 130 },
      { headerName: "비고2", field: "note2", width: 130 },
      { headerName: "비고3", field: "note3", width: 130 },
      { headerName: "시작일", field: "startDate", width: 120 },
      { headerName: "종료일", field: "endDate", width: 120 },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef>(() => ({ sortable: true, filter: true, resizable: true }), []);

  const onGroupGridReady = (event: GridReadyEvent<CodeGroup>) => {
    groupGridApiRef.current = event.api;
  };

  const onGroupRowClicked = (event: RowClickedEvent<CodeGroup>) => {
    if (!event.data) return;
    setSelectedGroupId(event.data.id);
  };

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            <div className="space-y-1">
              <Label className="text-xs">그룹코드</Label>
              <Input placeholder="그룹코드 입력" value={groupCodeKeyword} onChange={(event) => setGroupCodeKeyword(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">그룹코드명</Label>
              <Input placeholder="그룹코드명 입력" value={groupNameKeyword} onChange={(event) => setGroupNameKeyword(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">포함세부코드명</Label>
              <Input placeholder="포함 세부 코드명 입력" value={includedDetailKeyword} onChange={(event) => setIncludedDetailKeyword(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">구분</Label>
              <select
                className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                value={groupCategory}
                onChange={(event) => setGroupCategory(event.target.value)}
              >
                <option value="ALL">전체</option>
                <option value="근태">근태</option>
                <option value="휴가">휴가</option>
                <option value="인사">인사</option>
                <option value="급여">급여</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <div className="flex items-end justify-end">
              <Button className="w-full lg:w-auto">조회</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>그룹코드 관리</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">다운로드</Button>
            <Button variant="outline" size="sm">복사</Button>
            <Button variant="outline" size="sm">입력</Button>
            <Button size="sm">저장</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="ag-theme-alpine h-[290px] w-full rounded-md border">
            <AgGridReact<CodeGroup>
              rowData={filteredGroups}
              columnDefs={groupColumnDefs}
              defaultColDef={defaultColDef}
              rowSelection="single"
              getRowId={(params) => String(params.data.id)}
              onGridReady={onGroupGridReady}
              onRowClicked={onGroupRowClicked}
              overlayNoRowsTemplate="<span>조회된 그룹코드가 없습니다.</span>"
            />
          </div>
          <div className="mt-2 text-right text-sm text-slate-500">[{filteredGroups.length} / {GROUP_ROWS.length}]</div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs">세부코드</Label>
              <Input placeholder="세부코드 입력" value={detailCodeKeyword} onChange={(event) => setDetailCodeKeyword(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">세부코드명</Label>
              <Input placeholder="세부코드명 입력" value={detailNameKeyword} onChange={(event) => setDetailNameKeyword(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">사용유무</Label>
              <select
                className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm"
                value={detailUseType}
                onChange={(event) => setDetailUseType(event.target.value as "ALL" | "Y" | "N")}
              >
                <option value="ALL">전체</option>
                <option value="Y">Y</option>
                <option value="N">N</option>
              </select>
            </div>
            <div className="flex items-end justify-end">
              <Button className="w-full lg:w-auto">조회</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>세부코드 관리</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">다운로드</Button>
            <Button variant="outline" size="sm">복사</Button>
            <Button variant="outline" size="sm">입력</Button>
            <Button size="sm">저장</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="ag-theme-alpine h-[320px] w-full rounded-md border">
            <AgGridReact<CodeDetail>
              rowData={filteredDetails}
              columnDefs={detailColumnDefs}
              defaultColDef={defaultColDef}
              getRowId={(params) => String(params.data.id)}
              overlayNoRowsTemplate="<span>선택한 그룹코드의 세부코드가 없습니다.</span>"
            />
          </div>
          <div className="mt-2 text-right text-sm text-slate-500">
            [{filteredDetails.length} / {DETAIL_ROWS.filter((detail) => detail.groupId === selectedGroupId).length}]
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
