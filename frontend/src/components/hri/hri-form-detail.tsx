import type * as React from "react";

function DetailField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{value ?? "-"}</dd>
    </div>
  );
}

const CORRECTION_STATUS_LABEL: Record<string, string> = {
  present: "출근",
  late: "지각",
  absent: "결근",
  early_leave: "조퇴",
};

export function FormDetailView({
  formCode,
  data,
}: {
  formCode: string | null;
  data: Record<string, unknown>;
}) {
  if (formCode === "TIM_CORRECTION") {
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <DetailField label="정정 날짜" value={String(data.work_date ?? "-")} />
        <DetailField
          label="정정 전"
          value={CORRECTION_STATUS_LABEL[String(data.before_status ?? "")] ?? String(data.before_status ?? "-")}
        />
        <DetailField
          label="정정 후"
          value={CORRECTION_STATUS_LABEL[String(data.after_status ?? "")] ?? String(data.after_status ?? "-")}
        />
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason ?? "-")} />
        </div>
      </dl>
    );
  }

  if (formCode === "CERT_EMPLOYMENT") {
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <div className="col-span-2">
          <DetailField label="사용 목적" value={String(data.purpose ?? "-")} />
        </div>
        <DetailField label="발급 부수" value={`${String(data.copies ?? 1)}부`} />
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="제출처" value={String(data.recipient ?? "-")} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason ?? "-")} />
        </div>
      </dl>
    );
  }

  if (formCode === "LEAVE_REQUEST") {
    const mins = Number(data.applied_minutes ?? 0);
    const minsLabel = mins >= 480 ? `${mins / 480}일 (${mins}분)` : `${mins}분`;
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <DetailField label="휴가 유형" value={String(data.leave_type_code ?? "-")} />
        <DetailField label="차감" value={minsLabel} />
        <DetailField label="시작일" value={String(data.start_date ?? "-")} />
        <DetailField label="종료일" value={String(data.end_date ?? "-")} />
        {data.start_time != null && String(data.start_time) !== "" && (
          <DetailField label="시작 시간" value={String(data.start_time)} />
        )}
        {data.end_time != null && String(data.end_time) !== "" && (
          <DetailField label="종료 시간" value={String(data.end_time)} />
        )}
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason ?? "-")} />
        </div>
      </dl>
    );
  }

  // 기타 유형 - key-value 표
  if (formCode === "WEL_BENEFIT_REQUEST") {
    const requestedAmount = Number(data.requested_amount ?? 0);
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <DetailField
          label="복리후생 유형"
          value={String(data.benefit_type_name ?? data.benefit_type_code ?? "-")}
        />
        <DetailField label="유형 코드" value={String(data.benefit_type_code ?? "-")} />
        <DetailField label="신청 금액" value={`${requestedAmount.toLocaleString("ko-KR")}원`} />
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="신청 내용" value={String(data.description ?? "-")} />
        </div>
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason ?? "-")} />
        </div>
      </dl>
    );
  }

  const entries = Object.entries(data).filter(([k]) => k !== "reason");
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {entries.map(([k, v]) => (
        <DetailField key={k} label={k} value={String(v ?? "-")} />
      ))}
      {data.reason != null && (
        <div className="col-span-2 sm:col-span-3">
          <DetailField label="사유" value={String(data.reason)} />
        </div>
      )}
    </dl>
  );
}
