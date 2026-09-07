"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Eye, EyeOff, Loader2, LockKeyhole, RotateCcw, User } from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { useMenu } from "@/components/auth/menu-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { loginErrorMessageFor } from "@/components/auth/login-errors";
import styles from "@/components/auth/login.module.css";
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
    <Card className="gap-0 overflow-hidden border-[var(--vibe-border-emphasis)] bg-card py-0 shadow-[var(--vibe-shadow-floating)]">
      {children}
    </Card>
  );
}

function AuthCardIntro() {
  return (
    <CardHeader className="space-y-3 px-6 pb-4 pt-6 text-left">
      <Image src="/vibehr_mark.svg" alt="" width={32} height={32} className="h-8 w-8" aria-hidden="true" />
      <div className="space-y-2">
        <h1 className="text-[clamp(1.8rem,2.4vw,2.1rem)] font-black tracking-[-0.04em] text-foreground">
          VIBE-HR 로그인
        </h1>
        <p className="max-w-sm text-sm leading-5 text-muted-foreground">
          체험용 계정이 입력되어 있습니다. 개인 계정으로 바꿔 로그인할 수 있습니다.
        </p>
      </div>
    </CardHeader>
  );
}

function LoginProgressIndicator() {
  return (
    <div className="flex items-center justify-center gap-2" role="status">
      <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      <p className="text-center text-xs font-medium text-muted-foreground">
        로그인을 처리하고 있습니다.
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
  const [corporationError, setCorporationError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const loadCorporations = useCallback(async () => {
    setIsLoadingEnterCd(true);
    setCorporationError(null);

    try {
      const response = await fetch("/api/auth/enter-cds", { cache: "no-store" });
      const data = (await response.json().catch(() => null)) as LoginCorporationListResponse | null;

      const nextCorporations =
        response.ok && Array.isArray(data?.corporations) && data.corporations.length > 0
          ? data.corporations
          : FALLBACK_CORPORATIONS;

      setCorporations(nextCorporations);
      setSelectedEnterCd((current) => {
        if (nextCorporations.some((corporation) => corporation.enter_cd === current)) {
          return current;
        }

        return nextCorporations.find((corporation) => corporation.enter_cd === "VIBE")?.enter_cd ?? nextCorporations[0]?.enter_cd ?? "VIBE";
      });

      if (!response.ok || !Array.isArray(data?.corporations) || (data?.corporations?.length ?? 0) === 0) {
        setCorporationError("회사 목록을 불러오지 못해 기본 회사 VIBE-HR로 열어두었습니다.");
      }
    } catch {
      setCorporations(FALLBACK_CORPORATIONS);
      setSelectedEnterCd("VIBE");
      setCorporationError("회사 목록을 불러오지 못해 기본 회사 VIBE-HR로 열어두었습니다.");
    } finally {
      setIsLoadingEnterCd(false);
    }
  }, []);

  useEffect(() => {
    void loadCorporations();
  }, [loadCorporations]);

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
    } catch (error) {
      setErrorMessage(loginErrorMessageFor(error));
      setIsSubmitting(false);
    }
  };

  return (
    <CardContent className="space-y-4 px-6 pb-6 pt-2">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1.5">
          <Label htmlFor="enterCd" className="font-semibold text-foreground">
            회사
          </Label>
          <select
            id="enterCd"
            name="enterCd"
            className="h-12 w-full rounded-md border border-border bg-card px-3 text-base outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
            autoComplete="organization"
            value={selectedEnterCd}
            onChange={(event) => setSelectedEnterCd(event.target.value)}
            disabled={isSubmitting}
            aria-describedby="enterCd-help"
            required
          >
            {corporations.map((corporation) => (
              <option key={corporation.enter_cd} value={corporation.enter_cd}>
                {corporation.corporation_name} ({corporation.enter_cd})
              </option>
            ))}
          </select>
          <div className="flex items-start justify-between gap-3">
            <p
              id="enterCd-help"
              className="text-xs leading-5 text-muted-foreground"
              role={corporationError ? "status" : undefined}
              aria-live={corporationError ? "polite" : undefined}
            >
              {isLoadingEnterCd
                ? "회사 목록을 불러오는 중입니다. 기본 회사 VIBE-HR로 먼저 로그인할 수 있습니다."
                : corporationError ?? "로그인할 회사를 선택하세요."}
            </p>
            {corporationError ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 shrink-0 px-3 text-xs font-semibold"
                onClick={() => void loadCorporations()}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                다시 시도
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="loginId" className="font-semibold text-foreground">
            아이디
          </Label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="loginId"
              name="loginId"
              type="text"
              defaultValue="admin"
              className="h-12 border-border pl-10 text-base"
              placeholder="아이디를 입력하세요"
              autoComplete="username"
              spellCheck={false}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="font-semibold text-foreground">
            비밀번호
          </Label>
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              defaultValue="admin"
              className="h-12 border-border pl-10 pr-14 text-base"
              placeholder="비밀번호를 입력하세요"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => setShowPassword((current) => !current)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
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

      <div className="space-y-3 pt-0.5">
        <p className="text-sm font-semibold text-foreground">간편 로그인</p>
        <p className="text-xs leading-5 text-muted-foreground">이메일 제공 동의가 필요합니다. 등록되지 않은 이메일은 새 계정으로 만들어집니다.</p>
        <div className="space-y-2">
          <div className={styles.socialGrid}>
            <Button asChild variant="outline" className={`h-11 w-full ${styles.socialButton}`}>
              <Link
                href="/api/auth/social/login/google"
                className="flex w-full items-center justify-center gap-2"
                aria-label="구글 로그인"
                title="구글 로그인"
              >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <Image
                  src="/images/google_login.png"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                  aria-hidden="true"
                />
              </span>
              <span className={styles.socialButtonText}>구글 로그인</span>
            </Link>
          </Button>

            <Button asChild variant="outline" className={`h-11 w-full ${styles.socialButton}`}>
              <Link
                href="/api/auth/social/login/kakao"
                className="flex w-full items-center justify-center gap-2"
                aria-label="카카오 로그인"
                title="카카오 로그인"
              >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                <Image
                  src="/images/kakao_login.png"
                  alt=""
                  width={20}
                  height={20}
                  className="h-5 w-5 object-contain"
                  aria-hidden="true"
                />
              </span>
              <span className={styles.socialButtonText}>카카오 로그인</span>
            </Link>
          </Button>
          </div>
        </div>
      </div>

      <details className={styles.helpDisclosure}>
        <summary>
          <span>도움말</span>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </summary>
        <div className={styles.helpDisclosureContent}>
          회사 코드, 아이디, 비밀번호를 먼저 확인해 주세요. 값이 기억나지 않으면 사내 계정 관리자에게 문의하고,
          간편 로그인은 구글 또는 카카오의 이메일로 계정을 확인하며, 등록되지 않은 이메일은 새 계정으로 만들어집니다.
        </div>
      </details>
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
