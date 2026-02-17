"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Building2, LockKeyhole, User } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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

function AuthCardIntro() {
  return (
    <CardHeader className="space-y-3 px-8 pb-4 pt-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Building2 className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="text-3xl font-black tracking-tight text-[#111318]">Vibe-HR</h1>
      <p className="text-sm text-slate-500">다시 오신 것을 환영합니다. 계정으로 로그인해 주세요.</p>
    </CardHeader>
  );
}

function AuthCardForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          또는 다음으로 계속
        </span>
      </div>

      <Button variant="outline" className="h-11 w-full border-slate-200 font-semibold text-slate-700">
        통합 로그인 (SSO)
      </Button>
    </CardContent>
  );
}

function AuthCardSupport() {
  return (
    <CardFooter className="border-t border-slate-100 bg-slate-50 px-8 py-5 text-center">
      <p className="w-full text-sm text-slate-500">
        로그인에 문제가 있나요?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          관리자에게 문의
        </Link>
      </p>
    </CardFooter>
  );
}

export function LoginCard() {
  return (
    <AuthCard>
      <AuthCardIntro />
      <AuthCardForm />
      <AuthCardSupport />
    </AuthCard>
  );
}
