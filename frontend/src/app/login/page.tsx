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
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/login-hr-bg.svg')",
        }}
      />
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-[460px]">
        <LoginCard initialErrorMessage={initialErrorMessage} />
        <p className="mt-7 text-center text-xs uppercase tracking-[0.18em] text-white/70">
          2026 VIBE-HR SYSTEMS, 사람을 위한 인사관리
        </p>
      </div>
    </div>
  );
}
