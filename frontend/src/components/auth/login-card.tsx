"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LockKeyhole, User } from "lucide-react";

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

function AuthCardIntro() {
  return (
    <CardHeader className="space-y-3 px-8 pb-4 pt-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#EEF2FF]">
        <Image
          src="/vibehr_logo-256x256.png"
          alt="Vibe-HR"
          width={48}
          height={48}
          priority
        />
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
    const remember = formData.get("remember") === "on";

    if (typeof loginId !== "string" || typeof password !== "string") {
      setErrorMessage("아이디와 비밀번호를 올바르게 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({ loginId, password, remember });
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
          <Label htmlFor="password" className="font-semibold text-slate-700">
            비밀번호
          </Label>
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
          <Checkbox id="remember" name="remember" />
          <Label htmlFor="remember" className="text-sm font-normal text-slate-600">
            로그인 상태 유지 (30일)
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
          href="/api/auth/social/login/google"
          className="block transition hover:opacity-85"
          aria-label="Google login"
          title="Google login"
        >
          <span className="relative block h-[35px] w-[34px]">
            <Image
              src="/images/google_login.png"
              alt="Continue with Google"
              fill
              sizes="34px"
              className="object-contain"
              priority
            />
          </span>
        </Link>

        <Link
          href="/api/auth/social/login/kakao"
          className="block transition hover:opacity-85"
          aria-label="Kakao login"
          title="Kakao login"
        >
          <span className="relative block h-[35px] w-[34px]">
            <Image
              src="/images/kakao_login.png"
              alt="Login with Kakao"
              fill
              sizes="34px"
              className="object-contain"
            />
          </span>
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
