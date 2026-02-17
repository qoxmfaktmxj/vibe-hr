"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();
  const { logout } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = async () => {
    setIsSubmitting(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Button
      variant="outline"
      className="gap-2 border-gray-200 text-gray-600"
      disabled={isSubmitting}
      onClick={handleLogout}
      type="button"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {isSubmitting ? "로그아웃 중..." : "로그아웃"}
    </Button>
  );
}
