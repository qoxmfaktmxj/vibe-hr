import { LoginBrand } from "@/components/auth/login-brand";
import { socialLoginErrorMessageFor } from "@/components/auth/login-errors";
import { LoginCard } from "@/components/auth/login-card";
import styles from "@/components/auth/login.module.css";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const initialErrorMessage = socialLoginErrorMessageFor(params.error);

  return (
    <main className={styles.shell}>
      <div className={styles.brandPanel}>
        <LoginBrand />
      </div>

      <section className={styles.formPanel}>
        <div className={styles.formWrap}>
          <LoginCard initialErrorMessage={initialErrorMessage} />
          <p className={styles.footerNote}>
            2026 VIBE-HR SYSTEMS, 사람을 위한 인사관리
          </p>
        </div>
      </section>
    </main>
  );
}
