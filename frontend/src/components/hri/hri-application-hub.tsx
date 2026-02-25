"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR, { mutate } from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetcher } from "@/lib/fetcher";
import type { HriFormTypeItem, HriFormTypeListResponse, HriRequestDetailResponse, HriRequestListResponse } from "@/types/hri";

function buildContent(form: HriFormTypeItem | null, values: Record<string, string>) {
  if (!form) return {};
  if (form.form_code === "TIM_CORRECTION") {
    return {
      work_date: values.work_date,
      before_status: values.before_status,
      after_status: values.after_status,
      reason: values.reason,
    };
  }
  if (form.form_code === "CERT_EMPLOYMENT") {
    return {
      purpose: values.purpose,
      copies: Number(values.copies || "1"),
      recipient: values.recipient,
      reason: values.reason,
    };
  }
  return {
    detail: values.detail,
    reason: values.reason,
  };
}

export function HriApplicationHub() {
  const [open, setOpen] = useState(false);
  const [selectedFormTypeId, setSelectedFormTypeId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({
    work_date: "",
    before_status: "present",
    after_status: "absent",
    reason: "",
    purpose: "",
    copies: "1",
    recipient: "",
    detail: "",
  });

  const { data: formData } = useSWR<HriFormTypeListResponse>("/api/hri/form-types", fetcher, { revalidateOnFocus: false });
  const { data: myData } = useSWR<HriRequestListResponse>("/api/hri/requests/my", fetcher, { revalidateOnFocus: false });

  const formTypes = useMemo(() => (formData?.items ?? []).filter((item) => item.is_active), [formData?.items]);
  const selectedForm = useMemo(
    () => formTypes.find((item) => item.id === selectedFormTypeId) ?? null,
    [formTypes, selectedFormTypeId],
  );

  const resetModal = useCallback(() => {
    setOpen(false);
    setSelectedFormTypeId(null);
    setTitle("");
    setValues({
      work_date: "",
      before_status: "present",
      after_status: "absent",
      reason: "",
      purpose: "",
      copies: "1",
      recipient: "",
      detail: "",
    });
  }, []);

  async function saveAndSubmit() {
    if (!selectedForm || !title.trim()) {
      alert("신청서 유형과 제목을 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const draftRes = await fetch("/api/hri/requests/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_id: null,
          form_type_id: selectedForm.id,
          title: title.trim(),
          content_json: buildContent(selectedForm, values),
        }),
      });
      const draftJson = (await draftRes.json().catch(() => null)) as HriRequestDetailResponse | { detail?: string } | null;
      if (!draftRes.ok || !draftJson || !("request" in draftJson)) {
        throw new Error((draftJson as { detail?: string } | null)?.detail ?? "임시저장 실패");
      }

      const submitRes = await fetch(`/api/hri/requests/${draftJson.request.id}/submit`, { method: "POST" });
      const submitJson = (await submitRes.json().catch(() => null)) as { detail?: string } | null;
      if (!submitRes.ok) {
        throw new Error(submitJson?.detail ?? "결재신청 실패");
      }

      await mutate("/api/hri/requests/my");
      resetModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : "요청 처리 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">신청 허브</h2>
        <Button onClick={() => setOpen(true)}>신청서 작성</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3 text-sm font-semibold">내 신청 내역</div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2">문서번호</th>
                <th className="py-2">신청서</th>
                <th className="py-2">제목</th>
                <th className="py-2">상태</th>
                <th className="py-2">작성일</th>
              </tr>
            </thead>
            <tbody>
              {(myData?.items ?? []).map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.request_no}</td>
                  <td className="py-2">{item.form_name ?? "-"}</td>
                  <td className="py-2">{item.title}</td>
                  <td className="py-2">{item.status_code}</td>
                  <td className="py-2">{item.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[70]">
          <button className="absolute inset-0 bg-black/40" onClick={resetModal} aria-label="닫기" />
          <div className="absolute inset-x-10 top-8 bottom-8 rounded-xl border bg-card p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold">신청서 작성</h3>
              <Button variant="ghost" onClick={resetModal}>닫기</Button>
            </div>

            <div className="grid h-[calc(100%-56px)] grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3 overflow-y-auto pr-1">
                <div className="flex flex-wrap gap-2">
                  {formTypes.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      size="sm"
                      variant={selectedFormTypeId === item.id ? "default" : "outline"}
                      onClick={() => setSelectedFormTypeId(item.id)}
                    >
                      {item.form_name_ko}
                    </Button>
                  ))}
                </div>

                <Input placeholder="제목" value={title} onChange={(e) => setTitle(e.target.value)} />

                {selectedForm?.form_code === "TIM_CORRECTION" ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Input type="date" value={values.work_date} onChange={(e) => setValues((p) => ({ ...p, work_date: e.target.value }))} />
                    <select className="h-9 rounded-md border bg-card px-2 text-sm" value={values.before_status} onChange={(e) => setValues((p) => ({ ...p, before_status: e.target.value }))}>
                      <option value="present">present</option><option value="late">late</option><option value="absent">absent</option>
                    </select>
                    <select className="h-9 rounded-md border bg-card px-2 text-sm" value={values.after_status} onChange={(e) => setValues((p) => ({ ...p, after_status: e.target.value }))}>
                      <option value="present">present</option><option value="late">late</option><option value="absent">absent</option>
                    </select>
                  </div>
                ) : null}

                {selectedForm?.form_code === "CERT_EMPLOYMENT" ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <Input placeholder="사용 목적" value={values.purpose} onChange={(e) => setValues((p) => ({ ...p, purpose: e.target.value }))} />
                    <Input type="number" placeholder="발급부수" value={values.copies} onChange={(e) => setValues((p) => ({ ...p, copies: e.target.value }))} />
                    <Input placeholder="제출처" value={values.recipient} onChange={(e) => setValues((p) => ({ ...p, recipient: e.target.value }))} />
                  </div>
                ) : null}

                {selectedForm && selectedForm.form_code !== "TIM_CORRECTION" && selectedForm.form_code !== "CERT_EMPLOYMENT" ? (
                  <Input placeholder="상세 내용" value={values.detail} onChange={(e) => setValues((p) => ({ ...p, detail: e.target.value }))} />
                ) : null}

                <textarea
                  className="min-h-28 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                  placeholder="신청 사유"
                  value={values.reason}
                  onChange={(e) => setValues((p) => ({ ...p, reason: e.target.value }))}
                />
              </div>

              <div className="flex flex-col rounded-lg border bg-muted/20 p-3">
                <p className="text-sm font-semibold">결재 미리보기</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  제출 시 템플릿 기반 결재선이 자동 적용됩니다.
                </p>
                <div className="mt-auto flex gap-2">
                  <Button className="flex-1" variant="outline" disabled={saving} onClick={resetModal}>취소</Button>
                  <Button className="flex-1" disabled={saving} onClick={saveAndSubmit}>결재신청</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
