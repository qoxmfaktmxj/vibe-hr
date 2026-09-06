"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export function LogoutButton({ showLabel = false }: { showLabel?: boolean }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const handleLogout = async () => {
    setIsSubmitting(true);
    setError(false);
    try {
      await logout();
      router.replace("/login");
    } catch {
      setError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
    <Button
      variant={showLabel ? "ghost" : "outline"}
      className={showLabel ? "min-h-11 w-full justify-start gap-3 px-3 text-sm font-medium" : "border-border text-muted-foreground"}
      disabled={isSubmitting}
      onClick={handleLogout}
      type="button"
      aria-label={isSubmitting ? "로그아웃 중" : "로그아웃"}
      title={isSubmitting ? "로그아웃 중" : "로그아웃"}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {showLabel ? (isSubmitting ? "로그아웃 중..." : "로그아웃") : null}
    </Button>
    {error ? <p role="alert" className="px-3 py-2 text-xs text-destructive">로그아웃하지 못했습니다. 다시 시도해 주세요.</p> : null}
    </div>
  );
}
