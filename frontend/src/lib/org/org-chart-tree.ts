import type { OrganizationDepartmentItem } from "@/types/organization";

export type OrgChartNode = {
  department: OrganizationDepartmentItem;
  children: OrgChartNode[];
};

function reaches(startId: number, candidateId: number, nodes: Map<number, OrgChartNode>): boolean {
  const visited = new Set<number>();
  let currentId: number | null = candidateId;

  while (currentId !== null && !visited.has(currentId)) {
    if (currentId === startId) return true;
    visited.add(currentId);
    currentId = nodes.get(currentId)?.department.parent_id ?? null;
  }

  return false;
}

export function buildOrgChartForest(departments: OrganizationDepartmentItem[]): OrgChartNode[] {
  const uniqueDepartments = new Map<number, OrganizationDepartmentItem>();

  for (const department of departments) {
    if (!uniqueDepartments.has(department.id)) {
      uniqueDepartments.set(department.id, department);
    }
  }

  const nodes = new Map<number, OrgChartNode>();
  for (const department of uniqueDepartments.values()) {
    nodes.set(department.id, { department, children: [] });
  }

  const roots: OrgChartNode[] = [];

  for (const department of uniqueDepartments.values()) {
    const node = nodes.get(department.id);
    if (!node) continue;

    const parentId = department.parent_id;
    const parent = parentId === null ? undefined : nodes.get(parentId);

    if (!parent || parent === node || reaches(department.id, parent.department.id, nodes)) {
      roots.push(node);
      continue;
    }

    parent.children.push(node);
  }

  return roots;
}
