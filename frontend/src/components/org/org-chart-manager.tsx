"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Building2, Search, RefreshCcw } from "lucide-react";

import { buildOrgChartForest, type OrgChartNode } from "@/lib/org/org-chart-tree";
import type { OrganizationChartResponse, OrganizationDepartmentItem } from "@/types/organization";

type LoadState = "loading" | "ready" | "empty" | "error";

type NodeView = OrgChartNode & {
  children: NodeView[];
};

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function matchesDepartment(department: OrganizationDepartmentItem, query: string) {
  if (!query) return true;

  const status = department.is_active ? "active 활성" : "inactive 비활성";
  const headcount = String(department.employee_count);

  return [
    department.code,
    department.name,
    department.organization_type ?? "",
    department.cost_center_code ?? "",
    department.description ?? "",
    department.parent_name ?? "",
    status,
    headcount,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function filterTree(nodes: OrgChartNode[], query: string): NodeView[] {
  return nodes
    .map((node) => {
      const children = filterTree(node.children, query);
      const selfMatches = matchesDepartment(node.department, query);
      if (!selfMatches && children.length === 0) return null;

      return {
        ...node,
        children,
      };
    })
    .filter((node): node is NodeView => node !== null);
}

function collectIds(nodes: OrgChartNode[]): number[] {
  const ids: number[] = [];

  const walk = (items: OrgChartNode[]) => {
    for (const item of items) {
      ids.push(item.department.id);
      walk(item.children);
    }
  };

  walk(nodes);
  return ids;
}

function DepartmentBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700 shadow-sm">
      <span className="font-medium text-slate-500">{label}</span>
      <span>{value}</span>
    </span>
  );
}

function OrgChartRow({
  node,
  depth,
  expandedIds,
  onToggle,
  forceExpand,
}: {
  node: NodeView;
  depth: number;
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
  forceExpand: boolean;
}) {
  const hasChildren = node.children.length > 0;
  const expanded = forceExpand || expandedIds.has(node.department.id);
  const statusLabel = node.department.is_active ? "사용" : "중지";
  const statusClass = node.department.is_active
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-100 text-slate-500";

  return (
    <div className="space-y-2">
      <div
        className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
        style={{ marginLeft: `${depth * 20}px` }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-700 transition hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
            onClick={() => onToggle(node.department.id)}
            disabled={!hasChildren}
            aria-label={`${node.department.name} ${expanded ? "접기" : "펼치기"}`}
          >
            {hasChildren ? (expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span className="h-2 w-2 rounded-full bg-slate-300" />}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-500" />
                <h3 className="truncate text-sm font-semibold text-slate-900">
                  {node.department.name}
                </h3>
              </div>
              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClass}`}>
                {statusLabel}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {node.department.code}
              {node.department.parent_name ? ` · 상위조직 ${node.department.parent_name}` : ""}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              <DepartmentBadge label="유형" value={node.department.organization_type ?? "미지정"} />
              <DepartmentBadge label="COST CENTER" value={node.department.cost_center_code ?? "미지정"} />
              <DepartmentBadge label="인원" value={`${node.department.employee_count.toLocaleString()}명`} />
            </div>
          </div>
        </div>
      </div>

      {hasChildren && expanded ? (
        <div className="space-y-2 border-l border-dashed border-slate-200 pl-2">
          {node.children.map((child) => (
            <OrgChartRow
              key={child.department.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              forceExpand={forceExpand}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OrgChartManager() {
  const [state, setState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("조직도를 불러오지 못했습니다.");
  const [departments, setDepartments] = useState<OrganizationDepartmentItem[]>([]);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const fetchChart = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/org/chart", {
      cache: "no-store",
      signal,
    });

    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as
        | { detail?: unknown; message?: unknown; error?: unknown }
        | null;
      const message =
        (typeof json?.detail === "string" && json.detail.trim()) ||
        (typeof json?.message === "string" && json.message.trim()) ||
        (typeof json?.error === "string" && json.error.trim()) ||
        "조직도를 불러오지 못했습니다.";
      throw new Error(message);
    }

    return (await response.json()) as OrganizationChartResponse;
  }, []);

  const refreshChart = useCallback(
    async (signal?: AbortSignal) => {
      setState("loading");
      try {
        const payload = await fetchChart(signal);
        const nextDepartments = payload.departments ?? [];

        setDepartments(nextDepartments);
        setExpandedIds(new Set(collectIds(buildOrgChartForest(nextDepartments))));
        setState(nextDepartments.length === 0 ? "empty" : "ready");
      } catch (error) {
        if (signal?.aborted) return;
        setErrorMessage(error instanceof Error ? error.message : "조직도를 불러오지 못했습니다.");
        setState("error");
      }
    },
    [fetchChart],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void refreshChart(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [refreshChart]);

  const forest = useMemo(() => buildOrgChartForest(departments), [departments]);
  const normalizedSearch = useMemo(() => normalize(search), [search]);
  const filteredForest = useMemo(
    () => (normalizedSearch ? filterTree(forest, normalizedSearch) : forest as NodeView[]),
    [forest, normalizedSearch],
  );
  const isSearchActive = normalizedSearch.length > 0;
  const totalCount = departments.length;
  const visibleCount = useMemo(() => collectIds(filteredForest).length, [filteredForest]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(collectIds(forest)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function retry() {
    void refreshChart();
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                Organization Chart
              </p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">조직도관리</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                조직코드관리에서 내려오는 부서를 조회만 할 수 있습니다. 검색과 펼치기/접기만 지원합니다.
              </p>
            </div>

            <a
              href="/org/departments"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              조직코드관리에서 편집
            </a>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 focus-within:border-slate-400">
              <Search className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="조직코드, 조직명, 유형, COST CENTER, 인원 검색"
                className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </label>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                전체 펼치기
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                전체 접기
              </button>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <RefreshCcw className="h-4 w-4" />
                다시 불러오기
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>총 {totalCount.toLocaleString()}개 부서</span>
            <span>·</span>
            <span>{isSearchActive ? `검색 결과 ${visibleCount.toLocaleString()}개` : "모든 부서를 표시합니다"}</span>
          </div>
        </section>

        <main className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {state === "loading" ? (
            <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
              조직도 데이터를 불러오는 중...
            </div>
          ) : state === "error" ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <p className="text-sm font-medium text-slate-900">조직도를 불러오지 못했습니다.</p>
              <p className="text-sm text-slate-500">{errorMessage}</p>
              <button
                type="button"
                onClick={retry}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                다시 시도
              </button>
            </div>
          ) : filteredForest.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm font-medium text-slate-900">
                {departments.length === 0 ? "조직도 데이터가 없습니다." : "검색 결과가 없습니다."}
              </p>
              <p className="text-sm text-slate-500">
                {departments.length === 0
                  ? "조직코드관리에서 부서를 추가한 뒤 다시 확인하세요."
                  : "검색어를 줄이거나 다른 키워드로 다시 시도하세요."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredForest.map((node) => (
                <OrgChartRow
                  key={node.department.id}
                  node={node}
                  depth={0}
                  expandedIds={expandedIds}
                  onToggle={toggleExpanded}
                  forceExpand={isSearchActive}
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
