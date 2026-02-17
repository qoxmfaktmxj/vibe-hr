import { LoginCard } from "@/components/auth/login-card";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 sm:p-8">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://lh3.googleusercontent.com/aida-public/AB6AXuBvLganA2l4Iedc39kMRrlm6ejEZC2nVFVOHxooKWgm4FF3B_xeMTTzkZVu5aETxyQxc-KGUWm6srT8Lwno8Y6VIgcW72PgsjtIr3HSln9qPqSZfBbZO8J5pWlkY3TjKWi0fgPWzereseZjEVRlTOudnk03riajwdAfPtRt7Kak7Sy1zD5DKq_cRFshN6yY0S6tn5EpvLvnvbB73nhKVFkk2sxDXi7SncWA2IDaHjTN9Cdcx_pY5TeLSMdaVoMlNJCH9YCaSxoGuvH3')",
        }}
      />
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

      <div className="relative z-10 w-full max-w-[460px]">
        <LoginCard />
        <p className="mt-7 text-center text-xs uppercase tracking-[0.18em] text-white/70">
          2026 Vibe-HR Systems, empowering people
        </p>
      </div>
    </div>
  );
}

