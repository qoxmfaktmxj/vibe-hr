import type { DepartmentItem } from "@/types/employee";

export function parseEmployeePasteValue(field: string, raw: string, departments: DepartmentItem[], positions: string[]): unknown {
  const value = raw.trim();
  if (field === "department_id") {
    const matches = departments.filter((item) => [String(item.id), item.code.toLowerCase(), item.name.toLowerCase()].includes(value.toLowerCase()));
    if (matches.length !== 1) throw new Error("등록된 부서 코드 또는 부서명을 입력하세요.");
    return matches[0].id;
  }
  if (field === "employment_status") {
    const statuses: Record<string, string> = { active: "active", leave: "leave", resigned: "resigned", 재직: "active", 휴직: "leave", 퇴직: "resigned" };
    if (!statuses[value.toLowerCase()]) throw new Error("재직, 휴직, 퇴직 중 하나를 입력하세요.");
    return statuses[value.toLowerCase()];
  }
  if (field === "is_active") {
    if (["y", "true", "1", "활성"].includes(value.toLowerCase())) return true;
    if (["n", "false", "0", "비활성"].includes(value.toLowerCase())) return false;
    throw new Error("Y 또는 N을 입력하세요.");
  }
  if (field === "hire_date") {
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("실제 날짜를 YYYY-MM-DD 형식으로 입력하세요.");
  }
  if (field === "display_name" && value.length < 2) throw new Error("이름은 2자 이상 입력하세요.");
  if (field === "position_title" && (!value || (positions.length > 0 && !positions.includes(value)))) throw new Error("등록된 직책을 입력하세요.");
  return field === "password" ? raw : value;
}
