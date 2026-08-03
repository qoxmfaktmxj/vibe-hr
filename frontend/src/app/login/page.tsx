import { LoginCard } from "@/components/auth/login-card";

const ERROR_MESSAGES: Record<string, string> = {
  email_required: "소셜 로그인은 이메일 제공 동의가 필요합니다.",
  token_exchange_failed: "소셜 로그인 토큰 교환에 실패했습니다. 다시 시도해 주세요.",
  profile_fetch_failed: "소셜 사용자 정보를 가져오지 못했습니다.",
  invalid_state: "보안 검증에 실패했습니다. 다시 로그인해 주세요.",
  social_exchange_failed: "소셜 계정 로그인 처리에 실패했습니다.",
  missing_code: "소셜 로그인 코드가 누락되었습니다.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const initialErrorMessage = params.error ? ERROR_MESSAGES[params.error] ?? "소셜 로그인에 실패했습니다." : null;

  return (
    <main className="login-shell grid w-full lg:grid-cols-[minmax(0,1.27fr)_minmax(26rem,0.98fr)]">
      <section className="login-brand-canvas hidden min-h-[100dvh] items-end p-10 lg:flex xl:p-16" aria-label="VIBE-HR 소개">
        <div className="max-w-md text-white">
          <span className="vibe-mark vibe-mark--rail mb-8 h-12 w-12" aria-hidden="true" />
          <p className="text-sm font-semibold text-white/75">VIBE-HR</p>
          <h2 className="mt-3 text-4xl font-bold tracking-[-0.04em] xl:text-5xl">
            <span className="block">사람과 조직의 흐름을</span>
            <span className="block">하나로.</span>
          </h2>
          <p className="mt-5 max-w-sm text-base leading-7 text-white/80">
            인사 데이터와 일상의 업무를 한 화면에서 연결합니다.
          </p>
        </div>
      </section>

      <section className="login-form-canvas flex min-h-[100dvh] items-center justify-center p-5 sm:p-8 lg:p-10">
        <div className="w-full max-w-[460px]">
          <LoginCard initialErrorMessage={initialErrorMessage} />
          <p className="mt-7 text-center text-xs font-medium tracking-[0.08em] text-muted-foreground">
            2026 VIBE-HR SYSTEMS, 사람을 위한 인사관리
          </p>
        </div>
      </section>
    </main>
  );
}
