import type {
  OrgMappingAssignmentCreateRequest,
  OrgMappingAssignmentItem,
  OrganizationLookupItem,
} from "@/types/organization";

export type LookupEditorOption = {
  value: string;
  label: string;
};

type LookupResponse = {
  items?: OrganizationLookupItem[];
  departments?: OrganizationLookupItem[];
  options?: OrganizationLookupItem[];
};

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeCode(value: unknown): string {
  return normalizeText(value).toUpperCase();
}

function normalizeRequiredDate(value: unknown): string {
  return normalizeText(value).slice(0, 10);
}

function normalizeOptionalDate(value: unknown): string | null {
  const text = normalizeText(value).slice(0, 10);
  return text.length > 0 ? text : null;
}

function toLookupItems(payload: LookupResponse | null | undefined): OrganizationLookupItem[] {
  return payload?.items ?? payload?.departments ?? payload?.options ?? [];
}

export function buildLookupEditorOptions(items: OrganizationLookupItem[]): LookupEditorOption[] {
  return items
    .filter((item) => item.id != null)
    .map((item) => ({
      value: String(item.id),
      label: `${item.code} / ${item.name}`,
    }));
}

export function createSavePayload(
  row: Pick<
    OrgMappingAssignmentItem,
    "department_id" | "type_code" | "item_id" | "effective_from" | "effective_to"
  >,
): OrgMappingAssignmentCreateRequest {
  return {
    department_id: row.department_id,
    type_code: normalizeCode(row.type_code),
    item_id: row.item_id,
    effective_from: normalizeRequiredDate(row.effective_from),
    effective_to: normalizeOptionalDate(row.effective_to),
  };
}

export async function loadDepartmentLookupOptions(
  fetchImpl: typeof fetch = fetch,
): Promise<OrganizationLookupItem[] | null> {
  try {
    const response = await fetchImpl("/api/org/department-options", { cache: "no-store" });
    if (!response.ok) return null;
    return toLookupItems((await response.json().catch(() => null)) as LookupResponse | null);
  } catch {
    return null;
  }
}

export async function loadMappingItemLookupOptions(
  typeCodeInput: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OrganizationLookupItem[] | null> {
  const typeCode = normalizeCode(typeCodeInput);
  if (!typeCode) return null;

  try {
    const params = new URLSearchParams({ type_code: typeCode });
    const response = await fetchImpl(`/api/org/mapping-item-options?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) return null;
    return toLookupItems((await response.json().catch(() => null)) as LookupResponse | null);
  } catch {
    return null;
  }
}
