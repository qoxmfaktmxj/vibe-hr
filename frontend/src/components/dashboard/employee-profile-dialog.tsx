"use client";

import { Loader2, RefreshCcw, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { EmployeeItem } from "@/types/employee";

import styles from "./employee-profile-dialog.module.css";

const ROLE_LABELS: Record<string, string> = { admin: "관리자", employee: "구성원", user: "사용자" };
const STATUS_LABELS: Record<string, string> = { active: "재직", leave: "휴직", resigned: "퇴사" };

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.field}><dt className={styles.fieldLabel}>{label}</dt><dd className={styles.fieldValue}>{children || "-"}</dd></div>;
}

export function EmployeeProfileDialog({ open, onOpenChange, returnFocusRef }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<{ userId: number | undefined; employee: EmployeeItem } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const employee = profile?.userId === user?.id ? profile?.employee ?? null : null;
  const displayName = employee?.display_name ?? user?.display_name ?? "내 정보";
  const initials = displayName.split(/\s+/).map((word) => word[0]).join("").toUpperCase().slice(0, 2) || "U";
  const roles = [...new Set((user?.roles ?? []).map((role) => ROLE_LABELS[role] ?? role))];

  const loadProfile = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setProfile(null);
    setLoadedAt(null);
    try {
      const response = await fetch("/api/employees/me", { cache: "no-store", signal: controller.signal });
      const json = (await response.json().catch(() => null)) as { employee?: EmployeeItem | null } | null;
      if (controller.signal.aborted) return;
      if (!response.ok || !json || !("employee" in json)) throw new Error("Profile unavailable");
      if (json.employee) {
        setProfile({ userId: user?.id, employee: json.employee });
        setLoadedAt(new Date());
      }
    } catch (fetchError) {
      if (controller.signal.aborted) return;
      setError(fetchError instanceof TypeError
        ? "네트워크 연결을 확인한 뒤 다시 시도해 주세요."
        : "프로필 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    void loadProfile();
    return () => requestRef.current?.abort();
  }, [loadProfile, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose={false} className={`${styles.content} p-0`} onCloseAutoFocus={(event) => {
        if (returnFocusRef?.current) {
          event.preventDefault();
          returnFocusRef.current.focus();
        }
      }}>
        <div className={styles.shell}>
          <div className={styles.hero}>
            <div className={styles.identityRow}>
              <Avatar className={styles.avatar}><AvatarFallback className={styles.avatarFallback}>{initials}</AvatarFallback></Avatar>
              <div className={styles.identityCopy}>
                <div className={styles.identityHeader}>
                  <DialogTitle className={styles.title}>{displayName}</DialogTitle>
                  <Image src="/vibehr_mark.svg" alt="" width={24} height={24} className={styles.brandMark} aria-hidden="true" />
                </div>
                <p className={styles.description}>{employee ? [employee.department_name, employee.position_title].filter(Boolean).join(" / ") : "내 정보"}</p>
                <DialogDescription className="sr-only">현재 로그인한 구성원의 기본 정보와 계정 정보를 조회합니다.</DialogDescription>
              </div>
            </div>
            <DialogClose asChild><Button type="button" variant="ghost" size="icon" className={styles.closeButton} aria-label="프로필 닫기"><X className="h-4 w-4" aria-hidden="true" /></Button></DialogClose>
          </div>
          <div className={styles.body}>
            {loading ? (
              <div className={styles.state} role="status"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /><p>프로필을 불러오는 중입니다.</p></div>
            ) : error ? (
              <div className={styles.state} role="alert"><p>{error}</p><Button type="button" variant="outline" className="min-h-11" onClick={() => void loadProfile()}><RefreshCcw className="h-4 w-4" aria-hidden="true" />다시 시도</Button></div>
            ) : employee ? (
              <div className={styles.sections}>
                <section aria-labelledby="employee-profile-basic">
                  <h3 id="employee-profile-basic" className={styles.sectionTitle}>기본 정보</h3>
                  <dl className={styles.definitionList}>
                    <ProfileField label="사번">{employee.employee_no}</ProfileField>
                    <ProfileField label="부서">{employee.department_name}</ProfileField>
                    <ProfileField label="직책">{employee.position_title}</ProfileField>
                    <ProfileField label="입사일">{employee.hire_date}</ProfileField>
                    <ProfileField label="재직 상태"><span className={styles.statusBadge}>{STATUS_LABELS[employee.employment_status] ?? employee.employment_status}</span></ProfileField>
                  </dl>
                </section>
                <section aria-labelledby="employee-profile-account">
                  <h3 id="employee-profile-account" className={styles.sectionTitle}>계정 정보</h3>
                  <dl className={styles.definitionList}>
                    <ProfileField label="로그인 ID">{employee.login_id}</ProfileField>
                    <ProfileField label="이메일">{employee.email || user?.email}</ProfileField>
                    <ProfileField label="권한">{roles.join(", ")}</ProfileField>
                    <ProfileField label="로그인 활성">{employee.is_active ? "사용 가능" : "사용 중지"}</ProfileField>
                  </dl>
                </section>
              </div>
            ) : (
              <div className={styles.state} role="status"><p>현재 계정에 연결된 사원 정보가 없습니다. 사내 인사 담당자에게 확인해 주세요.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => void loadProfile()}><RefreshCcw className="h-4 w-4" aria-hidden="true" />다시 시도</Button></div>
            )}
            <div className={styles.footer}>
              <p>조회 전용입니다. 정보 수정은 사내 인사 담당자에게 문의해 주세요.</p>
              {loadedAt ? <p className="mt-1">최근 조회 {new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(loadedAt)}</p> : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
