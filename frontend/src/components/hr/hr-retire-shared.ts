import type { HrRetireCaseDetail } from "@/types/hr-retire";

function toErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value;
  if (value && typeof value === "object" && "detail" in value) {
    const detail = (value as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return fallback;
}

export async function parseError(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  return toErrorMessage(payload, fallback);
}

export function statusLabel(status: HrRetireCaseDetail["status"] | string): string {
  if (status === "draft") return "진행중";
  if (status === "confirmed") return "확정";
  if (status === "cancelled") return "취소";
  return status;
}
