"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LockKeyhole, User } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { LoginCorporationItem, LoginCorporationListResponse } from "@/types/auth";

const FALLBACK_CORPORATIONS: LoginCorporationItem[] = [
  {
    enter_cd: "VIBE",
    company_code: "VIBE",
    corporation_name: "VIBE-HR",
    company_logo_url: "/vibehr_mark.svg",
  },
];

function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden border-white/20 bg-card/95 shadow-2xl backdrop-blur dark:bg-card/95">
      {children}
    </Card>
  );
}

function AuthCardIntro() {
  return (
    <CardHeader className="space-y-3 px-8 pb-4 pt-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-[#EEF2FF]">
        <Image
          src="/vibehr_mark.svg"
          alt="VIBE-HR"
          width={48}
          height={48}
          priority
        />
      </div>
      <h1 className="text-3xl font-black tracking-tight text-[#111318]">VIBE-HR</h1>
    </CardHeader>
  );
}

function LoginProgressIndicator() {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="h-1.5 overflow-hidden rounded-full bg-primary/15">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
      </div>
      <p className="text-center text-xs font-medium text-muted-foreground">
        로그인 처리 후 대시보드로 이동 중입니다.
      </p>
    </div>
  );
}

function AuthCardForm({ initialErrorMessage }: { initialErrorMessage?: string | null }) {
  const router = useRouter();
  const { login } = useAuth();
  const { refreshMenus } = useMenu();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage ?? null);
  const [corporations, setCorporations] = useState<LoginCorporationItem[]>(FALLBACK_CORPORATIONS);
  const [selectedEnterCd, setSelectedEnterCd] = useState("VIBE");
  const [isLoadingEnterCd, setIsLoadingEnterCd] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadCorporations() {
      try {
        const response = await fetch("/api/auth/enter-cds", { cache: "no-store" });
        const data = (await response.json().catch(() => null)) as LoginCorporationListResponse | null;
        if (!isMounted) {
          return;
        }

        const nextCorporations =
          response.ok && Array.isArray(data?.corporations) && data.corporations.length > 0
            ? data.corporations
            : FALLBACK_CORPORATIONS;

        setCorporations(nextCorporations);
        setSelectedEnterCd((current) => {
          const activeEnterCd = nextCorporations.some((corporation) => corporation.enter_cd === current)
            ? current
            : (nextCorporations.find((corporation) => corporation.enter_cd === "VIBE")?.enter_cd ??
              nextCorporations[0]?.enter_cd ??
              "VIBE");
          return activeEnterCd;
        });
      } catch {
        if (isMounted) {
          setCorporations(FALLBACK_CORPORATIONS);
          setSelectedEnterCd("VIBE");
        }
      } finally {
        if (isMounted) {
          setIsLoadingEnterCd(false);
        }
      }
    }

    void loadCorporations();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const enterCd = formData.get("enterCd");
    const loginId = formData.get("loginId");
    const password = formData.get("password");
    const remember = formData.get("remember") === "on";

    if (typeof enterCd !== "string" || typeof loginId !== "string" || typeof password !== "string") {
      setErrorMessage("아이디와 비밀번호를 올바르게 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await login({ enterCd, loginId, password, remember });
      await refreshMenus();
      router.replace("/dashboard");
    } catch {
      setErrorMessage("로그인에 실패했습니다. 아이디와 비밀번호를 확인해 주세요.");
      setIsSubmitting(false);
    }
  };

  return (
    <CardContent className="space-y-6 px-8 pb-8 pt-4">
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="enterCd" className="font-semibold text-foreground">
            ENTER_CD
          </Label>
          <select
            id="enterCd"
            name="enterCd"
            className="h-12 w-full rounded-md border border-border bg-card px-3 text-base outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            autoComplete="organization"
            value={selectedEnterCd}
            onChange={(event) => setSelectedEnterCd(event.target.value)}
            disabled={isLoadingEnterCd || isSubmitting}
            required
          >
            {corporations.map((corporation) => (
              <option key={corporation.enter_cd} value={corporation.enter_cd}>
                {corporation.enter_cd} - {corporation.corporation_name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            {isLoadingEnterCd
              ? "활성 ENTER_CD 목록을 불러오는 중입니다."
              : "로그인할 회사의 ENTER_CD를 선택하세요."}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="loginId" className="font-semibold text-foreground">
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
              className="h-12 border-border pl-10 text-base"
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password" className="font-semibold text-foreground">
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
              className="h-12 border-border pl-10 text-base"
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox id="remember" name="remember" />
          <Label htmlFor="remember" className="text-sm font-normal text-muted-foreground">
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

        {isSubmitting ? <LoginProgressIndicator /> : null}
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
