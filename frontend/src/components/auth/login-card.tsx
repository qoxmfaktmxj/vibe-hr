"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, LockKeyhole, User } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden border-white/20 bg-white/95 shadow-2xl backdrop-blur dark:bg-slate-900/95">
      {children}
    </Card>
  );
}

function KakaoSymbolIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.477 3 2 6.545 2 10.917c0 2.865 1.924 5.377 4.808 6.754l-.961 3.243a.53.53 0 0 0 .791.594l3.851-2.564a12.6 12.6 0 0 0 1.511.09c5.523 0 10-3.545 10-7.917S17.523 3 12 3Z"
      />
    </svg>
  );
}

function GoogleLogoIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.232 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.153 7.959 3.041l5.657-5.657C34.046 6.053 29.277 4 24 4 12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20c0-1.341-.138-2.65-.389-3.917Z"
      />
      <path
        fill="#FF3D00"
        d="m6.306 14.691 6.571 4.819A11.96 11.96 0 0 1 24 12c3.059 0 5.842 1.153 7.959 3.041l5.657-5.657C34.046 6.053 29.277 4 24 4c-7.68 0-14.41 4.337-17.694 10.691Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.176 0 9.846-1.977 13.38-5.197l-6.181-5.238C29.125 35.091 26.673 36 24 36c-5.211 0-9.622-3.327-11.28-7.953l-6.53 5.033C9.441 39.556 16.199 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.793 2.721-2.52 5.046-4.869 6.565l6.181 5.238C36.178 40.198 44 34 44 24c0-1.341-.138-2.65-.389-3.917Z"
      />
    </svg>
  );
}

function AuthCardIntro() {
  return (
    <CardHeader className="space-y-3 px-8 pb-4 pt-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Building2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-black tracking-tight text-[#111318]">Vibe-HR</h1>
    </CardHeader>
  );
}

function AuthCardForm({ initialErrorMessage }: { initialErrorMessage?: string | null }) {
  const router = useRouter();
  const { login } = useAuth();
  const { refreshMenus } = useMenu();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage ?? null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const loginId = formData.get("loginId");
    const password = formData.get("password");

    if (typeof loginId !== "string" || typeof password !== "string") {
      setErrorMessage("아이디와 비밀번호를 올바르게 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({ loginId, password });
      await refreshMenus();
      router.replace("/dashboard");
    } catch {
      setErrorMessage("로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CardContent className="space-y-6 px-8 pb-8 pt-4">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="loginId" className="font-semibold text-slate-700">
            아이디
          </Label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="loginId"
              name="loginId"
              type="text"
              className="h-12 border-slate-200 pl-10 text-base"
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="font-semibold text-slate-700">
              비밀번호
            </Label>
            <Link href="/login" className="text-sm font-medium text-primary hover:opacity-80">
              비밀번호 찾기
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <Input
              id="password"
              name="password"
              type="password"
              className="h-12 border-slate-200 pl-10 text-base"
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" />
          <Label htmlFor="remember" className="text-sm font-normal text-slate-600">
            로그인 상태 유지
          </Label>
        </div>

        {errorMessage ? (
          <p className="text-sm font-medium text-rose-600" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <Button className="h-12 w-full text-base font-bold" disabled={isSubmitting} type="submit">
          {isSubmitting ? "로그인 중..." : "로그인"}
        </Button>
      </form>

      <Separator />

      <div className="flex items-center justify-center gap-5 pt-1">
        <Link
          href="/api/auth/social/login/kakao"
          className="group flex flex-col items-center gap-2"
          aria-label="Kakao login"
          title="Kakao login"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#FEE500] text-[#000000] shadow-sm ring-1 ring-black/10 transition group-hover:scale-105">
            <KakaoSymbolIcon />
          </span>
          <span className="text-xs font-medium text-black/85">Kakao</span>
        </Link>

        <Link
          href="/api/auth/social/login/google"
          className="group flex flex-col items-center gap-2"
          aria-label="Google login"
          title="Google login"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-300 transition group-hover:scale-105">
            <GoogleLogoIcon />
          </span>
          <span className="text-xs font-medium text-slate-600">Google</span>
        </Link>
      </div>
    </CardContent>
  );
}

export function LoginCard({ initialErrorMessage = null }: { initialErrorMessage?: string | null }) {
  return (
    <AuthCard>
      <AuthCardIntro />
      <AuthCardForm initialErrorMessage={initialErrorMessage} />
    </AuthCard>
  );
}
