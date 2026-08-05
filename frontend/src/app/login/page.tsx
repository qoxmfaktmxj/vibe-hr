import Image from "next/image";

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
    <main className="login-shell relative w-full">
      <section
        className="login-brand-canvas pointer-events-none absolute inset-0 hidden min-h-[100dvh] items-end p-10 lg:flex xl:p-16"
        aria-label="VIBE-HR 소개"
      >
        <div className="text-white">
          <Image
            src="/brand/vibehr-mark-white.svg"
            alt=""
            width={48}
            height={48}
            className="mb-8 h-12 w-12"
            aria-hidden="true"
          />
          <p className="text-sm font-semibold text-white/75">VIBE-HR</p>
          <h2 className="mt-3 whitespace-nowrap text-[clamp(1.75rem,3vw,3rem)] font-bold tracking-[-0.03em]">
            사람이 중심이 되는 HR의 시작
          </h2>
          <p className="mt-5 max-w-md text-base leading-7 text-white/80">
            구성원과 조직이 필요한 정보를 한곳에서 편리하게 관리합니다.
          </p>
        </div>
      </section>

      <section className="login-form-canvas relative z-10 ml-auto flex min-h-[100dvh] w-full items-center justify-center px-5 py-8 sm:px-8 lg:w-[min(42rem,54vw)] lg:px-10 xl:px-14">
        <div className="w-full max-w-[460px]">
          <LoginCard initialErrorMessage={initialErrorMessage} />
          <p className="mt-7 text-center text-xs font-medium tracking-[0.08em] text-white/70">
            2026 VIBE-HR SYSTEMS, 사람을 위한 인사관리
          </p>
        </div>
      </section>
    </main>
  );
}
