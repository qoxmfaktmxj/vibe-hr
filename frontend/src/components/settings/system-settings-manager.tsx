"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthSessionPolicy } from "@/types/system-setting";

export function SystemSettingsManager() {
  const [policy, setPolicy] = useState<AuthSessionPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string>("");

  async function load() {
    setLoading(true);
    setNotice("");
    try {
      const res = await fetch("/api/system-settings/auth-session", { cache: "no-store" });
      const data = (await res.json()) as { policy?: AuthSessionPolicy; detail?: string };
      if (!res.ok || !data.policy) {
        throw new Error(data.detail ?? "정책 조회 실패");
      }
      setPolicy(data.policy);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "정책 조회 실패");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    if (!policy) return;
    setSaving(true);
    setNotice("");
    try {
      const access = Math.max(5, Number(policy.access_ttl_min) || 120);
      const threshold = Math.max(1, Number(policy.refresh_threshold_min) || Math.floor(access / 2));
      const rememberTtl = Math.max(60, Number(policy.remember_ttl_min) || 60 * 24 * 30);

      const res = await fetch("/api/system-settings/auth-session", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_ttl_min: access,
          refresh_threshold_min: Math.min(access, threshold),
          remember_enabled: policy.remember_enabled,
          remember_ttl_min: rememberTtl,
          show_countdown: policy.show_countdown,
          reason: "system settings ui update",
        }),
      });
      const data = (await res.json()) as { policy?: AuthSessionPolicy; detail?: string };
      if (!res.ok || !data.policy) {
        throw new Error(data.detail ?? "저장 실패");
      }
      setPolicy(data.policy);
      setNotice("저장되었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>시스템기준관리 - 인증/세션</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !policy ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Access 토큰 만료(분)</Label>
                  <Input
                    type="number"
                    value={policy.access_ttl_min}
                    onChange={(e) => setPolicy({ ...policy, access_ttl_min: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>갱신 임계치(분)</Label>
                  <Input
                    type="number"
                    value={policy.refresh_threshold_min}
                    onChange={(e) => setPolicy({ ...policy, refresh_threshold_min: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remember 쿠키 만료(분)</Label>
                  <Input
                    type="number"
                    value={policy.remember_ttl_min}
                    onChange={(e) => setPolicy({ ...policy, remember_ttl_min: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Remember 허용</Label>
                  <input
                    type="checkbox"
                    checked={policy.remember_enabled}
                    onChange={(e) => setPolicy({ ...policy, remember_enabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
                <div className="space-y-2">
                  <Label>우측 상단 세션 카운트다운 표시</Label>
                  <input
                    type="checkbox"
                    checked={policy.show_countdown}
                    onChange={(e) => setPolicy({ ...policy, show_countdown: e.target.checked })}
                    className="h-4 w-4"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" onClick={save} disabled={saving}>
                  저장
                </Button>
                <Button type="button" variant="outline" onClick={() => void load()} disabled={loading || saving}>
                  새로고침
                </Button>
              </div>
            </>
          )}

          {notice ? <p className="text-sm text-muted-foreground">{notice}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
