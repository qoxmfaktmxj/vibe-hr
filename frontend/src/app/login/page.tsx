import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
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
        <LoginCard />
        <p className="mt-7 text-center text-xs uppercase tracking-[0.18em] text-white/70">
          2026 VIBE-HR SYSTEMS, 사람을 위한 인사관리
        </p>
      </div>
    </div>
  );
}
